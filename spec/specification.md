# Feature Specification: Jira Sprint Progress and AI Usage Dashboard

**Status:** Prototype implemented locally; live release validation pending
**Source:** [`../project_spec.md`](../project_spec.md)
**Related engineering constraints:** [`./constitution.md`](./constitution.md)
**Authoritative MVP decisions:** [clarify.md](./clarify.md), Decisions 1–19.
**Implementation and scope review:** [checklist.md](./checklist.md).

## 1. Overview

Build a configurable dashboard embedded in a Confluence Cloud page. Each
dashboard instance represents one Jira board/team and presents sprint
progress, blockers, burndown coverage, and reporting data from independently
enabled AI usage sources: GitHub Copilot, OpenAI API, and Anthropic API.

The dashboard is read-only with respect to Jira and provider settings. It
aggregates only data available through authorized integrations and must make
coverage, freshness, and limitations visible. A missing or unsupported value
must never be presented as a successful zero.

This document expands product behavior into scenarios, requirements, UI
surfaces, API contracts, and a logical persistence model. It does not claim
that every provider currently exposes every metric described below.

## 2. Goals, scope, and exclusions

### 2.1 Goals

- Let an authorized Confluence editor configure a dashboard for one Jira
  board and selected AI usage sources.
- Let page viewers explore sprint history, sprint progress, blockers,
  available burndown history, and usage over a selected date range.
- Preserve source-specific meaning, access controls, freshness, and
  completeness throughout retrieval, normalization, aggregation, and display.
- Make partial results useful without concealing failed or unavailable
  integrations.

### 2.2 In scope

- Jira Cloud board, sprint, and issue read/reporting.
- Sprint issue scope: stories, tasks, and bugs in the selected sprint;
  subtasks and epics are excluded.
- Sprint completion metrics, blocker list, status/type groupings, and
  burndown-style chart when adequate dated data exists.
- Independent configuration for GitHub Copilot, OpenAI API, and Anthropic
  API reporting.
- Provider-reported metrics, optional explicitly labeled estimates, team
  totals, and attributable individual breakdowns where authorized and
  supported.
- Work-email identity matching and a separate unmatched group.
- Manual refresh, periodic refresh, safe short-lived caching, and visible
  per-source freshness.

### 2.3 Out of scope

- Editing Jira issues, sprints, board settings, or provider configuration.
- Replacing Jira or provider administration/reporting interfaces.
- A Jira dashboard gadget.
- Guessing unsupported historical data, provider metrics, user matches, or
  currency conversion values.
- Production individual-level AI usage visibility before organizational
  approval.
- Guaranteeing identical definitions for similarly named metrics across
  providers.

### 2.4 Authoritative prototype boundary

The broader requirements below describe the product baseline. For this MVP,
[clarify.md](./clarify.md) overrides those requirements as follows:

- Runtime: React 18/Vite, Express and PostgreSQL 15; Confluence supplies the
  embedding/authentication shell. Pure Forge-native runtime is excluded.
- Team/organization-reported counters only: no individual attribution, email
  matching, unmatched groups, cost estimates or monetary metrics. Only the
  small provider allowlist in Decision 18 is accepted; returned source field
  names and definitions are preserved.
- Manual source refresh only; no polling or scheduled reporting/snapshot jobs.
  A UI clock ages data after 30 minutes for Jira and six hours for providers.
- Complete, classified Jira counts may become timestamped manual observations,
  scoped by installation, widget, viewer, board and sprint. No earlier points
  are invented. History is limited to 500 observations within 30 days, with
  startup/read/hourly expiry and cascading tenant deletion. Provider reports
  remain ephemeral with six-hour reuse and physical 24-hour cache expiry.
- Deployment environment credentials are bound to `DASHBOARD_INSTALLATION_ID`;
  the default deployment serves one approved tenant/provider-organization set.
  Multi-tenant hosting requires its own scoped secret store and adapters.
- The trusted host must verify session/page/widget/editor/admin context and
  obtain a viewer-scoped Jira token. `DASHBOARD_HOST_MODULE` loads that local
  deployment integration and its verified removal-event hook. Missing host
  verification fails closed.

These exclusions do not waive Confluence embedding, authorized account evidence,
production security/privacy review or browser accessibility/performance release
checks. [checklist.md](./checklist.md) identifies those prerequisites separately
from implemented gaps and optional polish.

## 3. Users and access

