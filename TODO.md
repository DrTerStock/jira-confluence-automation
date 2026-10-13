# Project TODO

The MVP baseline is [spec/clarify.md](./spec/clarify.md), mirrored in
[spec/specification.md](./spec/specification.md), section 2.4. Older Forge-native,
individual-identity and periodic-refresh planning entries are retained as
historical/future product work; they do not override the current MVP scope.
Confluence embedding/authentication remains required. See CR-003 in the
[change registry](./change_request_registry.md).

> Statuses reflect verified repository/documentation evidence. When a material
> milestone or decision changes, synchronize this file with [backlog.md](./backlog.md)
> and [project_spec.md](./project_spec.md); record change requests in
> [change_request_registry.md](./change_request_registry.md).

## Decisions Made

- **D-001 — Product/runtime:** Use React 18/Vite, Express and PostgreSQL 15 for the prototype, embedded through a Confluence macro/widget shell; pure Forge-native runtime is excluded (clarify Decisions 1/13).
- **D-002 — First release:** Include Jira sprint and AI usage reporting
  together; deliver Jira reporting before provider API integrations.
- **D-003 — Configuration and credentials:** Widget settings remain non-secret and instance-specific. Backend deployment secrets are bound to one approved installation/provider-organization set; production provisioning/revocation must use the host protected secret manager (clarify Decision 7).
- **D-004 — Reporting integrity and privacy:** Preserve reported units/definitions, zero-versus-absence, compatible totals and honest history. Individual attribution/email matching, estimates/monetary metrics and periodic refresh are excluded from MVP (clarify Decisions 2/5/6/8/18).
- **D-005 — Existing automation:** The Python/GitHub Actions weekly Jira report
  is separate from the Forge dashboard and does not complete its feature work.

## Phase 1: Confirm Requirements and Access

- [x] Inspect the repository, scripts, and tests. A weekly Jira status-report
  utility exists; no Forge app scaffold or dashboard implementation exists.
  The utility is not reusable as the Forge app itself.
- [x] Review the written recommendations: report issue counts and story
  points when estimates are usable, keep unlike currencies separate, and use
  historical burndown data or labeled snapshots without fabricating history.
  Stakeholder confirmation is still needed.
- [~] Check documented Forge primitives: outbound requests are supported,
  hosted storage is installation-scoped, and scheduled triggers support a
  five-minute interval but run without a user context. Macro module,
  resolver/authentication behavior, and secure provider-secret configuration
  are not yet verified. See [Forge Fetch
  API](https://developer.atlassian.com/platform/forge/runtime-reference/fetch-api/),
  [Forge storage](https://developer.atlassian.com/platform/forge/storage-reference/),
  and [scheduled triggers](https://developer.atlassian.com/platform/forge/manifest-reference/modules/scheduled-trigger/).
- [ ] Confirm the progress unit, Jira completion/blocker mapping and estimate
  field, refresh cadence, currency policy, and burndown data/retention
  approach with the project stakeholders and Jira configuration.
- [ ] Record privacy approval for individual AI usage, and verify actual
  Confluence site, Jira board, and provider-organization access. The
  specifications say a Confluence site and install-admin access are available,
  but live access and provider permissions have not been verified.

## Phase 2: Build Reporting

- [ ] Implement the installable Forge widget, secure resolver, per-widget
  configuration, and Jira sprint progress, blockers, and burndown coverage.
- [ ] Integrate GitHub Copilot, OpenAI, and Anthropic reporting, including
  date ranges, team totals, work-email matching, and unmatched identities.

## Phase 3: Validate and Release

- [ ] Show unavailable, zero, stale, partial, estimated, permission-denied,
  rate-limited, and failed data distinctly; preserve provider units and
  currencies.
- [ ] Test authorization, data isolation, integrations, accessibility, and
  refresh behavior; complete security/privacy review and validate on the
  Confluence Cloud site before production rollout.

## Current verified state

- The weekly report generator has a focused unit-test suite; the six tests
  pass with `python3 -m unittest -q tests.test_generate_weekly_status`.
- That separate utility excludes epics and subtasks from completed,
  in-progress, and blocker sections; this does not implement dashboard
  reporting.
- The Forge hosting shell remains unimplemented. The React/Express prototype
  implements Jira and provider reporting; see the verified prototype state below.
- No live Jira/Confluence/provider access or individual-usage privacy approval
  has been verified.

## Verified prototype state (2026-10-13)

The React 18/Vite, Express and PostgreSQL prototype now implements editor
configuration/save/cancel, validated board/provider choices, active/history
selection, status/type groupings, viewer-scoped manual count history, original
source timestamps, independent provider failures, metric completeness/definitions,
clock-driven stale labels, installation-bound secrets, request deduplication and
concurrency limits, expiring provider cache, configuration invalidation and tenant
purge. Host-module loading/removal wiring is available and fails closed without a
trusted verifier. All 107 tests passed with PostgreSQL; lint, typecheck, build and
format checks passed. Prototype scope follows [spec/clarify.md](./spec/clarify.md).
See [spec/checklist.md](./spec/checklist.md) for each requirement's disposition and
nice-to-have list, and [spec/release-validation.md](./spec/release-validation.md)
for integration and retention details. A separate `npm run dev:demo` mode now
runs synthetic context/Jira/providers with real local PostgreSQL. All 21 Chrome
walkthrough checks passed, including configuration, sprint/date/source controls,
permission boundaries, native keyboard activation, 390px mobile layout and a
500-issue/three-provider mock load below three seconds. See
[spec/walkthrough.md](./spec/walkthrough.md) for screens and evidence. Real host,
site/account, screen-reader, live performance and security verification remain
P1–P4; no production-ready claim is made.
