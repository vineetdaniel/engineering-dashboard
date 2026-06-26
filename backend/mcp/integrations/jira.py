import datetime as dt
from collections import defaultdict
from typing import Any, Dict, List, Tuple

import httpx

from backend.mcp.integrations.base import Connector


class JiraConnector(Connector):
    name = "jira"
    required_env = ["JIRA_SERVER", "JIRA_USERNAME", "JIRA_API_TOKEN", "JIRA_PROJECT_KEYS"]

    def __init__(self, config: Dict[str, Any] | None = None):
        self.server = (config.get("JIRA_SERVER", "") if config else "").rstrip("/")
        self.username = config.get("JIRA_USERNAME", "") if config else ""
        self.token = config.get("JIRA_API_TOKEN", "") if config else ""
        project_keys_raw = config.get("JIRA_PROJECT_KEYS", "") if config else ""
        self.project_keys = [k.strip() for k in str(project_keys_raw).split(",") if k.strip()]
        # Quote project keys that are JQL reserved words (e.g. IN).
        self.quoted_project_keys = [f'"{k}"' if self._needs_quoting(k) else k for k in self.project_keys]
        self.story_points_field = (
            config.get("JIRA_STORY_POINTS_FIELD", "customfield_10016") if config else "customfield_10016"
        )
        self.auth = (self.username, self.token)
        self.base_url = f"{self.server}/rest/api/3"

    @staticmethod
    def _needs_quoting(key: str) -> bool:
        reserved = {"in", "is", "as", "or", "and", "not", "empty", "null", "was", "were", "changed"}
        return key.lower() in reserved or not key.replace("-", "").isalnum()

    def _points(self, fields: Dict[str, Any]) -> float:
        """Return the story-point value for an issue, defaulting to 0."""
        points = fields.get(self.story_points_field) or 0
        try:
            return float(points)
        except Exception:
            return 0.0

    @staticmethod
    def _assignee(fields: Dict[str, Any]) -> Tuple[str | None, str | None]:
        """Return (login_or_account_id, display_name) for an issue's assignee."""
        assignee = fields.get("assignee")
        if not assignee:
            return None, None
        login = assignee.get("accountId") or assignee.get("emailAddress") or assignee.get("key")
        name = assignee.get("displayName") or login
        return login, name

    async def health_check(self) -> Dict[str, Any]:
        if not all([self.server, self.username, self.token]):
            return {"ok": False, "error": "JIRA_SERVER, JIRA_USERNAME, JIRA_API_TOKEN required"}
        async with httpx.AsyncClient() as client:
            r = await self._jira_get(client, f"{self.base_url}/myself")
            if r.status_code == 200:
                return {"ok": True, "error": None}
            return {"ok": False, "error": f"HTTP {r.status_code}: {r.text}"}

    async def _jira_get(self, client: httpx.AsyncClient, url: str, params: Dict[str, Any] | None = None) -> httpx.Response:
        """Call a Jira endpoint with Basic auth, falling back to Bearer on 401."""
        r = await client.get(url, auth=self.auth, params=params)
        if r.status_code == 401:
            r = await client.get(url, headers={"Authorization": f"Bearer {self.token}"}, params=params)
        return r

    async def _jira_search(self, client: httpx.AsyncClient, jql: str, max_results: int = 50, fields: List[str] | None = None) -> httpx.Response:
        """Call the modern /rest/api/3/search/jql endpoint with auth fallback."""
        payload: Dict[str, Any] = {"jql": jql, "maxResults": max_results}
        if fields:
            payload["fields"] = fields
        r = await client.post(f"{self.base_url}/search/jql", auth=self.auth, json=payload)
        if r.status_code == 401:
            r = await client.post(
                f"{self.base_url}/search/jql",
                headers={"Authorization": f"Bearer {self.token}"},
                json=payload,
            )
        return r

    async def fetch_metrics(self) -> List[Dict[str, Any]]:
        metrics = []
        for project in self.quoted_project_keys:
            metrics.extend(await self._project_metrics(project))
            metrics.extend(await self._sprint_developer_points(project))
            metrics.extend(await self._developer_open_story_points(project))
            metrics.extend(await self._backlog_points(project))
        return metrics

    async def fetch_events(self) -> List[Dict[str, Any]]:
        events = []
        for project in self.quoted_project_keys:
            events.extend(await self._blocked_tickets(project))
            events.extend(await self._epic_progress(project))
        return events

    async def _project_metrics(self, project: str) -> List[Dict[str, Any]]:
        metrics = []
        async with httpx.AsyncClient() as client:
            jql = f"project={project} AND resolution = Unresolved"
            r = await self._jira_search(client, jql, max_results=1)
            r.raise_for_status()
            data = r.json()
            total = data.get("total") if "total" in data else len(data.get("issues", []))
            metrics.append({
                "source": "jira",
                "metric_type": "open_issues",
                "entity": project,
                "value": total,
                "timestamp": dt.datetime.utcnow().isoformat(),
            })

            bug_jql = f"project={project} AND type=Bug AND resolution = Unresolved"
            r = await self._jira_search(client, bug_jql, max_results=1)
            r.raise_for_status()
            data = r.json()
            total = data.get("total") if "total" in data else len(data.get("issues", []))
            metrics.append({
                "source": "jira",
                "metric_type": "open_bugs",
                "entity": project,
                "value": total,
                "timestamp": dt.datetime.utcnow().isoformat(),
            })

            metrics.extend(await self._sprint_metrics(client, project))
        return metrics

    async def _sprint_metrics(self, client: httpx.AsyncClient, project: str) -> List[Dict[str, Any]]:
        """Fetch active sprint data from Jira Agile API if available."""
        metrics: List[Dict[str, Any]] = []
        boards_url = f"{self.server.rstrip('/')}/rest/agile/1.0/board"
        r = await self._jira_get(client, boards_url, params={"projectKeyOrId": project})
        if r.status_code != 200:
            return metrics
        boards = r.json().get("values", [])
        if not boards:
            return metrics
        board_id = boards[0].get("id")
        if not board_id:
            return metrics

        sprints_url = f"{self.server.rstrip('/')}/rest/agile/1.0/board/{board_id}/sprint"
        r = await self._jira_get(client, sprints_url, params={"state": "active"})
        if r.status_code != 200:
            return metrics
        sprints = r.json().get("values", [])
        for sprint in sprints:
            sprint_id = sprint.get("id")
            sprint_name = sprint.get("name", "Sprint")
            issue_url = f"{self.server.rstrip('/')}/rest/agile/1.0/sprint/{sprint_id}/issue"
            fields = f"status,{self.story_points_field}"
            r = await self._jira_get(client, issue_url, params={"fields": fields})
            if r.status_code != 200:
                continue
            issues = r.json().get("issues", [])
            total_points = 0.0
            remaining_points = 0.0
            for issue in issues:
                fields = issue.get("fields", {})
                points = self._points(fields)
                total_points += points
                status_category = (fields.get("status", {}).get("statusCategory", {}).get("key") or "")
                if status_category != "done":
                    remaining_points += points
            metrics.append({
                "source": "jira",
                "metric_type": "sprint_velocity",
                "entity": project,
                "value": round(total_points, 2),
                "meta": {"sprint_id": sprint_id, "sprint_name": sprint_name, "completed_points": round(total_points - remaining_points, 2)},
                "timestamp": dt.datetime.utcnow().isoformat(),
            })
            metrics.append({
                "source": "jira",
                "metric_type": "sprint_remaining_points",
                "entity": project,
                "value": round(remaining_points, 2),
                "meta": {"sprint_id": sprint_id, "sprint_name": sprint_name, "committed": round(total_points, 2)},
                "timestamp": dt.datetime.utcnow().isoformat(),
            })
        return metrics

    async def _sprint_developer_points(self, project: str) -> List[Dict[str, Any]]:
        """Return per-developer story-point totals for each active sprint."""
        metrics: List[Dict[str, Any]] = []
        async with httpx.AsyncClient() as client:
            boards_url = f"{self.server.rstrip('/')}/rest/agile/1.0/board"
            r = await self._jira_get(client, boards_url, params={"projectKeyOrId": project})
            if r.status_code != 200:
                return metrics
            boards = r.json().get("values", [])
            if not boards:
                return metrics
            board_id = boards[0].get("id")
            if not board_id:
                return metrics

            sprints_url = f"{self.server.rstrip('/')}/rest/agile/1.0/board/{board_id}/sprint"
            r = await self._jira_get(client, sprints_url, params={"state": "active"})
            if r.status_code != 200:
                return metrics
            sprints = r.json().get("values", [])
            for sprint in sprints:
                sprint_id = sprint.get("id")
                sprint_name = sprint.get("name", "Sprint")
                issue_url = f"{self.server.rstrip('/')}/rest/agile/1.0/sprint/{sprint_id}/issue"
                fields = f"status,assignee,{self.story_points_field}"
                r = await self._jira_get(client, issue_url, params={"fields": fields, "maxResults": 200})
                if r.status_code != 200:
                    continue
                issues = r.json().get("issues", [])
                by_assignee: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"points": 0.0, "completed_points": 0.0, "name": None})
                for issue in issues:
                    issue_fields = issue.get("fields", {})
                    points = self._points(issue_fields)
                    login, name = self._assignee(issue_fields)
                    if not login:
                        continue
                    by_assignee[login]["name"] = name or login
                    by_assignee[login]["points"] += points
                    status_category = (issue_fields.get("status", {}).get("statusCategory", {}).get("key") or "")
                    if status_category == "done":
                        by_assignee[login]["completed_points"] += points
                for login, agg in by_assignee.items():
                    metrics.append({
                        "source": "jira",
                        "metric_type": "sprint_points_per_developer",
                        "entity": project,
                        "value": round(agg["points"], 2),
                        "meta": {
                            "sprint_id": sprint_id,
                            "sprint_name": sprint_name,
                            "project": project,
                            "assignee_login": login,
                            "assignee_name": agg["name"],
                            "completed_points": round(agg["completed_points"], 2),
                        },
                        "timestamp": dt.datetime.utcnow().isoformat(),
                    })
        return metrics

    async def _developer_open_story_points(self, project: str) -> List[Dict[str, Any]]:
        """Return unresolved story points grouped by assignee for a project."""
        metrics: List[Dict[str, Any]] = []
        jql = f"project={project} AND resolution = Unresolved AND assignee is not EMPTY"
        async with httpx.AsyncClient() as client:
            r = await self._jira_search(
                client,
                jql,
                max_results=200,
                fields=["assignee", self.story_points_field],
            )
            if r.status_code != 200:
                return metrics
            by_assignee: Dict[str, Dict[str, Any]] = defaultdict(lambda: {"points": 0.0, "count": 0, "name": None})
            for issue in r.json().get("issues", []):
                issue_fields = issue.get("fields", {})
                points = self._points(issue_fields)
                login, name = self._assignee(issue_fields)
                if not login:
                    continue
                by_assignee[login]["name"] = name or login
                by_assignee[login]["points"] += points
                by_assignee[login]["count"] += 1
            for login, agg in by_assignee.items():
                metrics.append({
                    "source": "jira",
                    "metric_type": "developer_open_story_points",
                    "entity": project,
                    "value": round(agg["points"], 2),
                    "meta": {
                        "project": project,
                        "assignee_login": login,
                        "assignee_name": agg["name"],
                        "issue_count": agg["count"],
                    },
                    "timestamp": dt.datetime.utcnow().isoformat(),
                })
        return metrics

    async def _backlog_points(self, project: str) -> List[Dict[str, Any]]:
        """Return story points for unresolved issues not in an active sprint."""
        jql = f"project={project} AND resolution = Unresolved AND (sprint is EMPTY OR sprint not in openSprints())"
        async with httpx.AsyncClient() as client:
            r = await self._jira_search(
                client,
                jql,
                max_results=200,
                fields=[self.story_points_field],
            )
            if r.status_code != 200:
                return []
            total_points = 0.0
            count = 0
            for issue in r.json().get("issues", []):
                points = self._points(issue.get("fields", {}))
                total_points += points
                count += 1
            return [{
                "source": "jira",
                "metric_type": "backlog_story_points",
                "entity": project,
                "value": round(total_points, 2),
                "meta": {"project": project, "issue_count": count},
                "timestamp": dt.datetime.utcnow().isoformat(),
            }]

    async def _blocked_tickets(self, project: str) -> List[Dict[str, Any]]:
        events = []
        async with httpx.AsyncClient() as client:
            jql = f"project={project} AND status = Blocked"
            r = await self._jira_search(
                client,
                jql,
                max_results=50,
                fields=["summary", "assignee", "updated"],
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

    async def _epic_progress(self, project: str) -> List[Dict[str, Any]]:
        events = []
        async with httpx.AsyncClient() as client:
            jql = f"project={project} AND type=Epic AND resolution = Unresolved"
            r = await self._jira_search(
                client,
                jql,
                max_results=20,
                fields=["summary", "status", self.story_points_field, "updated"],
            )
            r.raise_for_status()
            for issue in r.json().get("issues", []):
                fields = issue.get("fields", {})
                # Total story points for issues under this epic.
                epic_key = issue["key"]
                total_points = 0.0
                done_points = 0.0
                child_jql = f"'Epic Link'={epic_key} OR parent={epic_key}"
                child_r = await self._jira_search(
                    client,
                    child_jql,
                    max_results=100,
                    fields=["status", self.story_points_field],
                )
                if child_r.status_code == 200:
                    for child in child_r.json().get("issues", []):
                        child_fields = child.get("fields", {})
                        points = self._points(child_fields)
                        total_points += points
                        status_category = child_fields.get("status", {}).get("statusCategory", {}).get("key") or ""
                        if status_category == "done":
                            done_points += points
                pct = round((done_points / max(1, total_points)) * 100, 1)
                events.append({
                    "source": "jira",
                    "event_type": "epic_progress",
                    "entity": project,
                    "title": f"{epic_key}: {fields.get('summary', '')}",
                    "severity": "medium",
                    "status": fields.get("status", {}).get("name", "open"),
                    "meta": {
                        "key": epic_key,
                        "pct": pct,
                        "total_points": round(total_points, 1),
                        "done_points": round(done_points, 1),
                        "url": f"{self.server}/browse/{epic_key}",
                    },
                    "happened_at": fields.get("updated", dt.datetime.utcnow().isoformat()),
                })
        return events