| Actor | Needs and permissions |
| --- | --- |
| Confluence page editor | Add the dashboard and set its board, enabled sources, and approved non-secret reporting preferences. |
| Confluence page viewer | View the dashboard, select a sprint and AI reporting period, and request refresh. Page access governs whether the widget is visible. Jira requests must also respect the viewer's Jira permissions. |
| Confluence/site administrator | Install/configure the app and provision organization-level provider access using supported secure storage. |
| Background refresh process, if supported | Refresh only configured sources within approved authorization, retention, and rate-limit boundaries. Its exact Forge/platform mechanism remains to be verified. |

The Express API accepts a host-injected, server-side authentication resolver.
The resolver must verify the platform authentication material, derive the
installation, viewer, page, and widget instance from trusted context, and
confirm the viewer can access that page before returning an authenticated
context. It may provide a viewer-scoped Jira access token and a verified
administrator flag and page-editor permission. Browser-supplied identity, installation, page, widget,
role, and Jira-token fields are never proof of authorization. API routes deny
access when the resolver is absent, fails, or cannot verify access.

Provider organization credentials are organization-level backend credentials;
they do not grant permission to bypass the viewer's Jira authorization.

## 4. User scenarios and acceptance criteria

Priorities: **P1** is required for the first release; **P2** is valuable but
depends on verified capability or an unresolved policy/technical decision.

### Scenario 1 — Configure a dashboard (P1)

**As a** Confluence page editor, **I want** to select one Jira board and the
AI usage sources for a dashboard instance, **so that** the page displays data
for the intended team.

Acceptance criteria:

1. The editor can configure one board and any subset of organization-configured
   providers.
2. The editor can save non-secret settings only; the UI does not request or
   display provider credentials.
3. A different widget instance can use a different board/source selection.
4. Invalid, inaccessible, or unconfigured choices are rejected with a useful
   message and are not silently saved as valid configuration.
5. The configuration has a schema version so it can be validated and migrated
   when its shape changes.

### Scenario 2 — Review sprint progress (P1)

**As a** page viewer with Jira access, **I want** to select a sprint and see
its progress and work breakdown, **so that** I can understand the team's
current or historical sprint.

Acceptance criteria:

1. The dashboard lists available sprints for its configured board, indicates
   an active sprint when Jira reports one, and allows historical selection.
2. The selected sprint's name and available start/end dates are shown.
3. Only stories, tasks, and bugs assigned to the selected sprint are counted;
   epics and subtasks are excluded.
4. Progress shows completed and remaining work with its unit. The unit may
   include issue count and configured story points; the final unit and
   estimate field are unresolved until Jira configuration is confirmed.
5. Unestimated work is not represented as zero effort. Points are never added
   to issue counts.
6. Work is grouped by status and issue type, and issue links point to Jira.
7. If the viewer lacks access, the UI shows a permission state and does not
   expose data retrieved for another user.

### Scenario 3 — Inspect blockers and burndown coverage (P1)

**As a** page viewer, **I want** to identify blocked work and understand
progress over time, **so that** I can see delivery risks without being shown
fabricated history.

Acceptance criteria:

1. The dashboard shows a blocked count and, when available, issue key,
   summary, status, and assignee for each blocked issue.
2. Blocker classification uses a confirmed project/Jira rule; until then the
   mapping is configurable or explicitly marked unresolved, not guessed.
3. The burndown plot uses dated remaining-work observations from Jira or
   collected snapshots.
4. The chart identifies its time coverage and provenance. It contains no
   invented points before the earliest valid observation.
5. If historical data is inadequate, the dashboard shows the current
   completion summary and an explicit “burndown history unavailable” message.

### Scenario 4 — Review AI usage by source and period (P1)

**As a** page viewer, **I want** to select a date range and see usage from
enabled providers, **so that** I can understand reported organizational
usage.

Acceptance criteria:

1. The viewer can select a date range; the backend enforces each provider's
   supported range and returns both requested and actual coverage.
2. Each enabled provider is reported independently with source, period,
   units/metric definitions, retrieval time, and status.
3. A successfully queried zero is displayed as zero. Unsupported metrics,
   missing data, and provider failures have distinct states and are never
   converted to zero.
4. When one source fails and another succeeds, successful data remains
   visible with a prominent partial-data indication.
5. Combined totals are shown only for compatible metrics and units.
   Monetary totals with different currencies remain separate unless an
   approved conversion policy exists.
6. Estimates are visually and semantically distinct from reported values and
   identify estimation basis, source, and period.

