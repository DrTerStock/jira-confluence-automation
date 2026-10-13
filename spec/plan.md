# Implementation Plan

This plan is based on the clarified MVP decisions in [clarify.md](./clarify.md) and the engineering constraints in [constitution.md](./constitution.md) and [specification.md](./specification.md).

## Objectives

Deliver a working Jira sprint and AI usage dashboard prototype for Confluence, with the following MVP constraints:

- Single runtime baseline: React 18 + Vite frontend, Node.js + Express backend, PostgreSQL 15 via Docker.
- Confluence integration is an embedding layer; the app logic and persistence live in the Express service.
- Jira progress uses issue count as the default unit; story points are secondary and only displayed when valid.
- Individual AI identity attribution is out of scope for MVP.
- Manual refresh only; no periodic refresh or background polling in prototype.
- Only verified, allowlisted provider metrics are shown.
- No currency conversion or cross-metric aggregation.

## Scope summary

In scope for MVP:

- Confluence-embedded dashboard shell
- Jira board and sprint selection
- Sprint issue scope for stories, tasks, and bugs only
- Sprint summary, blockers, and basic burndown status
- Provider usage reporting for verified GitHub Copilot, OpenAI, and Anthropic metrics
- Secure server-side provider configuration and readiness checks
- Source status semantics: success, partial, stale, unavailable, permission denied, rate limited, failed
- Manual refresh and stale-state handling
- Team-level totals only

Out of scope for MVP:

- Individual usage attribution and identity matching
- Production-only user-level visibility
- Automatic periodic refresh
- Currency conversion
- Full provider capability matrix beyond allowlisted metrics
- Full Forge-only deployment model
- Complex estimation and custom Jira workflow automation beyond configurable blocker mapping

## Phase 0 — Project setup and architecture baseline

### Goal
Establish the technical foundation and project conventions before implementation begins.

### Deliverables
- Project skeleton for frontend and backend
- Dockerized PostgreSQL 15 environment
- Shared config and environment variables
- ESLint/Prettier/TypeScript or equivalent project conventions
- Initial project README and setup instructions
- Basic CI pipeline for lint, typecheck, and unit tests

### Milestone 0.1: Architecture and environment ready
- Express API app bootstrapped and running locally
- Vite frontend app bootstrapped and talking to local dev backend
- PostgreSQL service runs in Docker and is wired into app configuration
- Local environment variables and secret-handling conventions documented

### Exit criteria
- A developer can start the app locally and run the basic app shell
- Required environment variables are documented and safe
- CI validates syntax and build health

## Phase 1 — Dashboard shell and configuration model

### Goal
Create the Confluence dashboard shell and allow a single board + provider configuration to be saved and validated.

### Deliverables
- Dashboard layout for:
  - header
  - sprint selector
  - sprint summary
  - blockers
  - burndown panel
  - AI usage panel
- Widget configuration model with schemaVersion
- Board selection and validation
- Provider enablement model for GitHub Copilot, OpenAI, and Anthropic
- Non-secret config persistence in PostgreSQL
- Validation rules for board IDs, provider IDs, and schema version

### Milestone 1.1: Configurable widget instance
- One widget instance can be configured for one Jira board
- Enabled providers can be selected independently
- Invalid or inaccessible board/provider choices are rejected with a meaningful error
- Non-secret config persists in the database

### Exit criteria
- A page editor can save a valid dashboard configuration
- The configuration schema is versioned and migratable
- Secrets are never stored in widget config or frontend

## Phase 2 — Jira reporting

### Goal
Implement the Jira reporting core for sprint progress, blockers, and burndown status.

### Deliverables
- Jira board list and sprint list API integration
- Viewer permission checks enforced on backend
- Sprint issue filtering: stories, tasks, bugs only
- Sprint summary with issue count and optional story points
- Blocked issue list and blocked count
- Burndown availability state and coverage metadata
- Data freshness and status metadata

### Milestone 2.1: Sprint selection and reporting
- Users can switch between active and historical sprints
- Only correct issue types are counted
- Completed vs remaining counts are shown with explicit units
- Unestimated work is displayed as "Not estimated" instead of zero

### Milestone 2.2: Blockers and burndown
- Blocked issues are detected via explicit project config mapping
- The UI shows a blocked issue list with key, summary, status, and assignee when available
- Burndown history is shown only when valid source data exists
- Missing history displays an explicit unavailable state

### Exit criteria
- Jira reporting matches the configured issue scope and does not expose unauthorized data
- Manual tests cover complete, partial, and unavailable Jira states
- All sprint calculations are deterministic and auditable

## Phase 3 — Provider adapters and normalization

### Goal
Implement provider adapters and normalize outputs to the internal source-result contract.

### Deliverables
- GitHub Copilot adapter
- OpenAI adapter
- Anthropic adapter
- Shared provider contract for:
  - source id
  - status
  - requested period
  - actual period
  - last successful retrieval
  - metric list
  - safe error/status metadata
- Metric allowlist and validation logic
- Unsupported metric handling
- Safe error envelope

