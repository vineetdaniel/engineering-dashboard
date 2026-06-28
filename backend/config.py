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
    JIRA_STORY_POINTS_FIELD: str = "customfield_10016"

    OBSERVABILITY_PROVIDER: str = "datadog"

    DD_API_KEY: str = ""
    DD_APP_KEY: str = ""
    DD_SITE: str = "datadoghq.com"
    DD_SERVICES: str = "api-gateway,payments-core,ledger,auth-service,webhook-router"
    DD_ENVIRONMENT: str = "prod"
    DD_UPTIME_QUERY: str = "100 - ( avg:trace.http.request.errors{service:%s,env:%s}.as_count() / avg:trace.http.request.hits{service:%s,env:%s}.as_count() * 100 )"
    DD_LATENCY_QUERY: str = "p95:trace.http.request.duration{service:%s,env:%s,resource_name:*}"
    DD_P99_LATENCY_QUERY: str = "p99:trace.http.request.duration{service:%s,env:%s,resource_name:*}"
    DD_ERROR_RATE_QUERY: str = "( avg:trace.http.request.errors{service:%s,env:%s}.as_count() / avg:trace.http.request.hits{service:%s,env:%s}.as_count() ) * 100"
    DD_TRANSACTION_VOLUME_QUERY: str = "sum:trace.http.request.hits{service:%s,env:%s}.as_count()"

    NR_API_KEY: str = ""
    NR_ACCOUNT_ID: str = ""
    NR_SERVICES: str = "api-gateway,payments-core,ledger,auth-service,webhook-router"
    NR_ENVIRONMENT: str = "prod"
    NR_TRANSACTION_VOLUME_QUERY: str = "SELECT count(*) FROM Transaction WHERE appName = '%s' AND environment = '%s' SINCE 24 hours ago"

    PAGERDUTY_API_KEY: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_SESSION_TOKEN: str = ""
    AWS_REGION: str = "us-east-1"
    AWS_SERVICES: str = "EC2,S3,RDS,Lambda,Data Transfer"
    SLACK_WEBHOOK_URL: str = ""

    JENKINS_URL: str = ""
    JENKINS_USERNAME: str = ""
    JENKINS_API_KEY: str = ""

    MIXPANEL_API_KEY: str = ""
    MIXPANEL_API_SECRET: str = ""
    MIXPANEL_PROJECT_ID: str = ""

    AWS_MONTHLY_BUDGET: str = ""
    AWS_COST_DELTA_THRESHOLD_PCT: str = "25"
    AWS_COST_CRITICAL_RISK_THRESHOLD_PCT: str = "50"
    AWS_COST_TOP_DRIVERS_COUNT: str = "5"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