### Scenario 5 — Review attributable and unmatched identities (P1/P2)

**As an** authorized viewer, **I want** usage attributed only when identity
matching is reliable, **so that** people are not incorrectly associated with
usage.

Acceptance criteria:

1. An identity is matched only by normalized usable work email available from
   both provider and Atlassian data.
2. Display-name similarity is never used to infer identity.
3. Missing or unmatched provider identities appear in a distinct unmatched
   group.
4. Individual-level usage is disabled in production until organizational
   privacy approval and permitted audience are recorded.
5. If individual reporting is not approved or unsupported, the UI explains
   that the view is unavailable; team totals may still be displayed when
   authorized.

### Scenario 6 — Refresh and interpret stale data (P1)

**As a** page viewer, **I want** to refresh data and see its freshness,
**so that** I can judge whether the displayed report is current.

Acceptance criteria:

1. The viewer can request an on-demand refresh for the dashboard's relevant
   sources.
2. Periodic refresh occurs only if supported and configured; exact cadence
   and whether it is configurable remain open.
3. Last successful retrieval time is shown per source, not replaced with page
   load time.
4. Refreshes respect provider and Jira rate limits and do not cause unbounded
   or duplicate work.
5. On failure, the last successful result may remain visible only with its
   age and a stale warning. The failure is surfaced separately.

### Scenario 7 — Administer provider connections (P1)

**As a** site administrator, **I want** to configure provider credentials
securely and see whether each source is available, **so that** editors can
select only valid organization integrations.

Acceptance criteria:

1. Credentials are written/read only through a verified secure backend or
   Forge-supported secret mechanism.
2. Credentials never appear in widget configuration, client responses,
   browser bundles, URLs, or logs.
3. Source readiness distinguishes configured, missing credentials,
   insufficient permissions, unsupported reporting, and transient failure.
4. The app requests read-only reporting access where supported.
5. Provider capabilities are not advertised as available until verified
   against the authorized organization account.

## 5. Functional requirements

### Configuration and dashboard

- **FR-001** The app shall provide a Confluence-embeddable dashboard instance,
  not a Jira gadget.
- **FR-002** Each instance shall reference exactly one Jira board and zero or
  more independently enabled, administrator-configured usage providers.
- **FR-003** Widget configuration shall contain only non-secret settings and
  shall be validated on every backend operation.
- **FR-004** The dashboard shall provide loading, empty, partial, stale,
  permission-denied, rate-limited, unavailable, and failed states.
- **FR-005** The UI shall keep successful source results visible when another
  source fails, while explicitly indicating incompleteness.

### Jira

- **FR-006** Jira board, sprint, and issue reads shall use an authorization
  context that respects the current viewer's Jira permissions.
- **FR-007** The app shall list the configured board's available sprint
  history and identify the active sprint when available.
- **FR-008** Sprint issue scope shall include stories, tasks, and bugs assigned
  to the selected sprint, and exclude epics and subtasks.
- **FR-009** Sprint reporting shall include sprint identity/dates, completed
  and remaining work, status/type grouping, Jira links, retrieval time, and
  coverage status.
- **FR-010** Blocker classification, completion mapping, and estimate field
  shall use confirmed Jira/project configuration; unresolved mappings shall
  not be silently assumed.
- **FR-011** The app shall provide a burndown-style series only from
  timestamped historical data or collected observations, with explicit
  provenance and coverage.

### AI usage

- **FR-012** The system shall model GitHub Copilot, OpenAI API, and Anthropic
  API as independent optional sources.
- **FR-013** Provider adapters shall normalize data while preserving original
  provider metric names/definitions, units, currency, period, and source.
- **FR-014** The viewer shall be able to request a date range. Results shall
  include the requested and actual provider-supported period.
- **FR-015** Team totals and individual breakdowns shall be shown only for
  metrics the provider exposes and the current audience is authorized to see.
- **FR-016** Identity matching shall use normalized work email only; unmatched
  identities shall remain unmatched.
- **FR-017** Estimates shall be labeled, distinguishable from provider
  reports, and accompanied by estimation basis, source, and period.
- **FR-018** Aggregation shall not combine unlike metrics, units, or
  currencies without an explicitly approved normalization/conversion rule.

### Refresh, persistence, and operations

- **FR-019** The UI shall support a manual refresh operation.
- **FR-020** Periodic refresh may be enabled only after its platform mechanism,
  cadence, authorization, and rate-limit behavior are verified.
