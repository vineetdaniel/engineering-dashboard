# Security Policy

## Supported versions

Only the latest version on the main branch is actively supported with security updates.

## Reporting a vulnerability

If you discover a security vulnerability in CTO Dash, please report it privately
instead of opening a public issue or pull request.

Email: **vineetdaniel@gmail.com**

Please include:
- A description of the vulnerability
- Steps to reproduce it
- The potential impact
- Any suggested fix or mitigation

We will acknowledge receipt within 72 hours and work with you to understand and
resolve the issue responsibly.

## Security best practices for deployments

- Never commit `.env` files or credentials to the repository.
- Generate a strong random `SECRET_KEY` for production.
- Set `DATABASE_REQUIRE_SSL=true` when connecting to a managed PostgreSQL service.
- Configure `ALLOWED_ORIGINS` explicitly in production instead of relying on
  development defaults.
- Keep dependencies up to date and review security advisories for Python and
  Node.js packages.

## Disclosure policy

We follow a coordinated disclosure process. Once a fix is released, we will
publish a security advisory describing the issue, its impact, and the fix.
