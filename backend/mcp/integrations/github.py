import datetime as dt
import os
from typing import Any, Dict, List

import httpx

from backend.mcp.integrations.base import Connector


class GitHubConnector(Connector):
    name = "github"
    required_env = ["GITHUB_TOKEN", "GITHUB_ORG"]

    def __init__(self):
        self.token = os.getenv("GITHUB_TOKEN", "")
        self.org = os.getenv("GITHUB_ORG", "")
        self.base_url = "https://api.github.com"
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def health_check(self) -> Dict[str, Any]:
        if not self.token or not self.org:
            return {"ok": False, "error": "GITHUB_TOKEN and GITHUB_ORG required"}
        async with httpx.AsyncClient(headers=self.headers) as client:
            r = await client.get(f"{self.base_url}/orgs/{self.org}")
            if r.status_code == 200:
                return {"ok": True, "error": None}
            return {"ok": False, "error": f"HTTP {r.status_code}: {r.text}"}

    async def fetch_metrics(self) -> List[Dict[str, Any]]:
        metrics = []
        async with httpx.AsyncClient(headers=self.headers) as client:
            repos = await self._get_repos(client)
            for repo in repos[:10]:
                repo_name = repo["full_name"]
                pulls = await self._get_open_prs(client, repo_name)
                metrics.append({
                    "source": "github",
                    "metric_type": "open_prs",
                    "entity": repo_name,
                    "value": len(pulls),
                    "meta": {"default_branch": repo.get("default_branch")},
                    "timestamp": dt.datetime.utcnow().isoformat(),
                })
        return metrics

    async def fetch_events(self) -> List[Dict[str, Any]]:
        events = []
        async with httpx.AsyncClient(headers=self.headers) as client:
            repos = await self._get_repos(client)
            for repo in repos[:10]:
                repo_name = repo["full_name"]
                alerts = await self._get_dependabot_alerts(client, repo_name)
                for alert in alerts:
                    events.append({
                        "source": "github",
                        "event_type": "dependabot_alert",
                        "entity": repo_name,
                        "title": f"{alert.get('security_advisory', {}).get('summary', 'Unknown CVE')}",
                        "severity": alert.get("security_advisory", {}).get("severity", "low"),
                        "status": alert.get("state"),
                        "meta": alert,
                        "happened_at": alert.get("created_at", dt.datetime.utcnow().isoformat()),
                    })
        return events

    async def _get_repos(self, client: httpx.AsyncClient) -> List[Dict[str, Any]]:
        r = await client.get(f"{self.base_url}/orgs/{self.org}/repos?per_page=100")
        r.raise_for_status()
        return r.json()

    async def _get_open_prs(self, client: httpx.AsyncClient, repo: str) -> List[Dict[str, Any]]:
        r = await client.get(f"{self.base_url}/repos/{repo}/pulls?state=open&per_page=100")
        r.raise_for_status()
        return r.json()

    async def _get_dependabot_alerts(self, client: httpx.AsyncClient, repo: str) -> List[Dict[str, Any]]:
        r = await client.get(
            f"{self.base_url}/repos/{repo}/dependabot/alerts",
            headers={**self.headers, "Accept": "application/vnd.github+json"},
        )
        if r.status_code == 404:
            return []
        r.raise_for_status()
        return r.json()
