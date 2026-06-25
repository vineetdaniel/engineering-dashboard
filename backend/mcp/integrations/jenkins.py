import datetime as dt
from typing import Any, Dict, List

import httpx

from backend.mcp.integrations.base import Connector


class JenkinsConnector(Connector):
    name = "jenkins"
    required_env = ["JENKINS_URL", "JENKINS_API_KEY"]

    def __init__(self, config: Dict[str, Any] | None = None):
        self.base_url = (config.get("JENKINS_URL", "") if config else "").rstrip("/")
        self.api_key = config.get("JENKINS_API_KEY", "") if config else ""
        self.username = (config.get("JENKINS_USERNAME", "") if config else "") or "cto-dash"
        self.timeout = 30.0

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Accept": "application/json",
        }

    def _basic_headers(self) -> Dict[str, str]:
        import base64
        creds = base64.b64encode(f"{self.username}:{self.api_key}".encode()).decode()
        return {
            "Authorization": f"Basic {creds}",
            "Accept": "application/json",
        }

    def _url(self, path: str) -> str:
        if path.startswith("http://") or path.startswith("https://"):
            return path
        return f"{self.base_url}{path}"

    def _normalize_url(self, url: str | None) -> str:
        if not url:
            return ""
        # Jenkins often returns job URLs with its own (possibly internal) hostname.
        # Rewrite them to use the configured base URL so DNS/auth stay consistent.
        if url.startswith("/"):
            return f"{self.base_url.rstrip('/')}{url}"
        try:
            from urllib.parse import urlparse, urlunparse
            parsed = urlparse(url)
            base_parsed = urlparse(self.base_url)
            normalized = parsed._replace(
                scheme=base_parsed.scheme,
                netloc=base_parsed.netloc,
            )
            return urlunparse(normalized)
        except Exception:
            return url

    async def health_check(self) -> Dict[str, Any]:
        if not self.base_url or not self.api_key:
            return {"ok": False, "error": "JENKINS_URL and JENKINS_API_KEY required"}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                r = await self._get_with_fallback(
                    client, "/api/json?tree=mode,numExecutors,views[name]"
                )
                r.raise_for_status()
                data = r.json()
                return {
                    "ok": True,
                    "error": None,
                    "mode": data.get("mode"),
                    "views": [v.get("name") for v in data.get("views", [])[:5]],
                }
            except httpx.HTTPStatusError as exc:
                return {"ok": False, "error": f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"}
            except Exception as exc:
                return {"ok": False, "error": str(exc)}

    async def fetch_metrics(self) -> List[Dict[str, Any]]:
        jobs = await self._fetch_jobs()
        metrics: List[Dict[str, Any]] = []
        now = dt.datetime.utcnow()
        now_iso = now.isoformat()
        total_success = 0
        total_failure = 0
        total_duration = 0.0
        build_count = 0

        # Collect enough history to compute DORA metrics (30-day window).
        window_start = now - dt.timedelta(days=30)
        all_completed_builds: List[Dict[str, Any]] = []

        for job in jobs:
            job_name = job.get("name", "unknown")
            job_url = self._normalize_url(job.get("url", ""))
            color = job.get("color", "")
            builds = await self._fetch_builds(job_url, limit=20)
            last_build = builds[0] if builds else None

            # Derive status from color when no recent build data exists.
            status = self._status_from_color(color)
            if last_build:
                status = last_build.get("result", "UNKNOWN") or status
                duration_ms = last_build.get("duration", 0)
                total_duration += duration_ms
                build_count += 1
                if status == "SUCCESS":
                    total_success += 1
                elif status in ("FAILURE", "ABORTED", "UNSTABLE"):
                    total_failure += 1
                metrics.append({
                    "source": "jenkins",
                    "metric_type": "build_duration_ms",
                    "entity": job_name,
                    "value": float(duration_ms),
                    "meta": {
                        "job_url": job_url,
                        "build_number": last_build.get("number"),
                        "build_url": last_build.get("url"),
                        "status": status,
                    },
                    "timestamp": self._parse_timestamp(last_build.get("timestamp")),
                })

            metrics.append({
                "source": "jenkins",
                "metric_type": "build_status",
                "entity": job_name,
                "value": 1.0 if status == "SUCCESS" else 0.0,
                "meta": {"job_url": job_url, "color": color, "status": status},
                "timestamp": now_iso,
            })

            for build in builds:
                ts = self._parse_dt(build.get("timestamp"))
                if ts and ts >= window_start:
                    result = build.get("result")
                    if result and result != "IN_PROGRESS":
                        all_completed_builds.append({
                            "job": job_name,
                            "number": build.get("number"),
                            "result": result,
                            "timestamp": ts,
                            "url": build.get("url"),
                        })

        # Aggregate pipeline health
        if build_count:
            metrics.append({
                "source": "jenkins",
                "metric_type": "ci_pass_rate",
                "entity": "jenkins",
                "value": round((total_success / build_count) * 100, 2),
                "meta": {"successful": total_success, "failed": total_failure, "total": build_count},
                "timestamp": now_iso,
            })
            metrics.append({
                "source": "jenkins",
                "metric_type": "ci_avg_duration_ms",
                "entity": "jenkins",
                "value": round(total_duration / build_count, 2),
                "meta": {"total_duration_ms": total_duration, "build_count": build_count},
                "timestamp": now_iso,
            })

        # DORA metrics from 7-day build history.
        dora_metrics = self._derive_dora_metrics(all_completed_builds, now)
        metrics.extend(dora_metrics)

        return metrics

    def _derive_dora_metrics(
        self, builds: List[Dict[str, Any]], now: dt.datetime
    ) -> List[Dict[str, Any]]:
        now_iso = now.isoformat()
        completed = [b for b in builds if b["result"] not in ("IN_PROGRESS", "NOT_BUILT", "ABORTED")]
        if not completed:
            return []

        failed_results = {"FAILURE", "UNSTABLE"}
        failed = [b for b in completed if b["result"] in failed_results]
        change_failure_rate = (len(failed) / len(completed)) * 100 if completed else 0

        # MTTR: for each failure, find the next success in the same job.
        recovery_minutes: List[float] = []
        by_job: Dict[str, List[Dict[str, Any]]] = {}
        for b in sorted(completed, key=lambda x: x["timestamp"]):
            by_job.setdefault(b["job"], []).append(b)

        for job_builds in by_job.values():
            for i, build in enumerate(job_builds):
                if build["result"] in failed_results:
                    # Look ahead for the next success.
                    for next_build in job_builds[i + 1 :]:
                        if next_build["result"] == "SUCCESS":
                            delta = (next_build["timestamp"] - build["timestamp"]).total_seconds() / 60.0
                            if delta >= 0:
                                recovery_minutes.append(delta)
                            break

        median_mttr = sorted(recovery_minutes)[len(recovery_minutes) // 2] if recovery_minutes else 0

        # Flaky tests heuristic: jobs that failed at least once and then succeeded
        # within the same day without a code change (approximated by same day).
        flaky_candidates = 0
        for job_builds in by_job.values():
            day_groups: Dict[str, List[Dict[str, Any]]] = {}
            for b in job_builds:
                day = b["timestamp"].strftime("%Y-%m-%d")
                day_groups.setdefault(day, []).append(b)
            for day_builds in day_groups.values():
                results = [b["result"] for b in day_builds]
                if "SUCCESS" in results and any(r in failed_results for r in results):
                    flaky_candidates += 1

        return [
            {
                "source": "jenkins",
                "metric_type": "change_failure_rate",
                "entity": "jenkins",
                "value": round(change_failure_rate, 2),
                "meta": {"failed": len(failed), "total": len(completed), "window_days": 30},
                "timestamp": now_iso,
            },
            {
                "source": "jenkins",
                "metric_type": "mttr_minutes",
                "entity": "jenkins",
                "value": round(median_mttr, 2),
                "meta": {"recoveries": len(recovery_minutes), "window_days": 30},
                "timestamp": now_iso,
            },
            {
                "source": "jenkins",
                "metric_type": "flaky_tests",
                "entity": "jenkins",
                "value": flaky_candidates,
                "meta": {"note": "jobs with same-day failure-then-success pattern", "window_days": 30},
                "timestamp": now_iso,
            },
        ]

    async def fetch_events(self) -> List[Dict[str, Any]]:
        jobs = await self._fetch_jobs()
        events: List[Dict[str, Any]] = []
        for job in jobs:
            job_name = job.get("name", "unknown")
            job_url = job.get("url", "")
            builds = await self._fetch_builds(job_url, limit=10)
            for build in builds:
                result = build.get("result") or "IN_PROGRESS"
                if result in ("SUCCESS", "IN_PROGRESS"):
                    continue
                severity = "high" if result == "FAILURE" else "medium"
                events.append({
                    "source": "jenkins",
                    "event_type": "ci_failure",
                    "entity": job_name,
                    "title": f"Build #{build.get('number')} {result} for {job_name}",
                    "severity": severity,
                    "status": "open" if result == "FAILURE" else "resolved",
                    "meta": {
                        "job_url": job_url,
                        "build_number": build.get("number"),
                        "build_url": build.get("url"),
                        "result": result,
                        "duration_ms": build.get("duration"),
                    },
                    "happened_at": self._parse_timestamp(build.get("timestamp")),
                })
        return events

    async def _fetch_jobs(self, parent_url: str | None = None) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            path = f"{parent_url.rstrip('/')}/api/json?tree=jobs[name,url,color]" if parent_url else "/api/json?tree=jobs[name,url,color]"
            r = await self._get_with_fallback(client, path)
            r.raise_for_status()
            jobs = r.json().get("jobs", [])

        # Recurse into folders (cloudbees-folder jobs have no color or color="none").
        leaf_jobs: List[Dict[str, Any]] = []
        for job in jobs:
            color = job.get("color") or ""
            if color in ("", "none", "notbuilt") and self._looks_like_folder(job):
                sub_url = self._normalize_url(job.get("url", ""))
                if sub_url:
                    leaf_jobs.extend(await self._fetch_jobs(sub_url))
            else:
                leaf_jobs.append(job)
        return leaf_jobs

    @staticmethod
    def _looks_like_folder(job: Dict[str, Any]) -> bool:
        # Folder jobs usually have _class containing "Folder" or "WorkflowMultiBranch".
        cls = (job.get("_class") or "").lower()
        return "folder" in cls or "multibranch" in cls or "organization" in cls

    async def _fetch_builds(self, job_url: str, limit: int = 5) -> List[Dict[str, Any]]:
        base = self._normalize_url(job_url).rstrip("/").split("?")[0]
        if not base:
            return []
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            # Try the compact tree query first (efficient on modern Jenkins).
            r = await self._get_with_fallback(
                client,
                f"{base}/api/json?tree=builds[number,url,result,duration,timestamp]{{{limit}}}",
            )
            # Some Jenkins versions / auth setups reject the tree query; fall back to full payload.
            if r.status_code in (404, 403, 500):
                r = await self._get_with_fallback(client, f"{base}/api/json?depth=1")
            if r.status_code in (404, 403):
                return []
            r.raise_for_status()
            try:
                data = r.json()
            except Exception:
                return []
            builds = data.get("builds", [])
            # If depth=1 returned allBuilds, use that instead.
            if not builds:
                builds = data.get("allBuilds", [])
            return builds[:limit]

    async def _get_with_fallback(self, client: httpx.AsyncClient, path: str) -> httpx.Response:
        url = self._url(path)
        r = await client.get(url, headers=self._headers())
        if r.status_code in (401, 403, 302):
            r = await client.get(url, headers=self._basic_headers())
        return r

    @staticmethod
    def _status_from_color(color: str | None) -> str:
        if not color:
            return "UNKNOWN"
        if "blue" in color:
            return "SUCCESS"
        if "red" in color:
            return "FAILURE"
        if "yellow" in color:
            return "UNSTABLE"
        if "notbuilt" in color or "disabled" in color:
            return "NOT_BUILT"
        if "aborted" in color:
            return "ABORTED"
        return "UNKNOWN"

    @staticmethod
    def _parse_timestamp(ts: Any) -> str:
        if not ts:
            return dt.datetime.utcnow().isoformat()
        try:
            return dt.datetime.utcfromtimestamp(int(ts) / 1000.0).isoformat()
        except Exception:
            return dt.datetime.utcnow().isoformat()

    @staticmethod
    def _parse_dt(ts: Any) -> dt.datetime | None:
        if not ts:
            return None
        try:
            return dt.datetime.utcfromtimestamp(int(ts) / 1000.0)
        except Exception:
            return None
