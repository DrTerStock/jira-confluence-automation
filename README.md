# Jira/Confluence Dashboard

Prototype foundation for a Confluence-embedded Jira sprint and AI usage
dashboard. The application uses React 18 with Vite, Node.js with Express, and
PostgreSQL 15 for local development.

## Prerequisites

- Node.js 20.19 or newer and npm
- Docker Engine with the Docker Compose plugin

## Local setup

1. Copy `.env.example` to `.env`. The checked-in example contains local-only
   development defaults; replace them with private values if needed.
2. Start PostgreSQL 15 with `docker compose up -d postgres`.
3. Install JavaScript dependencies with `npm ci` (or `npm install` before a
   lockfile has been generated).
4. Start the backend with `npm run dev --workspace backend`.
5. In another terminal, start the frontend with
   `npm run dev --workspace frontend`.
6. Open the Vite URL printed by the frontend development server. The backend
   liveness endpoint is `http://localhost:3000/healthz`; readiness is
   `http://localhost:3000/readyz`.

Local Compose credentials are for development only. Never commit `.env`, real
provider credentials, or production secrets. In production, provider
credentials must be injected from the deployment's protected secret store as
`GITHUB_COPILOT_TOKEN`, `OPENAI_ADMIN_API_KEY`, and
`ANTHROPIC_ADMIN_API_KEY`. GitHub Copilot reporting also requires
`GITHUB_ENTERPRISE_SLUG` and an enterprise token allowed to view Copilot
metrics. Anthropic organization analytics require the `read:analytics` scope
and an eligible Claude Enterprise organization.
Provider readiness is exposed to authenticated administrators at
`/api/v1/admin/sources`; the response never includes credential values. The
prototype does not accept provider secrets in the browser or persist them in
PostgreSQL. Confluence authentication/embedding and Jira authorization still
require verified deployment integration.

## Validation

Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and
`npm run format:check` from the repository root. The CI workflow runs lint,
typecheck, tests, and builds against PostgreSQL 15.

The prototype reports credential presence separately from verified provider
access. Provider adapters probe usable reporting access before a source can be
enabled.

## Prototype integration and release status

The frontend now loads trusted widget configuration, active and historical
sprints, and Jira/provider reports. Its date controls select the usage window;
manual refresh preserves successful source data after failures. Page editors
can configure boards, ready providers and approved preferences through the UI
and `PUT /api/v1/dashboard/config`; both accept only non-secret fields.

Set `DASHBOARD_INSTALLATION_ID` to the approved tenant owning the backend
provider credentials. Other tenants cannot read those credentials. Load the
deployment-controlled local host module using `DASHBOARD_HOST_MODULE`; it must
verify Confluence session/page/editor/admin/widget context and viewer Jira access.
Dashboard requests fail closed until that host integration is supplied. Manual
refresh also collects complete viewer-scoped sprint counts for dated burndown
history, retained for at most 30 days in returned history with hourly expiry. See [release validation](spec/release-validation.md)
for the `createApp` integration contract, tenant-removal callback, retention
policy, automated evidence and remaining live deployment gates.

## Mock walkthrough

For review without Jira, Confluence or provider credentials:

```sh
docker compose up -d postgres
npm ci
npm run dev:demo
```

Open <http://127.0.0.1:5174>. This command starts a separate mock backend on
port 4100 and frontend on port 5174. Jira, provider data and viewer context are
synthetic; configuration and manual count history use real local PostgreSQL.
The yellow demo toolbar selects roles, widgets and failure scenarios. It is
available only through this separate development entry point. The normal
backend continues to require a verified host integration.

Follow [the screen-by-screen guide](spec/walkthrough.md). Stop the demo with
Ctrl+C to remove its isolated fixture tenant. A fresh start resets the demo.

To reproduce the Chrome checks, also start the normal backend and frontend
using the local setup above, restart the demo so `new-widget` is unconfigured,
and run `npm run test:walkthrough`. The runner uses installed Google Chrome;
set `CHROME_PATH` if its executable is elsewhere. It saves screenshots and
[results](reports/walkthrough/results.json). Browser fixtures do not verify
real account permissions, Confluence embedding or production performance.
