# Contributing to CTO Dash

Thanks for your interest in contributing! CTO Dash is an open-source fintech engineering command center, and we welcome contributions from developers, designers, security engineers, and operators.

## Getting started

1. **Fork the repository** and clone your fork.
2. **Set up your local environment** by following the [Installation](README.md#installation) guide in `README.md`.
3. **Create a branch** for your work: `git checkout -b feature/your-feature-name`.
4. **Make your changes**, commit them, and push to your fork.
5. **Open a Pull Request** against the main repository with a clear description.

## Development setup

The fastest way to run the project locally:

```bash
cp .env.example .env
docker-compose up -d

# Backend
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.api.main:app --reload --port 8000

# Frontend (in a separate shell)
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to contribute

### Areas where help is welcome

- **New connectors** — add support for observability, cost, CI/CD, or compliance tools.
- **Dashboard widgets** — build new visualizations for existing or new sections.
- **Security improvements** — audits, dependency updates, secure defaults.
- **Bug fixes and performance** — optimize SQL rollups, API calls, or frontend rendering.
- **Documentation** — README improvements, setup guides, connector docs.
- **Tests** — the project is just starting its test suite; additions are highly valued.

### Adding a connector

1. Subclass `Connector` in `backend/mcp/integrations/`.
2. Implement `health_check()`, `fetch_metrics()`, and `fetch_events()`.
3. Register it in `backend/mcp/integrations/__init__.py`.
4. Add defaults, required fields, and secret keys to `backend/config_store.py`.
5. Add a setup guide entry in `backend/api/main.py` inside `_GUIDES`.
6. Update `docs/MCP.md` and `README.md`.

See the existing connectors for examples.

### Adding a widget

1. Create a React component in `frontend/components/widgets/`.
2. Accept `SectionProps` (or a subset) defined in `frontend/components/sections/types.ts`.
3. Re-export from `frontend/components/widgets/index.ts` if other widgets need it.
4. Add it to the relevant section in `frontend/components/sections/`.
5. Use `frontend/components/Widget.tsx` for consistent card styling.

### Code style

- **Python:** Follow PEP 8. Run `python -m compileall backend` before submitting.
- **TypeScript / React:** Follow the existing component patterns. Run `npm run build` and `npm run lint` from the `frontend/` directory.
- **Commits:** Write concise, descriptive commit messages in the imperative mood.

## Before submitting a Pull Request

- [ ] Your branch is up to date with the main branch.
- [ ] Backend compiles: `python -m compileall backend`.
- [ ] Frontend builds cleanly: `cd frontend && npm run build`.
- [ ] Frontend lint passes: `cd frontend && npm run lint`.
- [ ] You have not committed secrets, `.env` files, or local backups.
- [ ] You have updated relevant documentation (`README.md`, `docs/`, `CLAUDE.md`).

## Reporting issues

- Use GitHub Issues to report bugs, request features, or ask questions.
- For security issues, please email the maintainers directly instead of opening a public issue.

## Community

- Be respectful and constructive.
- Assume good intent.
- Focus on what is best for the project and its users.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](../LICENSE).

---

Maintained by Vineet Daniel and contributors.