- **FR-021** Cached values shall retain source, requested/actual period,
  retrieval time, and completeness metadata, and shall be isolated by
  installation, board, widget/source, and query period as applicable.
- **FR-022** Persistence of usage details and burndown history shall be
  minimized and governed by documented retention/deletion policy.
- **FR-023** Logs shall record operation, safe correlation identifier,
  duration, and error category while excluding credentials, full provider
  payloads, and unnecessary personal usage details.

## 6. UI screens and states

### 6.1 Confluence macro: dashboard view

Primary screen embedded in a Confluence page.

- **Header:** dashboard/team or board label; selected sprint name/state;
  last-refresh action and loading indicator.
- **Sprint controls:** sprint selector, active sprint indicator, available
  date span.
- **Sprint summary:** completed/remaining values with explicit units and
  estimate coverage.
- **Burndown:** accessible chart with a textual/table equivalent, coverage
  range, last observation, and a clear unavailable-history state.
- **Blockers:** blocked count and issue list with key, summary, status,
  assignee if available, and Jira link.
- **Work breakdown:** issues grouped by status and issue type.
- **AI usage controls:** reporting date range and enabled source selection as
  allowed by widget settings.
- **AI usage panel:** per-source reported metrics, team totals where
  compatible, optional approved individual breakdown, unmatched group, units,
  currency, period, freshness, and coverage.
- **Source status:** per-source success/partial/stale/unavailable/error
  status and user-safe detail.
- **Accessibility:** keyboard-accessible controls; semantic headings and
  table/list equivalents; chart values not conveyed by color alone.

### 6.2 Confluence macro: configuration view

Available to an authorized page editor.

- Jira board identifier/selection and validation result.
- Enabled provider checkboxes limited to configured/available sources.
- Non-secret reporting preferences (for example, approved estimate field or
  presentation options once decisions are made).
- Save/cancel actions and actionable validation errors.
- No fields for API tokens, passwords, or secrets.

### 6.3 Administrator integration setup/status

The exact administration surface is platform-dependent and remains subject
to architecture verification. It must provide a secure way for an authorized
administrator to configure provider access and inspect readiness without
revealing stored secrets. Status must explain missing/invalid permissions,
unsupported coverage, and transient connection errors.

### 6.4 Shared UI states

| State | Required presentation |
| --- | --- |
| Loading | Indicate which panel/source is loading; avoid implying old values are current. |
| Empty | State that the query succeeded but returned no records for the period. |
| Zero | Show only when a source successfully reported numeric zero for that metric and period. |
| Partial | Show available results and identify the failed/incomplete source(s). |
| Stale | Retain prior successful data only with its last-success time and visible stale status. |
| Unavailable | Explain that the metric/source or requested historical range is not provided. |
| Permission denied | Explain insufficient Jira/provider access without exposing protected data. |
| Rate limited/failed | Provide a safe message and retry guidance where appropriate. |

## 7. API contract: logical operations

These are logical backend operations and illustrative payload contracts. MVP
transport is the Express HTTP API, with a Confluence integration shell, under
clarify Decisions 1/13/16. Route names and example JSON shapes are proposals,
not binding endpoint names. Every implementation must preserve the stated
authorization, normalization and error behavior.

### 7.1 Common contract rules

- Derive installation/tenant and authenticated caller from trusted
  authentication context; do not accept either as authoritative client input.
- Validate all IDs, enum values, and date ranges; cap pagination and request
  sizes.
- Do not accept arbitrary URLs, API hosts, or provider endpoints.
- Return only normalized fields required by the UI; never return secrets or
  raw provider payloads.
- Use a consistent error envelope:

```json
{
  "error": {
    "code": "jira_permission_denied",
    "message": "You do not have access to this Jira board.",
    "correlationId": "opaque-safe-id",
    "retryable": false
  }
}
```

### 7.2 Operations

