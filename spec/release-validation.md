# Prototype release validation — 2026-10-13

The React/Express/PostgreSQL prototype is ready for local stakeholder review.
Production deployment and live account validation remain open. Authoritative
MVP decisions are in [clarify.md](./clarify.md) and mirrored in
[specification.md](./specification.md), section 2.4. The requirement-by-requirement
review and dispositions are in [checklist.md](./checklist.md).

## Evidence

- `DATABASE_URL=postgresql://dashboard:dashboard@127.0.0.1:5432/dashboard npm test`:
  **107 tests passed, none failed or skipped**, across 18 files. PostgreSQL 15
  tests cover three idempotent migrations, widget/viewer isolation, manual
  observations, expiry and cascading tenant deletion.
- `tests/backend/releaseFlow.test.ts` exercises HTTP routes, Jira parsing,
  sprint rules, provider normalization, refresh client and React rendering with
  synthetic responses. Editor configuration verifies board access and source
  readiness; non-editors cannot save.
- `tests/backend/checklistFixes.test.ts` covers failure isolation, per-field
  completeness, installation-bound secrets, safe duration/category logs,
  concurrent deduplication/capacity, original provider names/definitions, host
  module validation, widget cache invalidation and real database history.
- `tests/frontend/Dashboard.interactions.test.tsx` mounts the actual dashboard
  and configuration controls in a DOM: active/history changes, save/cancel,
  permission states and manual-only cache bypass. Frontend state regressions
  cover original timestamps, mixed partial results, clock ageing and clearing
  protected retained data after denial.
- `npm run test:walkthrough`: **21 local Chrome checks passed**, with synthetic
  Jira/provider/context and real PostgreSQL persistence. Screens, configuration,
  sprint/date/source controls, zero/empty/partial/stale states, role boundaries,
  500-issue pagination, mobile overflow and keyboard activation were checked.
  There were no uncaught browser errors. See [the walkthrough](./walkthrough.md)
  and [machine-readable results](../reports/walkthrough/results.json).
- `npm run lint`, `npm run typecheck`, `npm run build` and
  `npm run format:check` passed. Formatting covers nested source/test files.
- `python3 scripts/validate_markdown.py` verifies all project Markdown files;
  see [the validation report](../reports/markdown-validation.md).

## Retention and removal

Widget configuration and justified timestamped sprint counts persist in
PostgreSQL. Migration `003_sprint_observations.sql` stores only remaining issue
counts, scoped by installation/widget/viewer/board/sprint. Complete, classified
reports become observations only on explicit manual refresh (`no-cache`).
Initial loads read existing observations and create none. No issue summaries,
assignee identities or full provider payloads are persisted.

History returns at most the latest 500 observations younger than 30 days;
startup, history reads and an hourly housekeeping job delete expired records.
The job performs deletion only, not scheduled source refresh. Operational
monitoring must keep housekeeping running; records expired during downtime are
removed on restart. The chart labels provenance, observation time and coverage,
and invents no points before the first collected observation.

Provider reports stay in memory, bounded to 500 entries, served for at most
six hours and physically deleted after 24 hours. Responses use `private,
no-store`; initial frontend loads may reuse the scoped server cache and manual
refresh bypasses it. Configuration changes purge the widget's usage cache and
prevent previously running retrievals from repopulating it. No provider
snapshots are persisted.

The trusted host must deliver a verified installation-removal event to
`app.locals.purgeInstallationData(installationId)`. It blocks the installation
and invalidates cache before deleting installation records, cascading widget
configuration and count observations. Removed IDs remain blocked in that
process; a new installation must receive a new ID. Retry failed database deletion.
Provider credentials must be revoked by the external host secret manager.
There is no public tenant-deletion endpoint.

## Host integration contract

The CLI loads the deployment-controlled absolute local module path in
`DASHBOARD_HOST_MODULE`. That module must export `resolveViewerContext` and may
export `registerInstallationRemoval(callback)` to subscribe to verified removal
events. Alternatively, supply the resolver when creating `createApp(pool,
options)` from `backend/src/server.ts` and wire its purge callback directly.

The resolver must verify the authenticated session, Confluence page access,
widget binding, editor/admin role and viewer-scoped Jira token server-side.
Use `canEdit: true` only for verified page editors; verified admins can also
configure the widget. Browser headers/query parameters cannot establish identity.
Absent/malformed host integration fails closed. This contract and loader are
implemented; the actual Confluence macro/session verifier is deployment-specific
and remains a real release gap.

Set `DASHBOARD_INSTALLATION_ID` to the trusted installation that owns the
protected environment credentials and `GITHUB_ENTERPRISE_SLUG`. The environment
secret store rejects absent or different installation IDs. The default deployment
serves one approved tenant and organization per provider; a multi-tenant host
must inject its own installation-scoped secret store and provider adapters.
Credential presence is not account verification. Configuration enables only
sources whose live readiness probe verifies usable allowlisted reporting access.
A partial source with supported metrics remains selectable; wholly unsupported
coverage stays unavailable. Actual reporting still records
unsupported fields/dates rather than claiming complete account coverage.

Serve frontend/API on the same origin. Vite proxies `/api` to port 3000 locally.
The frontend loads trusted configuration and bounded sprint pages, selects active
sprints, and exposes historical selection, editable usage dates and source
checkboxes. Page editors get a non-secret configuration form with paginated
board choices, ready-source checkboxes, validated preferences, save and cancel.
Admins additionally see source readiness. All source refreshes are manual;
the frontend clock only ages the displayed state.

## Remaining release gates

- P1: Integrate and verify the Confluence host verifier, embedding and uninstall.
- P2: Validate a real authorized board, workflow and each provider organization,
  including account-specific date bounds and least-privilege credentials.
- P3: Verify screen-reader behavior and Confluence embedding, and measure live
  initial render performance. Local Chrome keyboard/mobile checks and the
  500-issue/three-provider mock load target passed; synthetic timing does not
  establish production performance.
- P4: Complete deployment security, terms, retention/residency, protected secret
  lifecycle review and stakeholder sign-off.

Synthetic integration, DOM and Chrome walkthrough tests establish local prototype behavior. They do
not prove live provider permissions, Confluence hosting or production readiness.