### Milestone 3.1: Verified adapter contract
- Each provider is queried via server-side credentials only
- Unsupported metrics are labeled as unsupported, not zero
- Successful zero values are preserved as zero
- Partial failures show as partial and keep other provider data visible

### Milestone 3.2: Team totals and source statuses
- Compatible totals are shown only when metric definitions and units match
- Incompatible metrics remain separate cards/values
- Each source exposes freshness and coverage metadata

### Exit criteria
- Every provider result includes source status, actual coverage, and retrieval metadata
- Provider output is consistent across all enabled sources
- No provider data is exposed in the browser if the backend marks it unavailable

## Phase 4 — UI integration and source-status presentation

### Goal
Bring all data together in a single dashboard view with explicit states and safe user messaging.

### Deliverables
- Dashboard state management for:
  - loading
  - empty
  - zero
  - partial
  - stale
  - unavailable
  - permission denied
  - rate limited
  - failed
- Source cards with status summary and safe detail text
- Sprint summary + AI usage panel integration
- Keyboard-accessible controls and accessible chart/table fallback
- No color-only status semantics

### Milestone 4.1: Dashboard data wiring
- Sprint data and provider data appear in the same dashboard layout
- Partial source failures do not hide successful independent provider results
- Stale results remain visible with a stale indicator and last-success timestamp

### Exit criteria
- The page is readable without relying on color alone
- Users can distinguish zero, empty, missing, and failed values
- The dashboard remains usable when one provider fails or is unsupported

## Phase 5 — Security, resilience, and retention hardening

### Goal
Hardening before release: enforce security, privacy, and operational safety requirements.

### Deliverables
- Server-side auth and authorization checks for page viewers and site admins
- Secret storage integration with safe backend references
- Rate-limit and retry guardrails for Jira and provider requests
- Cache expiration logic and retention cleanup jobs
- Operational logs with correlation IDs and safe error categories
- Data purge for tenant-scoped records and expired cache entries

### Milestone 5.1: Security checkpoint
- No secret or raw provider payload is exposed in client responses or logs
- Backend validates all IDs, date ranges, and provider selection inputs
- Cache isolation ensures one tenant/widget cannot access another tenant’s data

### Exit criteria
- Security review passes for server-side auth and secret handling
- Retention policy is implemented and tested
- Stale/failed states are preserved without overwriting valid data

## Phase 6 — Testing, validation, and release gate

### Goal
Validate product behavior against the MVP requirements and release conditions.

### Deliverables
- Unit tests for parser normalization, status rules, issue filtering, and metric compatibility
- Integration tests for Jira and provider adapters
- Auth tests for viewer/admin boundaries
- End-to-end dashboard validation in local dev environment
- Release checklist aligned with constitution and spec

### Milestone 6.1: Core verification pass
- Sprint issue filtering passes expected fixtures
- Zero values and unsupported values are correctly distinguished
- Metrics are not mixed across incompatible units or currencies
- Failed or partial providers do not hide successful provider data

### Milestone 6.2: Release candidate
- Manual site validation confirms dashboard works for active and historical sprints
- Admin readiness model works for configured, missing credentials, and permission-denied states
- The prototype meets the exit criteria for privacy, security, and UI accessibility

### Exit criteria
- All required MVP features are working and validated
- No production individual-level AI visibility is enabled
- Release notes and operational runbook are complete

## Recommended milestone timeline

### Sprint 1: Foundation and config
- Phase 0 + Phase 1
- Output: working app shell and backend + config model

### Sprint 2: Jira reporting
- Phase 2
- Output: sprint selection, summary, blockers, and burndown state

### Sprint 3: Provider adapters and normalization
- Phase 3
- Output: provider data collection and source-result model

### Sprint 4: Dashboard integration and hardening
- Phase 4 + Phase 5
- Output: final dashboard behavior and security/retention hardening

### Sprint 5: Validation and release
- Phase 6
- Output: release candidate and signoff

## Risk register

### Risk 1 — Jira estimate field is not configured consistently
Mitigation: Default to issue count and show "Not estimated" rather than forcing a story-point policy.

### Risk 2 — Provider metrics vary by org/account permissions
Mitigation: Use a verified allowlist and fail closed by showing unsupported instead of making assumptions.

### Risk 3 — Privacy review may block individual attribution
Mitigation: Keep identity matching out of scope and stick to team totals only.

### Risk 4 — Runtime architecture drift
Mitigation: Keep a single app runtime baseline and avoid introducing second runtime models.

### Risk 5 — Data freshness confusion
Mitigation: Always show last successful retrieval timestamp and stale-state warnings when refresh fails.

## Definition of done for MVP

The MVP is done when:

- the dashboard is usable in Confluence with valid board configuration
- Jira sprint progress is calculated correctly for the supported issue scope
- provider metrics are displayed only when verified and supported
- data freshness, partial data, unsupported metrics, and permission failures are clearly represented
- secrets and raw payloads are not exposed to clients or logs
- no individual-level AI usage is displayed in the production dashboard
- the app is validated through focused tests and manual checks

This plan should be updated as the implementation moves forward and as any formal product decisions are approved.