| Operation / proposed HTTP route | Request data | Response data | Authorization and behavior |
| --- | --- | --- | --- |
| Read dashboard configuration — `GET /api/v1/widgets/{widgetId}/config` | Platform widget context; no trusted tenant or user IDs from body. | `widgetId`, `schemaVersion`, `boardId`, enabled provider IDs, non-secret metric preferences. | Caller must be able to view/edit the containing page as appropriate. Return no credentials. |
| Save dashboard configuration — `PUT /api/v1/widgets/{widgetId}/config` | `boardId`, `enabledProviders[]`, approved non-secret preferences, `schemaVersion`. | Validated saved configuration and source readiness summary. | Editor authorization required. Verify board access. Reject unknown providers and secret-like fields. |
| List boards — `GET /api/v1/jira/boards` | Optional bounded `query`, `cursor`/`limit` if supported. | Board IDs, names, project labels, pagination metadata. | Use the current viewer's Jira access; return only visible boards. |
| List sprints — `GET /api/v1/jira/boards/{boardId}/sprints` | Optional state filter and bounded pagination. | Sprint ID/name/state/start/end dates and active indicator where known. | Verify board access for each request. |
| Read sprint report — `GET /api/v1/widgets/{widgetInstanceKey}/jira/boards/{boardId}/sprints/{sprintId}/report` | The widget instance key and configured board/sprint IDs; metric preferences are read from saved widget configuration. | Sprint metadata, issue-count progress, optional board-configured story points, in-scope issues/groups, optional dated burndown observations with coverage/provenance, retrieval time, and source status. | Require trusted installation/viewer context; only read the widget's saved configuration. Respect viewer Jira permissions, validate the sprint belongs to the configured board, and exclude epics/subtasks. |
| Read usage report — `GET /api/v1/usage/report` | `widgetId`, `from`, `to`, selected enabled `providers[]`, optional compatible metric filters. | Per-provider `SourceResult`, requested/actual period, metrics, compatible aggregates, unmatched identities, individual aggregates only if approved. | Page/view authorization required. Provider calls use server-side org credentials. Enforce date limits and privacy gate. |
| Refresh dashboard data — `POST /api/v1/widgets/{widgetId}/refresh` | Optional requested panels/sources and selected sprint/period; idempotency key if needed. | Per-source refresh status, last-success time, stale indication, correlation ID. | Validate configured sources and caller permissions; bounded work; honor rate limits. |
| Read source readiness — `GET /api/v1/admin/sources` | No secret material. | Provider ID, configured/readiness status, supported metrics/ranges verified, safe diagnostic code. | Administrator only. Never return secret values or raw payloads. |

### 7.3 Illustrative response shapes

Sprint report:

```json
{
  "sprint": {
    "id": "opaque-jira-sprint-id",
    "name": "Sprint 12",
    "state": "active",
    "startDate": "2026-10-01T00:00:00Z",
    "endDate": "2026-10-15T00:00:00Z"
  },
  "progress": {
    "issueCount": { "completed": 8, "remaining": 5, "total": 13 },
    "estimate": {
      "unit": "story_points",
      "completed": null,
      "remaining": null,
      "estimatedIssueCount": 0,
      "totalIssueCount": 13,
      "status": "unavailable"
    }
  },
  "blockers": [],
  "groups": [],
  "burndown": {
    "status": "unavailable",
    "coverageStart": null,
    "coverageEnd": null,
    "points": []
  },
  "source": {
    "id": "jira",
    "status": "success",
    "lastSuccessfulAt": "2026-10-13T15:00:00Z",
    "completeness": "complete"
  }
}
```

Usage report:

```json
{
  "requestedPeriod": { "from": "2026-10-01", "to": "2026-10-13" },
  "sources": [
    {
      "id": "openai",
      "status": "partial",
      "actualPeriod": { "from": "2026-10-01", "to": "2026-10-12" },
      "lastSuccessfulAt": "2026-10-13T15:00:00Z",
      "metrics": [
        {
          "name": "provider-defined-token-metric",
          "value": "125000",
          "unit": "provider-defined",
          "kind": "reported",
          "currency": null
        }
      ],
      "error": { "code": "period_truncated", "message": "Coverage ends before the requested end date." }
    }
  ],
  "identityBreakdown": {
    "status": "disabled_pending_approval",
    "matched": [],
    "unmatched": []
  }
}
```

The examples are illustrative, not a commitment to provider-specific metric
names, exact enum values, or transport. Use decimal-safe values for monetary
amounts; a string representation is shown to avoid JSON floating-point
ambiguity.

## 8. Logical data model and persistence

The entities below define the information the system needs to represent. They
do not require persistent storage for every API response. Prefer retrieving
and aggregating on demand or using short-lived cache entries. Persist usage
details or burndown observations only where necessary, with an approved
retention and deletion policy.

### 8.1 Entities

