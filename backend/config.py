from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me"
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/ctodash"
    REDIS_URL: str = "redis://localhost:6379/0"

    GITHUB_TOKEN: str = ""
    GITHUB_ORG: str = ""

    JIRA_SERVER: str = ""
    JIRA_USERNAME: str = ""
    JIRA_API_TOKEN: str = ""
    JIRA_PROJECT_KEYS: str = ""

    OBSERVABILITY_PROVIDER: str = "datadog"

    DD_API_KEY: str = ""
    DD_APP_KEY: str = ""
    DD_SITE: str = "datadoghq.com"

    NR_API_KEY: str = ""
    NR_ACCOUNT_ID: str = ""

    PAGERDUTY_API_KEY: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    SLACK_WEBHOOK_URL: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
