from backend.mcp.integrations.github import GitHubConnector
from backend.mcp.integrations.jira import JiraConnector
from backend.mcp.integrations.observability import ObservabilityConnector

CONNECTORS = {
    "github": GitHubConnector,
    "jira": JiraConnector,
    "observability": ObservabilityConnector,
}

__all__ = ["CONNECTORS", "GitHubConnector", "JiraConnector", "ObservabilityConnector"]