| Entity | Fields and constraints | Persistence guidance |
| --- | --- | --- |
| `Installation` | `id`; Atlassian installation/tenant identifier; status; created/updated timestamps. Tenant identifier unique. | Required logical tenant boundary; use platform context/storage if Forge remains selected. |
| `WidgetConfig` | `id`; installation ID; widget/macro instance key; schema version; Jira board ID; enabled provider IDs; non-secret preferences; updated timestamp. Unique by installation + widget instance. | Persist through Forge widget configuration or approved database mechanism. Never include credentials. |
| `ProviderConfig` | `id`; installation ID; provider enum (`github_copilot`, `openai`, `anthropic`); organization/source identifier; enabled/readiness state; secret reference (not secret); verified scopes/capabilities metadata; timestamps. | Store secret only in a secure secret facility; persist a reference and non-sensitive status only. |
| `SprintSnapshot` | `id`; installation ID; board ID; sprint ID; observed timestamp; remaining/completed issue counts; optional estimate totals/unit; provenance; coverage/completeness. | Persist only for user-triggered manual-refresh burndown; retain for at most 30 days. Unique by scope + observation timestamp or idempotency key. |
| `UsageMetric` | `id`; installation ID; provider/source ID; optional provider organization/account ID; metric name; value (decimal-safe); unit; currency; metric kind (`reported`/`estimated`); period start/end; retrieved timestamp; coverage/status; estimation basis when estimated. | Prefer ephemeral response/cache. If persisted, minimize granularity and apply approved retention. |
| `UsageIdentity` | `id`; installation ID; provider/source ID; opaque provider user/account ID; normalized work email if exposed and permitted; Atlassian account identifier/email if matched and permitted; match status. | Persist only if required and policy-approved; minimize personal data and define deletion. Never match by display name. |
| `SourceResult` | Source ID/type; status; safe error code/message; requested and actual periods; last successful retrieval; completeness; correlation ID. | Returned per request; may be cached alongside corresponding result. Do not retain verbose errors or raw payloads. |
| `CacheEntry` | Cache key; installation and source scope; board/widget/query-period dimensions; normalized result; fetched/expiry timestamps; completeness. | Short-lived only; cache key must prevent cross-tenant, cross-widget, and cross-source access. |

### 8.2 Relational schema proposal (if PostgreSQL is selected)

This is a logical schema, not a migration. PostgreSQL column types, indexes,
foreign keys, migration tooling, and retention jobs must be finalized after
the runtime architecture decision.

```text
installations(
  id UUID PRIMARY KEY,
  atlassian_installation_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
)

widget_configs(
  id UUID PRIMARY KEY,
  installation_id UUID NOT NULL REFERENCES installations(id),
  widget_instance_key TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  jira_board_id TEXT NOT NULL,
  enabled_providers JSONB NOT NULL,
  preferences JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (installation_id, widget_instance_key)
)

provider_configs(
  id UUID PRIMARY KEY,
  installation_id UUID NOT NULL REFERENCES installations(id),
  provider TEXT NOT NULL,
  organization_source_id TEXT,
  enabled BOOLEAN NOT NULL,
  readiness_status TEXT NOT NULL,
  secret_reference TEXT,
  verified_capabilities JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE (installation_id, provider, organization_source_id)
)

sprint_snapshots(
  id UUID PRIMARY KEY,
  installation_id UUID NOT NULL REFERENCES installations(id),
  board_id TEXT NOT NULL,
  sprint_id TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  remaining_issue_count INTEGER NOT NULL,
  completed_issue_count INTEGER NOT NULL,
  estimate_unit TEXT,
  remaining_estimate NUMERIC,
  completed_estimate NUMERIC,
  provenance TEXT NOT NULL,
  completeness_status TEXT NOT NULL,
  UNIQUE (installation_id, board_id, sprint_id, observed_at)
)

usage_metrics(
  id UUID PRIMARY KEY,
  installation_id UUID NOT NULL REFERENCES installations(id),
  provider_config_id UUID NOT NULL REFERENCES provider_configs(id),
  provider_org_id TEXT,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  unit TEXT NOT NULL,
  currency CHAR(3),
  metric_kind TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  retrieved_at TIMESTAMPTZ NOT NULL,
  coverage_status TEXT NOT NULL,
  estimation_basis TEXT,
  CHECK (period_end >= period_start)
)

usage_identities(
  id UUID PRIMARY KEY,
  installation_id UUID NOT NULL REFERENCES installations(id),
  provider_config_id UUID NOT NULL REFERENCES provider_configs(id),
  provider_account_id TEXT NOT NULL,
  normalized_work_email TEXT,
  atlassian_account_id TEXT,
  match_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (installation_id, provider_config_id, provider_account_id)
)
```

