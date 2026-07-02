# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial open-source release of CTO Dash.
- Next.js 15 frontend with nine dashboard sections: Overview, Engineering, Product, Operations, Payments, Security, Compliance, Cost, and Team.
- FastAPI backend with SQLAlchemy/PostgreSQL data model and auto-seeding.
- MCP server and connector integrations for GitHub, Jira, Datadog, New Relic, AWS Cost, Jenkins, and Mixpanel.
- Celery workers and beat scheduler for hourly connector sync.
- Sprint planning module with resource allocation, task tracking, and Jira import.
- Security hardening: CORS restrictions, security headers, DB SSL/pool options, and query sanitization.
- README with installation guide, feature overview, and screenshot gallery.
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, LICENSE (MIT), issue templates, and pull request template.

## [0.1.0] - 2026-07-02

- First tagged release.
