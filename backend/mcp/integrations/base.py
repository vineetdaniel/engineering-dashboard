from abc import ABC, abstractmethod
from typing import Any, Dict, List


class Connector(ABC):
    name: str = ""
    required_env: List[str] = []

    @abstractmethod
    async def health_check(self) -> Dict[str, Any]:
        """Return {ok: bool, error: str | None}."""
        ...

    @abstractmethod
    async def fetch_metrics(self) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    async def fetch_events(self) -> List[Dict[str, Any]]:
        ...