`usage_identities` and `usage_metrics` are optional persistent tables, not a
requirement to retain person-level data. Do not store Jira issue summaries or
full provider payloads by default. Add database indexes only to support
documented access/query patterns, including installation-scoped lookups and
snapshot/period retrieval. Apply tenant scoping in repository/data-access
functions as well as schema constraints.

### 8.3 Data lifecycle and integrity

- Monetary fields shall use exact decimal storage/serialization rather than
  binary floating-point.
- Store source-native unit and currency with every relevant value.
- A metric may be zero only as a successful reported value; missing/unavailable
  values should use explicit status/absence semantics, not a fabricated zero.
- Cache expiration and persistent data retention are separate policies.
- Delete or expire tenant-scoped data when the installation/source is removed
  or its retention period ends, subject to verified platform behavior and
  legal requirements.
- Raw provider responses shall not be stored unless a documented requirement,
  privacy review, and retention rule explicitly justify it.

## 9. Error and source-status model

Every source result shall use a typed status with at least:

- `success`
- `partial`
- `stale`
- `unavailable`
- `permission_denied`
- `rate_limited`
- `failed`

The UI may distinguish a successful empty result from numeric zero, but neither
may be conflated with failure. Error responses should include a stable
user-safe code, actionable message, correlation ID, and retryability where
known. Sensitive provider response bodies and credentials must not be exposed.

## 10. Security, privacy, and compliance requirements

- Authenticate and authorize every backend/resolver operation.
- Respect Confluence page visibility and Jira user permissions.
- Use least-privilege Jira scopes and read-only provider access where
  supported.
- Keep provider secrets server-side and out of widget configuration, client
  responses, URLs, client bundles, and logs.
- Validate all input; constrain identifiers, dates, pagination, and provider
  selection to configured values.
- Prevent tenant, widget, board, and provider cache/data leakage.
- Minimize collection and retention, especially for individual usage and
  email identifiers.
- Obtain organizational approval before enabling individual AI usage in
  production and record its audience/access policy.
- Verify provider terms, organization permissions, data retention, and data
  residency requirements before production.
- Redact tokens, email addresses, and detailed usage from operational logs
  unless a reviewed diagnostic need requires limited access.

## 11. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Authorization | Page and Jira access boundaries are enforced server-side; provider access is limited to configured organizations. |
| Integrity | Zero, empty, unavailable, failed, stale, partial, and estimated values are distinct. |
| Performance | Calls are bounded and paginated; caching is short-lived and correctly scoped. Establish a measurable UI load-time target during implementation. |
| Accessibility | Controls and tables are keyboard-operable; charts have textual/table equivalents and do not depend on color alone. |
| Maintainability | Jira and provider integrations are isolated behind adapters and tested against normalized contracts. |
| Privacy | Individual data visibility requires recorded approval; collection and retention are minimized. |
| Compatibility | The deployment must be compatible with the selected, recorded runtime/hosting architecture and Atlassian platform capabilities. |

## 12. Success criteria

- **SC-001 — Correct Jira scope:** Every sprint report includes only stories,
  tasks, and bugs assigned to the selected sprint; epics and subtasks do not
  affect displayed counts or estimates.
- **SC-002 — No false zeroes:** Every unavailable, failed, missing, stale, or
  partial metric is represented by an explicit state. Zero is returned only
  for a successfully reported zero. Automated tests cover each state.
- **SC-003 — Transparent coverage:** Every source result includes its source,
  requested period where applicable, actual period where known, last
  successful retrieval, and completeness/status.
- **SC-004 — Safe aggregation:** No dashboard total combines unlike metric
  definitions, units, or currencies unless the corresponding approved
  normalization policy is implemented and tested.
- **SC-005 — Reliable identity handling:** Every individual attribution is
  based on normalized work-email matching; unmatched or missing identities
  remain unassigned. No individual-level production view is enabled before
  policy approval.
- **SC-006 — Enforced access boundaries:** Unauthorized page/Jira callers
  cannot retrieve protected Jira results, and automated tests verify
  installation/widget/cache isolation.
- **SC-007 — Secret containment:** Provider credentials are absent from
  widget configuration, browser-visible responses, client assets, URLs, and
  logs; code review and tests cover these boundaries.
