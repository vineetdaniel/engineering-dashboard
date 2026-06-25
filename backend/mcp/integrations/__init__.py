from backend.mcp.integrations.aws_cost import AWSCostConnector
from backend.mcp.integrations.github import GitHubConnector
from backend.mcp.integrations.jenkins import JenkinsConnector
from backend.mcp.integrations.jira import JiraConnector
from backend.mcp.integrations.observability import ObservabilityConnector

CONNECTORS = {
    "aws_cost": AWSCostConnector,
    "github": GitHubConnector,
    "jenkins": JenkinsConnector,
    "jira": JiraConnector,
    "observability": ObservabilityConnector,
}

__all__ = [
    "CONNECTORS",
    "AWSCostConnector",
    "GitHubConnector",
    "JenkinsConnector",
    "JiraConnector",
    "ObservabilityConnector",
]
