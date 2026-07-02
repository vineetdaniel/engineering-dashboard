import asyncio
import datetime as dt
import json
import re
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx

from backend.config import settings
from backend.mcp.integrations.base import Connector

# Constants for DORA metrics calculations
DAYS_IN_WEEK = 7
DEFAULT_GIT_DAYS = 90
ACTIVE_DAYS = 30
MAX_ACTIVE_REPOS = 50
GIT_SEMAPHORE = 5
API_SEMAPHORE = 6
PR_LOOKBACK_DAYS = 14
REVIEW_SKIP_CLOSED_OLDER_THAN_DAYS = 30
MAX_PRS_PER_REPO = 50
MAX_ALERTS_PER_REPO = 100


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
        self._api_sem = asyncio.Semaphore(API_SEMAPHORE)
        self._git_sem = asyncio.Semaphore(GIT_SEMAPHORE)
        # In-memory caches so fetch_metrics and fetch_events don't duplicate
        # expensive PR/review API calls within the same sync.
        self._pr_cache: Dict[str, List[Dict[str, Any]]] = {}
        self._review_cache: Dict[str, List[Dict[str, Any]]] = {}

    @property
    def _repos_dir(self) -> Path:
        path = settings.GITHUB_REPOS_DIR or "/Users/vineetdaniel/org_repos"
        return Path(path).expanduser().resolve()

    @property
    def _cache_dir(self) -> Path:
        path = self._repos_dir / ".cto-dash-cache"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def _etag_cache_path(self) -> Path:
        return self._cache_dir / "etags.json"

    def _load_etag_cache(self) -> Dict[str, Any]:
        try:
            if self._etag_cache_path.exists():
                return json.loads(self._etag_cache_path.read_text(encoding="utf-8"))
        except Exception:
            pass
        return {}

    def _save_etag_cache(self, cache: Dict[str, Any]) -> None:
        try:
            self._etag_cache_path.write_text(json.dumps(cache, indent=2), encoding="utf-8")
        except Exception:
            pass

    def _parse_remote_url(self, url: str) -> Optional[Tuple[str, str]]:
        """Extract (owner, repo) from a GitHub remote URL."""
        url = url.strip()
        m = re.search(r"github\.com[:/]([^/]+)/([^/\s]+?)(?:\.git)?$", url)
        if m:
            owner, repo = m.groups()
            return owner, repo
        return None

    async def health_check(self) -> Dict[str, Any]:
        if not self.token or not self.org:
            return {"ok": False, "error": "GITHUB_TOKEN and GITHUB_ORG required"}
        async with httpx.AsyncClient(headers=self.headers) as client:
            r = await client.get(f"{self.base_url}/users/{self.org}", timeout=10)
            if r.status_code == 200:
                data = r.json()
                return {
                    "ok": True,
                    "error": None,
                    "org": data.get("login"),
                    "public_repos": data.get("public_repos"),
                }
            return {"ok": False, "error": f"HTTP {r.status_code}: {r.text}"}

    def _parse_rate_limit(self, response: httpx.Response) -> Dict[str, Any]:
        """Parse GitHub rate limit headers from response."""
        try:
            reset_timestamp = int(response.headers.get("X-RateLimit-Reset", 0))
            reset_at = dt.datetime.utcfromtimestamp(reset_timestamp).isoformat() if reset_timestamp else "unknown"
            return {
                "limit": response.headers.get("X-RateLimit-Limit", "unknown"),
                "remaining": response.headers.get("X-RateLimit-Remaining", "unknown"),
                "reset_at": reset_at,
                "used": response.headers.get("X-RateLimit-Used", "unknown"),
            }
        except Exception:
            return {"error": "Could not parse rate limit headers"}

    async def _sleep_for_rate_limit(self, response: httpx.Response) -> None:
        """Sleep if GitHub asks us to back off (rate limit or abuse)."""
        retry_after = response.headers.get("Retry-After")
        if retry_after:
            try:
                await asyncio.sleep(int(retry_after) + 1)
                return
            except Exception:
                pass

        rate_info = self._parse_rate_limit(response)
        remaining = rate_info.get("remaining")
        reset_at = rate_info.get("reset_at")
        if isinstance(remaining, (int, str)) and str(remaining).isdigit() and int(remaining) <= 1:
            if reset_at and reset_at != "unknown":
                try:
                    reset_ts = dt.datetime.fromisoformat(reset_at).timestamp()
                    wait = max(1, reset_ts - time.time() + 5)
                    await asyncio.sleep(min(wait, 600))
                except Exception:
                    await asyncio.sleep(60)

    async def _get(
        self,
        client: httpx.AsyncClient,
        url: str,
        cache_key: str,
        cache_ttl_seconds: int = 3600,
        headers: Optional[Dict[str, str]] = None,
        allow_403_404_empty: bool = False,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """Cached GET with ETag support and automatic rate-limit backoff.

        Returns (data, from_cache). If allow_403_404_empty is True, returns [] on
        403/404 instead of raising.
        """
        cache = self._load_etag_cache()
        cached = cache.get(cache_key)
        request_headers = {**(headers or {}), **self.headers}

        etag = None
        if cached and cached.get("etag") and cached.get("saved_at"):
            try:
                age = time.time() - cached["saved_at"]
                if age <= cache_ttl_seconds:
                    etag = cached["etag"]
                    request_headers["If-None-Match"] = etag
            except Exception:
                pass

        async with self._api_sem:
            r = await client.get(url, headers=request_headers, timeout=30)

        if r.status_code == 304 and cached:
            return cached.get("body", []), True

        if r.status_code in (403, 429):
            await self._sleep_for_rate_limit(r)
            async with self._api_sem:
                r = await client.get(url, headers=request_headers, timeout=30)

        if r.status_code in (404, 403) and allow_403_404_empty:
            return [], False

        if r.status_code == 304 and cached:
            return cached.get("body", []), True

        r.raise_for_status()
        body = r.json()
        if not isinstance(body, list):
            body = [body] if isinstance(body, dict) else []

        etag = r.headers.get("ETag") or r.headers.get("etag")
        if etag and cache_key:
            cache[cache_key] = {
                "etag": etag,
                "body": body,
                "saved_at": time.time(),
            }
            self._save_etag_cache(cache)

        return body, False

    async def _git_cmd(
        self,
        *args: str,
        cwd: Optional[Path] = None,
        timeout: Optional[int] = 120,
    ) -> str:
        """Run a git command asynchronously and return stdout."""
        proc = await asyncio.create_subprocess_exec(
            "git",
            *args,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        if proc.returncode != 0:
            err = stderr.decode("utf-8", errors="replace").strip()
            raise RuntimeError(f"git {' '.join(args)} failed: {err}")
        return stdout.decode("utf-8", errors="replace")

    def _clean_branch_name(self, ref: str) -> str:
        for prefix in ("refs/remotes/origin/", "refs/remotes/", "refs/heads/", "origin/"):
            if ref.startswith(prefix):
                return ref[len(prefix):]
        return ref

    async def _discover_local_repos(self) -> List[Dict[str, Any]]:
        """Walk GITHUB_REPOS_DIR and find working-tree repos belonging to the org."""
        root = self._repos_dir
        if not root.exists():
            return []

        found: List[Dict[str, Any]] = []
        for git_dir in root.rglob(".git"):
            if not git_dir.is_dir():
                continue
            repo_path = git_dir.parent
            try:
                remote = await self._git_cmd(
                    "remote", "get-url", "origin", cwd=repo_path, timeout=10
                )
            except Exception:
                continue
            parsed = self._parse_remote_url(remote.strip())
            if not parsed:
                continue
            owner, repo_name = parsed
            if owner.lower() != self.org.lower():
                continue
            found.append({
                "path": repo_path,
                "full_name": f"{owner}/{repo_name}",
                "owner": owner,
                "name": repo_name,
            })
        return found

    async def _get_default_branch(self, repo_path: Path) -> str:
        """Best-effort default branch from origin/HEAD."""
        try:
            stdout = await self._git_cmd(
                "rev-parse", "--abbrev-ref", "refs/remotes/origin/HEAD",
                cwd=repo_path, timeout=10,
            )
            branch = stdout.strip()
            if branch.startswith("origin/"):
                return branch[7:]
            return branch or "main"
        except Exception:
            return "main"

    async def _fetch_commits_from_git(
        self,
        repo_path: Path,
        days: int = DEFAULT_GIT_DAYS,
    ) -> List[Dict[str, Any]]:
        """Read commits and diff stats from a local working-tree clone."""
        since = (dt.datetime.utcnow() - dt.timedelta(days=days)).isoformat(timespec="seconds")
        fmt = "---%H%x00%S%x00%an%x00%ae%x00%aI%x00%s"
        stdout = await self._git_cmd(
            "log",
            "--all",
            "--source",
            "--numstat",
            f"--since={since}",
            f"--pretty=format:{fmt}",
            cwd=repo_path,
            timeout=300,
        )

        commits: Dict[str, Dict[str, Any]] = {}
        current_sha: Optional[str] = None

        for line in stdout.splitlines():
            if line.startswith("---"):
                parts = line[3:].split("\x00")
                if len(parts) != 6:
                    current_sha = None
                    continue
                sha, ref, name, email, date, message = parts
                current_sha = sha
                commits.setdefault(sha, {
                    "sha": sha,
                    "branch": self._clean_branch_name(ref),
                    "author_name": name,
                    "author_email": email,
                    "date": date,
                    "message": message[:120],
                    "additions": 0,
                    "deletions": 0,
                })
                continue

            if not current_sha or not line.strip():
                continue

            stat_parts = line.split("\t")
            if len(stat_parts) < 2:
                continue
            add_raw, del_raw = stat_parts[0], stat_parts[1]
            try:
                additions = int(add_raw) if add_raw != "-" else 0
                deletions = int(del_raw) if del_raw != "-" else 0
            except ValueError:
                continue
            commit = commits[current_sha]
            commit["additions"] += additions
            commit["deletions"] += deletions

        return list(commits.values())

    async def _count_recent_commits(self, repo_path: Path, days: int = ACTIVE_DAYS) -> int:
        """Cheap check for recent activity without parsing full stats."""
        since = (dt.datetime.utcnow() - dt.timedelta(days=days)).isoformat(timespec="seconds")
        try:
            stdout = await self._git_cmd(
                "rev-list", "--all", "--count", f"--since={since}",
                cwd=repo_path, timeout=60,
            )
            return int(stdout.strip())
        except Exception:
            return 0

    async def _filter_active_repos(
        self, repos: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Sort local repos by recent commit count and keep the top N."""
        if not repos:
            return []

        counts = await asyncio.gather(*[
            self._count_recent_commits(r["path"], ACTIVE_DAYS) for r in repos
        ], return_exceptions=True)

        scored: List[Tuple[int, Dict[str, Any]]] = []
        for repo, count in zip(repos, counts):
            if isinstance(count, Exception):
                continue
            scored.append((count, repo))

        scored.sort(key=lambda x: x[0], reverse=True)
        active = [repo for _, repo in scored[:MAX_ACTIVE_REPOS] if scored]
        return active

    async def fetch_metrics(self) -> List[Dict[str, Any]]:
        repos = await self._discover_local_repos()
        if not repos:
            return []

        active_repos = await self._filter_active_repos(repos)
        if not active_repos:
            active_repos = repos[:MAX_ACTIVE_REPOS]

        skipped: List[str] = []
        metrics: List[Dict[str, Any]] = []

        async with httpx.AsyncClient(headers=self.headers) as client:
            for repo in active_repos:
                repo_name = repo["full_name"]
                repo_path = repo["path"]
                default_branch = await self._get_default_branch(repo_path)

                # Single PR list call: derive open count and cycle-time metrics from it.
                prs, _ = await self._get_prs_for_repo(client, repo_name, cache_ttl=1800)
                open_count = sum(1 for p in prs if p.get("state") == "open")
                metrics.append({
                    "source": "github",
                    "metric_type": "open_prs",
                    "entity": repo_name,
                    "value": open_count,
                    "meta": {"default_branch": default_branch},
                    "timestamp": dt.datetime.utcnow().isoformat(),
                })

                try:
                    commits = await self._fetch_commits_from_git(repo_path, days=DEFAULT_GIT_DAYS)
                    for c in commits:
                        author = c["author_name"] or c["author_email"] or "Unknown"
                        metrics.append({
                            "source": "github",
                            "metric_type": "commit",
                            "entity": repo_name,
                            "value": 1,
                            "value_text": author,
                            "meta": {
                                "author_login": c["author_email"].split("@")[0] if c["author_email"] else None,
                                "author_name": c["author_name"],
                                "sha": c["sha"],
                                "message": c["message"],
                                "repo": repo_name,
                                "branch": c.get("branch"),
                                "additions": c["additions"],
                                "deletions": c["deletions"],
                            },
                            "timestamp": c["date"],
                        })
                except Exception as exc:
                    skipped.append(f"{repo_name} git: {exc}")
                    continue

                try:
                    pr_semaphore = asyncio.Semaphore(8)
                    pr_results = await asyncio.gather(*[
                        self._build_pr_event(client, repo_name, pr, pr_semaphore)
                        for pr in prs[:MAX_PRS_PER_REPO]
                    ])
                    for _, pr_metrics in pr_results:
                        metrics.extend(pr_metrics)
                except Exception as exc:
                    skipped.append(f"{repo_name} prs: {exc}")

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

    async def fetch_events(self) -> List[Dict[str, Any]]:
        repos = await self._discover_local_repos()
        if not repos:
            return []

        active_repos = await self._filter_active_repos(repos)
        if not active_repos:
            active_repos = repos[:MAX_ACTIVE_REPOS]

        batch_size = 5
        all_events: List[Dict[str, Any]] = []

        async with httpx.AsyncClient(headers=self.headers) as client:
            for i in range(0, len(active_repos), batch_size):
                batch = active_repos[i:i + batch_size]
                if i > 0:
                    await asyncio.sleep(2)

                batch_results = await asyncio.gather(*[
                    self._fetch_repo_events(client, repo) for repo in batch
                ], return_exceptions=True)

                for res in batch_results:
                    if isinstance(res, Exception):
                        continue
                    all_events.extend(res.get("events", []))

        return all_events

    async def _fetch_repo_events(
        self,
        client: httpx.AsyncClient,
        repo: Dict[str, Any],
    ) -> Dict[str, List[Dict[str, Any]]]:
        repo_name = repo["full_name"]
        events: List[Dict[str, Any]] = []
        metrics: List[Dict[str, Any]] = []

        # Dependabot alerts (cached 10m, 403/404 tolerated).
        try:
            alerts, _ = await self._get(
                client,
                f"{self.base_url}/repos/{repo_name}/dependabot/alerts?per_page={MAX_ALERTS_PER_REPO}",
                cache_key=f"dependabot:{repo_name}",
                cache_ttl_seconds=600,
                headers={"Accept": "application/vnd.github+json"},
                allow_403_404_empty=True,
            )
            for alert in alerts[:MAX_ALERTS_PER_REPO]:
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
        except Exception:
            pass

        # Secret scanning alerts (cached 10m, 403/404 tolerated).
        try:
            secret_alerts, _ = await self._get(
                client,
                f"{self.base_url}/repos/{repo_name}/secret-scanning/alerts?per_page={MAX_ALERTS_PER_REPO}",
                cache_key=f"secretscan:{repo_name}",
                cache_ttl_seconds=600,
                headers={"Accept": "application/vnd.github+json"},
                allow_403_404_empty=True,
            )
            for alert in secret_alerts[:MAX_ALERTS_PER_REPO]:
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
        except Exception:
            pass

        # PR events reuse the same cached PR list as fetch_metrics.
        try:
            prs, _ = await self._get_prs_for_repo(client, repo_name, cache_ttl=1800)
            pr_semaphore = asyncio.Semaphore(8)
            pr_results = await asyncio.gather(*[
                self._build_pr_event(client, repo_name, pr, pr_semaphore)
                for pr in prs[:MAX_PRS_PER_REPO]
            ])
            for event, pr_metrics in pr_results:
                events.append(event)
                metrics.extend(pr_metrics)
        except Exception:
            pass

        return {"events": events, "metrics": metrics}

    async def _get_prs_for_repo(
        self,
        client: httpx.AsyncClient,
        repo_name: str,
        cache_ttl: int = 1800,
    ) -> Tuple[List[Dict[str, Any]], bool]:
        """Fetch PRs updated in the last PR_LOOKBACK_DAYS, cached by ETag."""
        cache_key = f"prs:{repo_name}"
        if cache_key in self._pr_cache:
            return self._pr_cache[cache_key], True

        since = (dt.datetime.utcnow() - dt.timedelta(days=PR_LOOKBACK_DAYS)).isoformat(timespec="seconds")
        url = (
            f"{self.base_url}/repos/{repo_name}/pulls?state=all"
            f"&sort=updated&direction=desc&per_page={MAX_PRS_PER_REPO}"
            f"&since={since}"
        )
        prs, from_cache = await self._get(
            client,
            url,
            cache_key=cache_key,
            cache_ttl_seconds=cache_ttl,
            allow_403_404_empty=True,
        )
        self._pr_cache[cache_key] = prs
        return prs, from_cache

    async def _build_pr_event(
        self,
        client: httpx.AsyncClient,
        repo_name: str,
        pr: Dict[str, Any],
        semaphore: asyncio.Semaphore,
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        pr_number = pr["number"]
        pr_metrics: List[Dict[str, Any]] = []

        # Skip reviews for closed/merged PRs that haven't been updated recently.
        # Their review state is effectively frozen, and GitHub does not charge us
        # anything for data we don't need.
        pr_state = pr.get("state")
        updated_at = pr.get("updated_at")
        skip_reviews = False
        if pr_state != "open" and updated_at:
            try:
                updated_dt = dt.datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
                if (dt.datetime.utcnow().replace(tzinfo=dt.timezone.utc) - updated_dt).days > REVIEW_SKIP_CLOSED_OLDER_THAN_DAYS:
                    skip_reviews = True
            except Exception:
                pass

        async with semaphore:
            reviews: List[Dict[str, Any]] = []
            if not skip_reviews:
                reviews, _ = await self._get_pr_reviews_cached(client, repo_name, pr_number)

            reviewer_logins = sorted({
                r["user"].get("login")
                for r in reviews
                if r.get("user") and r["user"].get("login")
            })
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
            if merged_at and not merged_by.get("login"):
                try:
                    detail, _ = await self._get(
                        client,
                        f"{self.base_url}/repos/{repo_name}/pulls/{pr_number}",
                        cache_key=f"prdetail:{repo_name}:{pr_number}",
                        cache_ttl_seconds=86400,
                    )
                    if detail and isinstance(detail, list) and detail:
                        detail = detail[0]
                    merged_by = detail.get("merged_by") or {} if isinstance(detail, dict) else {}
                except Exception:
                    merged_by = {}

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

    async def _get_pr_reviews_cached(
        self, client: httpx.AsyncClient, repo: str, pr_number: int
    ) -> Tuple[List[Dict[str, Any]], bool]:
        cache_key = f"prreviews:{repo}:{pr_number}"
        if cache_key in self._review_cache:
            return self._review_cache[cache_key], True
        url = f"{self.base_url}/repos/{repo}/pulls/{pr_number}/reviews?per_page=100"
        reviews, from_cache = await self._get(
            client,
            url,
            cache_key=cache_key,
            cache_ttl_seconds=86400,
            allow_403_404_empty=True,
        )
        self._review_cache[cache_key] = reviews
        return reviews, from_cache

    async def _get_open_prs(self, client: httpx.AsyncClient, repo: str) -> List[Dict[str, Any]]:
        """Kept for compatibility; prefer _get_prs_for_repo."""
        prs, _ = await self._get_prs_for_repo(client, repo)
        return [p for p in prs if p.get("state") == "open"]
