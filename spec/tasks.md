# Task Breakdown

This document converts the implementation plan in [plan.md](./plan.md) into discrete engineering tasks for the MVP. Each task includes a title, description, acceptance criteria, and dependencies.

## Task 1 — Set up the project foundation

### Description
Initialize the frontend, backend, and local data stack for the MVP. Establish a working development environment, shared configuration conventions, and a baseline CI pipeline.

### Acceptance criteria
- The project has a frontend app using React 18 + Vite.
- The project has a backend app using Node.js + Express.
- PostgreSQL 15 runs in Docker and is configured for local development.
- Local environment variables and safe secret handling conventions are documented.
- Basic lint, typecheck, and test commands run successfully in CI or local validation.
- Developers can start the app locally and confirm a basic app shell loads.

### Dependencies
- None

## Task 2 — Define the configuration schema and persistence model

### Description
Create the data model for widget configuration, selected Jira board, provider enablement, and non-secret preferences. Persist these values in PostgreSQL with a versioned schema.

### Acceptance criteria
- A versioned widget configuration record exists for the dashboard instance.
- The schema stores one Jira board selection and zero or more enabled provider IDs.
- No secrets or API tokens are stored in the widget configuration model.
- The backend validates configuration at read/write time.
- The schema supports future migrations without breaking existing config entries.
- Admins can read/write only the approved non-secret fields.

### Dependencies
- Task 1

## Task 3 — Build the dashboard shell UI

### Description
Create the dashboard shell structure for the Confluence-embedded view, including the sprint selector, summary, blockers, burndown panel, and AI usage panel containers.

### Acceptance criteria
- A dashboard layout renders in the frontend shell.
- The page includes sections for sprint controls, summary, blockers, burndown, and provider usage.
- UI states have placeholder rendering for loading, empty, partial, stale, unavailable, and error conditions.
- The layout is keyboard-accessible and uses semantic headings/structure.
- No status is communicated by color alone.

### Dependencies
- Task 1
- Task 2

## Task 4 — Implement Jira board and sprint retrieval

### Description
Build backend functionality to list Jira boards and the available sprints for a selected board, while enforcing viewer permissions.

### Acceptance criteria
- The backend can list Jira boards visible to the current user.
- The backend can list sprints for a configured board.
- The active sprint is identified when Jira reports one.
- The app rejects unauthorized board access with a safe error state.
- Sprint list responses include names, dates, and state metadata.

### Dependencies
- Task 1
- Task 2

## Task 5 — Implement sprint issue filtering and summary calculations

### Description
Retrieve Jira issues for the selected sprint and calculate the sprint summary using the MVP rules: stories, tasks, and bugs only; issue count as the default unit; optional story points only when valid.

### Acceptance criteria
- The app includes stories, tasks, and bugs for the selected sprint.
- Epics and subtasks are excluded from counts and totals.
- Completed and remaining work are calculated using issue count by default.
- Story points are included only when a valid estimate field is configured and the board uses it.
- Unestimated work is shown as "Not estimated" instead of zero.
- The UI displays the selected sprint name and available date range.

### Dependencies
- Task 4

## Task 6 — Implement blocker detection and blocked issue listing

### Description
Create the logic for blocker detection using explicit project-configured mapping, then display blocked issues in the dashboard.

### Acceptance criteria
- Blocked issue detection uses an explicit Jira or project mapping, not assumptions.
- If no mapping exists, the UI shows the blocked count as unavailable rather than guessing.
- The dashboard displays blocked issue metadata including key, summary, status, assignee, and Jira link when available.
- Blocked issues are only included when they belong to the selected sprint and relevant scope.

### Dependencies
- Task 5

## Task 7 — Implement burndown coverage handling

### Description
Add burndown handling for valid historical observations and an explicit unavailable state when there is no trustworthy historical data.

### Acceptance criteria
- The dashboard shows a burndown visualization only when dated observations exist.
- The chart includes provenance and valid coverage dates.
- The app never fabricates pre-history points.
- If burndown history is unavailable, the UI clearly shows a "burndown history unavailable" message.
- The dashboard still shows the current completion summary when burndown is unavailable.

