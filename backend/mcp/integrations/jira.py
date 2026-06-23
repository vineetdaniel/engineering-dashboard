import datetime as dt
import os
from typing import Any, Dict, List

import httpx

from backend.mcp.integrations.base import Connector


class JiraConnector(Connector):
    name = "jira"
    required_env = ["JIRA_SERVER", "JIRA_USERNAME", "JIRA_API_TOKEN", "JIRA_PROJECT_KEYS"]

    def __init__(self):
        self.server = os.getenv("JIRA_SERVER", "").rstrip("/")
        self.username = os.getenv("JIRA_USERNAME", "")
        self.token = os.getenv("JIRA_API_TOKEN", "")
        self.project_keys = [k.strip() for k in os.getenv("JIRA_PROJECT_KEYS", "").split(",") if k.strip()]
        self.auth = (self.username, self.token)
        self.base_url = f"{self.server}/rest/api/3"

    async def health_check(self) -> Dict[str, Any]:
        if not all([self.server, self.username, self.token]):
            return {"ok": False, "error": "JIRA_SERVER, JIRA_USERNAME, JIRA_API_TOKEN required"}
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{self.base_url}/myself", auth=self.auth)
            if r.status_code == 200:
                return {"ok": True, "error": None}
            return {"ok": False, "error": f"HTTP {r.status_code}: {r.text}"}

    async def fetch_metrics(self) -> List[Dict[str, Any]]:
        metrics = []
        for project in self.project_keys:
            metrics.extend(await self._project_metrics(project))
        return metrics

    async def fetch_events(self) -> List[Dict[str, Any]]:
        events = []
        for project in self.project_keys:
            events.extend(await self._blocked_tickets(project))
        return events

    async def _project_metrics(self, project: str) -> List[Dict[str, Any]]:
        metrics = []
        async with httpx.AsyncClient() as client:
            jql = f"project={project} AND statusCategory != Done"
            r = await client.get(
                f"{self.base_url}/search",
                auth=self.auth,
                params={"jql": jql, "maxResults": 0},
            )
            r.raise_for_status()
            metrics.append({
                "source": "jira",
                "metric_type": "open_issues",
                "entity": project,
                "value": r.json().get("total", 0),
                "timestamp": dt.datetime.utcnow().isoformat(),
            })

            bug_jql = f"project={project} AND type=Bug AND statusCategory != Done"
            r = await client.get(
                f"{self.base_url}/search",
                auth=self.auth,
                params={"jql": bug_jql, "maxResults": 0},
            )
            r.raise_for_status()
            metrics.append({
                "source": "jira",
                "metric_type": "open_bugs",
                "entity": project,
                "value": r.json().get("total", 0),
                "timestamp": dt.datetime.utcnow().isoformat(),
            })
        return metrics

    async def _blocked_tickets(self, project: str) -> List[Dict[str, Any]]:
        events = []
        async with httpx.AsyncClient() as client:
            jql = f"project={project} AND status=Blocked"
            r = await client.get(
                f"{self.base_url}/search",
                auth=self.auth,
                params={"jql": jql, "fields": "summary,assignee,updated", "maxResults": 50},
            )
            r.raise_for_status()
            for issue in r.json().get("issues", []):
                fields = issue.get("fields", {})
                events.append({
                    "source": "jira",
                    "event_type": "blocked_ticket",
                    "entity": project,
                    "title": f"{issue['key']}: {fields.get('summary', '')}",
                    "severity": "medium",
                    "status": "blocked",
                    "meta": {
                        "key": issue["key"],
                        "assignee": fields.get("assignee", {}).get("displayName") if fields.get("assignee") else None,
                        "url": f"{self.server}/browse/{issue['key']}",
                    },
                    "happened_at": fields.get("updated", dt.datetime.utcnow().isoformat()),
                })
        return events
