import asyncio
import datetime as dt
from typing import Any, Dict, List

import httpx

from backend.mcp.integrations.base import Connector

# Constants for DORA metrics calculations
DAYS_IN_WEEK = 7


class GitHubConnector(Connector):
    name = "github"
    required_env = ["GITHUB_TOKEN", "GITHUB_ORG"]

    def __init__(self, config: Dict[str, Any] | None = None):
        self.token = config.get("GITHUB_TOKEN", "") if config else ""
        self.org = config.get("GITHUB_ORG", "") if config else ""
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
            # Verify repo list access, not just public org existence.
            r = await client.get(f"{self.base_url}/orgs/{self.org}/repos?per_page=5")
            if r.status_code == 200:
                repos = r.json()
                accessible = [repo["full_name"] for repo in repos[:3]]
                return {"ok": True, "error": None, "sample_repos": accessible}
            return {"ok": False, "error": f"HTTP {r.status_code}: {r.text}"}

    async def fetch_metrics(self) -> List[Dict[str, Any]]:
        repos = await self._get_repos_unsafe()
        repo_results = await asyncio.gather(*[
            self._fetch_repo_metrics(repo) for repo in repos[:10]
        ], return_exceptions=True)
        event_results = await asyncio.gather(*[
            self._fetch_repo_events(repo) for repo in repos[:10]
        ], return_exceptions=True)

        metrics: List[Dict[str, Any]] = []
        skipped: List[str] = []
        for res in repo_results:
            if isinstance(res, Exception):
                skipped.append(str(res))
                continue
            metrics.extend(res["metrics"])
            if res["skipped"]:
                skipped.extend(res["skipped"])

        for res in event_results:
            if isinstance(res, Exception):
                continue
            metrics.extend(res.get("metrics", []))

        if skipped:
            metrics.append({
                "source": "github",
                "metric_type": "sync_skipped_repos",
                "entity": self.org,
                "value": len(skipped),
                "value_text": ", ".join(skipped),
                "meta": {"repos": skipped},
                "timestamp": dt.datetime.utcnow().isoformat(),
            })
        metrics.extend(self._derive_dora_metrics(metrics))
        return metrics

    def _derive_dora_metrics(self, repo_metrics: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        now = dt.datetime.utcnow().isoformat()
        commits = [m for m in repo_metrics if m["metric_type"] == "commit"]
        pr_cycles = [m for m in repo_metrics if m["metric_type"] == "pr_cycle_time"]

        deploy_days = len({
            m["timestamp"][:10]
            for m in commits
            if m.get("meta", {}).get("branch") in ("main", "master", "production", "prod")
        })
        dora: List[Dict[str, Any]] = [{
            "source": "github",
            "metric_type": "deploy_frequency",
            "entity": self.org,
            "value": round(deploy_days / max(1, DAYS_IN_WEEK), 2),
            "meta": {"window_days": DAYS_IN_WEEK, "deploy_days": deploy_days},
            "timestamp": now,
        }]

        if pr_cycles:
            review_times = sorted(float(m["value"]) for m in pr_cycles)
            median = review_times[len(review_times) // 2]
            dora.append({
                "source": "github",
                "metric_type": "median_review_time",
                "entity": self.org,
                "value": round(median, 2),
                "meta": {"unit": "hours", "count": len(review_times)},
                "timestamp": now,
            })

        dora.append({
            "source": "github",
            "metric_type": "flaky_tests",
            "entity": self.org,
            "value": 0,
            "meta": {"note": "requires CI check-runs data"},
            "timestamp": now,
        })
        return dora

    async def _fetch_repo_metrics(self, repo: Dict[str, Any]) -> Dict[str, Any]:
        repo_name = repo["full_name"]
        default_branch = repo.get("default_branch", "main")
        metrics: List[Dict[str, Any]] = []
        skipped: List[str] = []

        async with httpx.AsyncClient(headers=self.headers) as client:
            try:
                pulls = await self._get_open_prs(client, repo_name)
                metrics.append({
                    "source": "github",
                    "metric_type": "open_prs",
                    "entity": repo_name,
                    "value": len(pulls),
                    "meta": {"default_branch": default_branch},
                    "timestamp": dt.datetime.utcnow().isoformat(),
                })
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code in (403, 404):
                    skipped.append(repo_name)
                else:
                    raise

            try:
                commits = await self._get_commits_across_branches(
                    client, repo_name, default_branch, days=90
                )
                seen_shas = set()
                # Fetch diff stats for up to 50 most-recent commits (one API call each)
                stat_shas = [c["sha"] for c in commits if c["sha"] not in seen_shas][:50]
                semaphore = asyncio.Semaphore(10)
                async def _fetch_stats(sha: str) -> tuple[str, int, int]:
                    async with semaphore:
                        try:
                            r = await client.get(f"{self.base_url}/repos/{repo_name}/commits/{sha}")
                            if r.status_code == 200:
                                s = r.json().get("stats", {})
                                return sha, int(s.get("additions", 0)), int(s.get("deletions", 0))
                        except Exception:
                            pass
                        return sha, 0, 0
                stat_results = await asyncio.gather(*[_fetch_stats(sha) for sha in stat_shas])
                stats_map = {sha: (a, d) for sha, a, d in stat_results}

                for c in commits:
                    if c["sha"] in seen_shas:
                        continue
                    seen_shas.add(c["sha"])
                    author = c["author_login"] or c["author_name"] or "Unknown"
                    additions, deletions = stats_map.get(c["sha"], (0, 0))
                    metrics.append({
                        "source": "github",
                        "metric_type": "commit",
                        "entity": repo_name,
                        "value": 1,
                        "value_text": author,
                        "meta": {
                            "author_login": c["author_login"],
                            "author_name": c["author_name"],
                            "sha": c["sha"],
                            "message": c["message"],
                            "repo": repo_name,
                            "branch": c.get("branch"),
                            "additions": additions,
                            "deletions": deletions,
                        },
                        "timestamp": c["date"],
                    })
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code in (403, 404):
                    skipped.append(repo_name)
                else:
                    raise

        return {"metrics": metrics, "skipped": skipped}

    async def fetch_events(self) -> List[Dict[str, Any]]:
        repos = await self._get_repos_unsafe()
        results = await asyncio.gather(*[
            self._fetch_repo_events(repo) for repo in repos[:10]
        ], return_exceptions=True)

        events: List[Dict[str, Any]] = []
        for res in results:
            if isinstance(res, Exception):
                continue
            events.extend(res.get("events", []))
        return events

    async def _fetch_repo_events(self, repo: Dict[str, Any]) -> Dict[str, List[Dict[str, Any]]]:
        repo_name = repo["full_name"]
        events: List[Dict[str, Any]] = []
        metrics: List[Dict[str, Any]] = []

        async with httpx.AsyncClient(headers=self.headers, timeout=30) as client:
            try:
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
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code not in (403, 404):
                    raise

            try:
                secret_alerts = await self._get_secret_scanning_alerts(client, repo_name)
                for alert in secret_alerts:
                    events.append({
                        "source": "github",
                        "event_type": "secret_scanning_alert",
                        "entity": repo_name,
                        "title": f"Secret scanning alert: {alert.get('secret_type_display_name', alert.get('secret_type', 'Unknown'))}",
                        "severity": "high" if alert.get("state") == "open" else "medium",
                        "status": alert.get("state", "open"),
                        "meta": alert,
                        "happened_at": alert.get("created_at", dt.datetime.utcnow().isoformat()),
                    })
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code not in (403, 404):
                    raise

            try:
                prs = await self._get_prs(client, repo_name)
                semaphore = asyncio.Semaphore(8)
                pr_results = await asyncio.gather(*[
                    self._build_pr_event(client, repo_name, pr, semaphore) for pr in prs
                ])
                for event, pr_metrics in pr_results:
                    events.append(event)
                    metrics.extend(pr_metrics)
            except httpx.HTTPStatusError as exc:
                if exc.response.status_code not in (403, 404):
                    raise

        return {"events": events, "metrics": metrics}

    async def _build_pr_event(
        self,
        client: httpx.AsyncClient,
        repo_name: str,
        pr: Dict[str, Any],
        semaphore: asyncio.Semaphore,
    ) -> tuple[Dict[str, Any], List[Dict[str, Any]]]:
        pr_number = pr["number"]
        pr_metrics: List[Dict[str, Any]] = []
        async with semaphore:
            reviews = await self._get_pr_reviews(client, repo_name, pr_number)
            reviewer_logins = sorted({
                r["user"].get("login")
                for r in reviews
                if r.get("user") and r["user"].get("login")
            })
            # Aggregate review states: APPROVED, CHANGES_REQUESTED, COMMENTED
            # Last state per reviewer wins (GitHub only counts the latest review per person)
            review_states: Dict[str, str] = {}
            for rv in sorted(reviews, key=lambda x: x.get("submitted_at", "")):
                login = (rv.get("user") or {}).get("login")
                state_val = rv.get("state", "")
                if login and state_val in ("APPROVED", "CHANGES_REQUESTED", "COMMENTED"):
                    review_states[login] = state_val
            approvals = [l for l, s in review_states.items() if s == "APPROVED"]
            changes_requested = [l for l, s in review_states.items() if s == "CHANGES_REQUESTED"]
            comments_only = [l for l, s in review_states.items() if s == "COMMENTED"]
            had_concerns = len(changes_requested) > 0

            merged_by = pr.get("merged_by") or {}
            merged_at = pr.get("merged_at")
            created_at = pr.get("created_at")
            # The pulls list endpoint omits merged_by for some tokens; fetch the
            # individual PR when we know the PR was merged but merger is missing.
            if merged_at and not merged_by.get("login"):
                try:
                    detail = await self._get_pr_detail(client, repo_name, pr_number)
                    merged_by = detail.get("merged_by") or {}
                except httpx.HTTPStatusError:
                    merged_by = {}

            # Calculate review lead time in hours for median review time.
            if created_at and reviews:
                first_review = min(r.get("submitted_at") for r in reviews if r.get("submitted_at"))
                if first_review:
                    try:
                        created_dt = dt.datetime.fromisoformat(created_at.replace("Z", "+00:00"))
                        review_dt = dt.datetime.fromisoformat(first_review.replace("Z", "+00:00"))
                        hours = (review_dt - created_dt).total_seconds() / 3600.0
                        pr_metrics.append({
                            "source": "github",
                            "metric_type": "pr_cycle_time",
                            "entity": repo_name,
                            "value": round(hours, 2),
                            "meta": {"pr_number": pr_number, "branch": pr.get("head", {}).get("ref")},
                            "timestamp": review_dt.isoformat(),
                        })
                    except Exception:
                        pass

        status = "merged" if merged_at else pr.get("state", "unknown")

        event = {
            "source": "github",
            "event_type": "pull_request",
            "entity": repo_name,
            "title": pr["title"],
            "severity": "low",
            "status": status,
            "meta": {
                "pr_number": pr_number,
                "author_login": pr.get("user", {}).get("login"),
                "author_name": pr.get("user", {}).get("login"),
                "is_draft": bool(pr.get("draft")),
                "branch": pr.get("head", {}).get("ref"),
                "base_branch": pr.get("base", {}).get("ref"),
                "reviewer_logins": reviewer_logins,
                "approvals": approvals,
                "changes_requested": changes_requested,
                "comments_only": comments_only,
                "had_concerns": had_concerns,
                "merged_by_login": merged_by.get("login"),
                "merged_by_name": merged_by.get("login"),
                "created_at": pr.get("created_at"),
                "merged_at": merged_at,
                "closed_at": pr.get("closed_at"),
                "url": pr.get("html_url"),
            },
            "happened_at": pr.get("created_at", dt.datetime.utcnow().isoformat()),
        }
        return event, pr_metrics

    async def _get_repos_unsafe(self) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(headers=self.headers) as client:
            r = await client.get(f"{self.base_url}/orgs/{self.org}/repos?per_page=100")
            r.raise_for_status()
            return r.json()

    async def _get_repos(self, client: httpx.AsyncClient) -> List[Dict[str, Any]]:
        r = await client.get(f"{self.base_url}/orgs/{self.org}/repos?per_page=100")
        r.raise_for_status()
        return r.json()

    async def _get_open_prs(self, client: httpx.AsyncClient, repo: str) -> List[Dict[str, Any]]:
        r = await client.get(f"{self.base_url}/repos/{repo}/pulls?state=open&per_page=100")
        r.raise_for_status()
        return r.json()

    async def _get_prs(
        self, client: httpx.AsyncClient, repo: str, state: str = "all", per_page: int = 100
    ) -> List[Dict[str, Any]]:
        r = await client.get(
            f"{self.base_url}/repos/{repo}/pulls?state={state}&per_page={per_page}&sort=updated&direction=desc"
        )
        r.raise_for_status()
        return r.json()

    async def _get_pr_detail(
        self, client: httpx.AsyncClient, repo: str, pr_number: int
    ) -> Dict[str, Any]:
        r = await client.get(f"{self.base_url}/repos/{repo}/pulls/{pr_number}")
        r.raise_for_status()
        return r.json()

    async def _get_pr_reviews(
        self, client: httpx.AsyncClient, repo: str, pr_number: int
    ) -> List[Dict[str, Any]]:
        r = await client.get(f"{self.base_url}/repos/{repo}/pulls/{pr_number}/reviews?per_page=100")
        if r.status_code in (404, 403):
            return []
        r.raise_for_status()
        return r.json()

    async def _get_branches(self, client: httpx.AsyncClient, repo: str) -> List[Dict[str, Any]]:
        r = await client.get(f"{self.base_url}/repos/{repo}/branches?per_page=100")
        r.raise_for_status()
        return r.json()

    async def _get_commits(
        self,
        client: httpx.AsyncClient,
        repo: str,
        branch: str | None = None,
        days: int = 90,
    ) -> List[Dict[str, Any]]:
        since = (dt.datetime.utcnow() - dt.timedelta(days=days)).isoformat(timespec="seconds")
        branch_param = f"&sha={branch}" if branch else ""
        url = f"{self.base_url}/repos/{repo}/commits?since={since}&per_page=100{branch_param}"
        results: List[Dict[str, Any]] = []
        pages = 0
        max_pages = 2
        while url and pages < max_pages:
            r = await client.get(url, headers=self.headers)
            r.raise_for_status()
            for item in r.json():
                commit = item.get("commit", {}) or {}
                commit_author = commit.get("author", {}) or {}
                author = item.get("author") or {}
                results.append({
                    "sha": item.get("sha"),
                    "author_login": author.get("login"),
                    "author_name": commit_author.get("name"),
                    "message": (commit.get("message", "").split("\n")[0])[:120],
                    "date": commit_author.get("date"),
                    "branch": branch,
                })
            url = _next_page_url(r.headers.get("link"))
            pages += 1
        return results

    async def _get_commits_across_branches(
        self,
        client: httpx.AsyncClient,
        repo: str,
        default_branch: str,
        days: int = 90,
        max_branches: int = 10,
    ) -> List[Dict[str, Any]]:
        """Fetch commits from default branch first, then any additional branches, up to a cap."""
        branches = [default_branch]
        try:
            all_branches = await self._get_branches(client, repo)
            for b in all_branches[:max_branches]:
                name = b.get("name")
                if name and name != default_branch:
                    branches.append(name)
        except httpx.HTTPStatusError:
            pass

        all_commits: List[Dict[str, Any]] = []
        for branch in branches:
            try:
                all_commits.extend(await self._get_commits(client, repo, branch, days))
            except httpx.HTTPStatusError:
                continue
        return all_commits

    async def _get_dependabot_alerts(self, client: httpx.AsyncClient, repo: str) -> List[Dict[str, Any]]:
        r = await client.get(
            f"{self.base_url}/repos/{repo}/dependabot/alerts",
            headers={**self.headers, "Accept": "application/vnd.github+json"},
        )
        if r.status_code in (404, 403):
            return []
        r.raise_for_status()
        return r.json()

    async def _get_secret_scanning_alerts(self, client: httpx.AsyncClient, repo: str) -> List[Dict[str, Any]]:
        r = await client.get(
            f"{self.base_url}/repos/{repo}/secret-scanning/alerts",
            headers={**self.headers, "Accept": "application/vnd.github+json"},
        )
        if r.status_code in (404, 403):
            return []
        r.raise_for_status()
        return r.json()


def _next_page_url(link_header: str | None) -> str | None:
    if not link_header:
        return None
    for link in link_header.split(","):
        segments = link.split(";")
        if len(segments) < 2:
            continue
        url_part = segments[0].strip()
        rel_part = segments[1].strip()
        if url_part.startswith("<") and url_part.endswith(">") and 'rel="next"' in rel_part:
            return url_part[1:-1]
    return None