### Dependencies
- Task 5

## Task 8 — Implement source readiness and admin configuration flow

### Description
Provide backend admin endpoints and UI status semantics for configured provider readiness, including missing credentials, insufficient permissions, unsupported metrics, and transient errors.

### Acceptance criteria
- The backend can report provider readiness status for each configured source.
- The admin flow exposes only safe status and non-secret metadata.
- Credentials are stored only in the secure backend secret store.
- Source readiness distinguishes configured, missing credentials, permission denied, unsupported coverage, and transient failure.
- The UI for configuration does not include any secret fields.

### Dependencies
- Task 2
- Task 1

## Task 9 — Implement provider adapters for GitHub Copilot, OpenAI, and Anthropic

### Description
Build the provider adapters and shared logic required to query provider data from the backend using server-side credentials.

### Acceptance criteria
- Each provider adapter can issue authorized read-only queries for the supported reporting window.
- Each provider returns normalized output with source ID, status, requested period, actual period, last successful retrieval, and metric list.
- Unsupported metrics are explicitly flagged as unsupported.
- Provider outputs are normalized using the approved internal shape.
- The backend validates provider selection and rejects unconfigured or unauthorized sources.

### Dependencies
- Task 8

## Task 10 — Implement provider metric allowlist and compatibility rules

### Description
Define the MVP allowlist and compatibility logic to ensure only verified metrics are displayed, and incompatible metrics are never aggregated together.

### Acceptance criteria
- Only allowlisted provider metrics are shown in the UI.
- Unsupported metrics are labeled as unsupported, not zero.
- Successful zero values remain valid and distinct from missing values.
- Any totals are only produced for same-metric, same-unit, same-currency definitions.
- Different currencies are never combined in the MVP.

### Dependencies
- Task 9

## Task 11 — Implement manual refresh and stale-state behavior

### Description
Build manual dashboard refresh, preserving the last successful data state when refresh fails and surfacing stale status clearly.

### Acceptance criteria
- A user can trigger a manual refresh for the dashboard data.
- Refresh respects Jira and provider rate limits.
- A failed refresh does not overwrite a successful result with a success-shaped fallback.
- Stale data remains visible with a clear stale warning and last successful timestamp.
- The backend emits a safe correlation ID for refresh operations.

### Dependencies
- Task 5
- Task 9

## Task 12 — Build the AI usage panel and source status presentation

### Description
Create the UI view for provider usage, team totals, and source state messaging. The panel must clearly distinguish zero, empty, partial, stale, unavailable, and failed conditions.

### Acceptance criteria
- The AI usage panel renders per-provider metrics and source summaries.
- Team totals are shown only when units and metric definitions are compatible.
- Unsupported metrics are separated from valid values and are clearly marked.
- UI states visibly distinguish zero vs empty vs unavailable vs failed.
- Successful provider data remains visible when another provider fails.

### Dependencies
- Task 10
- Task 11

## Task 13 — Implement secure backend auth and authorization checks

### Description
Apply server-side validation so viewers only receive data they are allowed to access and site admins can manage readiness without exposing secrets.

### Acceptance criteria
- All backend operations validate the current user context from trusted auth.
- Jira data access respects the viewer’s Jira permissions.
- Confluence page access rules are enforced before returning dashboard data.
- Secrets never appear in browser responses, URLs, or logs.
- Unauthorized requests return safe, user-appropriate error states.

### Dependencies
- Task 4
- Task 8
- Task 9

## Task 14 — Implement cache, retention, and purge behaviors

### Description
Add short-lived cache handling and retention rules that protect privacy and reduce unnecessary repeated data requests.

### Acceptance criteria
- Cached results include source metadata, requested period, actual period, retrieval time, and completeness.
- Cache entries expire after the configured short-lived threshold.
- Provider usage snapshots and Jira sprint snapshots are retained only for the approved MVP window.
- Tenant removal triggers purge of tenant-scoped records.
- Logs exclude raw provider payloads and unnecessary personal data.