- **SC-008 — Honest history:** Every displayed burndown point has a verifiable
  historical or snapshot source and timestamp; missing history is shown as
  unavailable rather than synthesized.
- **SC-009 — Usable partial operation:** A source failure does not hide
  successful independent source results, and the failure is visible as
  partial/error status.
- **SC-010 — Accessible reporting:** All dashboard controls are
  keyboard-operable and every chart has a textual or tabular equivalent.
- **SC-011 — Verified integrations:** Each provider capability shown as
  supported has been exercised against an authorized account or otherwise
  verified with documented evidence; unverified capabilities are marked
  unavailable or pending verification.

## 13. Verification and release criteria

### Automated verification

- Unit tests cover provider normalization, metric compatibility, currency
  handling, identity matching, Jira issue filtering, progress calculations,
  and status mapping.
- Edge-case tests cover no estimates, missing/duplicate emails, legitimate
  zero, unavailable metrics, mixed currencies, partial source failures,
  stale cache, and absent burndown history.
- Authorization tests cover resolver/API input validation, Jira access,
  tenant/widget isolation, and cache isolation.
- Integration tests validate pagination, rate-limit handling, and provider
  capability boundaries using safe fixtures or authorized test accounts.
- Run repository formatting, lint, type/build, and focused tests relevant to
  the changed implementation.

### Site validation

1. An authorized editor can add and configure the widget.
2. Two widget instances can use different boards and source selections.
3. An authorized viewer can select active/historical sprints and a valid
   usage period.
4. Issue inclusion/exclusion follows the agreed issue scope.
5. Progress, blockers, and burndown coverage agree with source data and
   display unresolved coverage honestly.
6. Reported values, estimates, unmatched identities, and unavailable values
   are visibly distinct.
7. Users without required page/Jira access cannot retrieve protected data.
8. Manual and periodic refresh behavior, source timestamps, stale state, and
   rate-limit handling are correct.
9. No production individual-level usage is exposed before approval.

### Release gates

- Do not enable individual AI usage in production until policy approval and
  audience restrictions are recorded.
- Do not claim a provider metric, identity attribution, date range, or
  historical coverage until verified against the authorized organization.
- Do not ship a runtime architecture that conflicts with the project
  decision/constitution without recording and approving the architecture
  change.

## 14. Assumptions, dependencies, and open questions

### Confirmed product decisions from `project_spec.md`

- The target product is a Confluence Cloud embedded macro/widget, not a Jira
  gadget.
- One widget instance represents one Jira board/team.
- Jira reporting and all three provider families are intended for the first
  release, with Jira reporting implemented before provider integrations.
- Jira scope includes stories, tasks, and bugs; excludes epics and subtasks.
- Widget configuration is non-secret; provider credentials are
  organization-level and server-side.
- Unsupported values are not zero; currencies remain distinct absent an
  approved conversion policy; identity matching uses work email only.
- The existing Python weekly report automation is a separate tool and is not
  the dashboard implementation.

### MVP decisions and remaining verification

Product defaults and exclusions are resolved in [clarify.md](./clarify.md):
React/Vite + Express + PostgreSQL, issue counts with optional validated board
points, Done-category completion, explicit blocked statuses, allowlisted team
counters, manual refresh, no individual identity/estimates/currency conversion,
manual count observations, 30-day history and 24-hour ephemeral cache expiry.
The measurable render target is under three seconds for up to 500 sprint issues
and three providers. These defaults are implemented locally.

The actual host verifier/embedding, intended board workflow rules, organization
permissions/available reporting bounds, protected secret lifecycle and real
browser/accessibility/performance evidence remain release prerequisites. See
[checklist.md](./checklist.md), P1–P4. They are not unresolved product defaults.

## 15. Implementation sequence

1. **Foundation:** resolve runtime decision; verify platform capabilities;
   implement authentication, configuration, and dashboard state shell.
2. **Jira reporting:** board/sprint selection, issue filtering, confirmed
   progress and blocker rules, and available burndown history.
3. **Provider adapters:** implement and validate each enabled provider
   independently; expose only verified metrics.
4. **Aggregation and identity:** date ranges, compatible team totals,
   approved work-email matching, unmatched grouping, and optional labeled
   estimates.
5. **Hardening and rollout:** security/privacy review, rate-limit/error
   handling, accessibility, site validation, retention/deletion, and
   production installation.

The sequence does not remove AI reporting from first-release scope; it
prioritizes Jira reporting before provider integration work.
