# MCP Connectors

## Available connectors

| Connector    | Env vars required                              | Notes                                   |
|--------------|------------------------------------------------|-----------------------------------------|
| `github`     | `GITHUB_TOKEN`, `GITHUB_ORG`                   | Pulls open PRs and Dependabot alerts.    |
| `jira`       | `JIRA_SERVER`, `JIRA_USERNAME`, `JIRA_API_TOKEN`, `JIRA_PROJECT_KEYS` | Jira Cloud REST API v3.                |
| `observability` | `OBSERVABILITY_PROVIDER`                    | `datadog` or `newrelic`.                |

## Running the MCP server

```bash
python -m backend.mcp.server
```

## Configuration

Edit `.env` based on `.env.example`. Set `OBSERVABILITY_PROVIDER=datadog` for now; `newrelic` is ready to be configured later.