### Dependencies
- Task 9
- Task 11

## Task 15 — Write tests for Jira and provider behavior

### Description
Add focused automated tests for business rules, status mapping, authorization, provider normalization, and edge cases in the MVP.

### Acceptance criteria
- Test coverage includes Jira issue filtering, completion logic, and blocked issue handling.
- Test coverage includes provider normalization, zero semantics, and unsupported-metric handling.
- Test coverage includes stale, partial, unavailable, and failed states.
- Auth tests verify viewer and admin permission boundaries.
- Test failures are actionable and tied to the relevant business rule.

### Dependencies
- Task 5
- Task 6
- Task 7
- Task 10
- Task 13

## Task 16 — Validate dashboard end-to-end and prepare release candidate

### Description
Run focused manual and automated validation of the prototype, confirm the MVP criteria, and prepare the release candidate.

### Acceptance criteria
- The dashboard works for at least one board and valid provider configuration.
- Active and historical sprint selection function correctly.
- Provenance and stale-state semantics are visible to users.
- The prototype contains no secrets in the client or logs.
- All key MVP behaviors are validated and documented.
- The release candidate is ready for stakeholder review.

### Dependencies
- Task 12
- Task 14
- Task 15

## Dependency summary

- Task 1 is the foundation for all tasks.
- Task 2 is required before configuration-dependent tasks.
- Task 4 and Task 8 enable Jira and admin integration work.
- Task 5, 6, and 7 form the core Jira reporting flow.
- Task 9 and 10 enable provider reporting and totals.
- Task 11 and 12 connect refresh and UI presentation.
- Task 13 and 14 provide security and retention hardening.
- Task 15 and 16 are the validation and release phase.

## Suggested execution order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8
9. Task 9
10. Task 10
11. Task 11
12. Task 12
13. Task 13
14. Task 14
15. Task 15
16. Task 16

## Handoff completion status — 2026-10-13

- Tasks 1–13: prior implementation retained; regression suite validated.
- Task 14: completed for the ephemeral reporting model: cache metadata, bounded
  memory, physical 24-hour expiry, six-hour freshness and host tenant purge.
  Provider snapshots are not persisted. Complete viewer-scoped Jira counts are
  collected on manual refresh only, with bounded dated history and 30-day expiry.
- Task 15: completed; focused business-rule, authorization, cache and synthetic
  cross-layer integration coverage is present.
- Task 16: local automated validation and review documentation completed.
  The 21 local Chrome mock walkthrough checks passed. Live Confluence hosting,
  actual account access, screen-reader behavior, live performance and
  stakeholder sign-off remain open; no production-ready claim is made.

See [release-validation.md](./release-validation.md) for evidence and host wiring.

## Checklist remediation — 2026-10-13

Tasks 2–15 now additionally cover editor configuration with board/source
validation, rendered work groups and sprint state, manual scoped count history,
original freshness, independent provider failures, per-field completeness,
installation-bound secrets, bounded deduplication and complete safe diagnostics.
All 107 tests passed with PostgreSQL. Task 16 retains the real host/account/
browser/security release gates P1–P4 in [checklist.md](./checklist.md); they are
not checked off by local synthetic tests. Existing MVP exclusions and optional
polish are explicitly classified there.


## Mock browser walkthrough — 2026-10-13

Task 16 now includes 21 passing checks in installed Google Chrome with real
local PostgreSQL and synthetic context/Jira/providers. Each principal screen
and role, sprint/date/source controls, manual history, partial/stale/zero/empty
states, retry guidance, mobile overflow and keyboard activation were exercised.
A paginated 500-issue/three-provider fixture loaded below three seconds. See
[walkthrough.md](./walkthrough.md) for the user flow and screenshot evidence.
Actual embedding, authorized accounts, screen-reader audit and live performance
remain release prerequisites. Run `npm run test:walkthrough` against a fresh
mock demo to repeat this local check.
