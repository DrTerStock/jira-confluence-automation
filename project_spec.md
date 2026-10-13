# Jira Sprint Progress and AI Usage Dashboard

The MVP baseline is [spec/clarify.md](./spec/clarify.md), mirrored in
[spec/specification.md](./spec/specification.md), section 2.4. Older Forge-native,
individual-identity and periodic-refresh planning entries are retained as
historical/future product work; they do not override the current MVP scope.
Confluence embedding/authentication remains required. See CR-003 in the
[change registry](./change_request_registry.md).

## Contents

- [1. Purpose and scope](#1-purpose-and-scope)
- [2. Users and access](#2-users-and-access)
- [3. Functional specification](#3-functional-specification)
  - [3.1 Confluence widget](#31-confluence-widget)
  - [3.2 Jira sprint reporting](#32-jira-sprint-reporting)
  - [3.3 AI usage and cost reporting](#33-ai-usage-and-cost-reporting)
  - [3.4 Refresh and data freshness](#34-refresh-and-data-freshness)
- [4. Proposed technical architecture](#4-proposed-technical-architecture)
- [5. Data model](#5-data-model)
- [6. Security and privacy](#6-security-and-privacy)
- [7. Error handling and observability](#7-error-handling-and-observability)
- [8. Non-functional requirements](#8-non-functional-requirements)
- [9. Verification plan and acceptance criteria](#9-verification-plan-and-acceptance-criteria)
- [10. Delivery phases](#10-delivery-phases)
- [11. Assumptions, decisions, and risks](#11-assumptions-decisions-and-risks)
  - [Decisions Made](#decisions-made)
- [12. Related requirements](#12-related-requirements)

## 1. Purpose and scope

Specify a native Atlassian Forge app that adds a configurable sprint and AI
usage dashboard to a Confluence Cloud page. Each widget instance represents
one Jira board/team. The initial release includes:

- Jira sprint progress, blockers, and burndown-style reporting.
- AI usage and cost reporting for GitHub Copilot and OpenAI and Anthropic API
  organizations, to the extent each provider exposes the required data.
- Team totals and individual breakdowns, with provider accounts matched to
  Atlassian users by work email where possible.

The widget is not a Jira dashboard gadget. It does not replace Jira or provider
administration interfaces. It reads and aggregates reporting data, and does not
modify Jira issues or provider settings.

## 2. Users and access

### 2.1 Roles

| Role | Capabilities |
| --- | --- |
| Confluence page editor | Add the widget and configure the board and enabled usage sources for that widget instance. |
| Confluence page viewer | View the widget, choose a sprint and AI reporting date range, and refresh the displayed data. |
| Forge/site administrator | Install and configure the app and its organization-level provider credentials. |

Page viewers inherit access from the containing Confluence page. Jira API
requests must additionally respect the current viewer's Jira permissions. AI
organization reporting uses administrator-configured provider access; its
individual-level visibility requires explicit organizational approval before
production rollout.

### 2.2 Configuration boundary

Per-widget configuration contains only non-secret settings, such as the Jira
board identifier, selected provider sources, and metric preferences. Provider
credentials and tokens must never be stored in macro/page content or returned
to the browser.

## 3. Functional specification

### 3.1 Confluence widget

1. An editor can add the Forge macro/widget to a Confluence page.
2. The editor can configure one Jira board and choose which configured AI
   provider sources appear in that widget.
3. Different widget instances may use different boards and source selections.
4. Viewers see the sprint panel and AI usage panel, including source and
   freshness information.
5. The widget provides loading, empty, partial-data, permission-error, and
   provider-error states. A failed or unavailable source must not be rendered
   as a successful zero.
6. Widget controls allow sprint selection, AI date-range selection, and
   on-demand refresh.

### 3.2 Jira sprint reporting

#### Selection and issue scope

- Read board and sprint data from Jira Cloud for the configured board.
- Allow selection from the board's sprint history; clearly identify the active
  sprint when one is available.
- Include stories, tasks, and bugs.
- Exclude subtasks and epics.
- Include only issues assigned to the selected sprint.
- Respect the current viewer's Jira access. If the viewer cannot read the
  configured board or its issues, show a permission error and actionable
  guidance.

#### Dashboard metrics

For the selected sprint, display:

- Sprint name and start/end dates, when Jira provides them.
- Completed versus remaining work.
- A burndown-style chart over sprint dates.
- Blocked issue count and the blocked issues list, including issue key,
  summary, status, and assignee where available.
- Included work grouped by status and issue type, with links to Jira issues.
- Data timestamp and any incomplete coverage.

The progress unit remains an open decision. The suggested behavior is to show
both issue count and story points when a usable estimate field is available,
with issue count as the fallback. Do not compare a points total with an issue
count or imply that unestimated issues have zero effort. The estimate field,
status-to-completion mapping, and blocker detection must be confirmed against
the project's Jira configuration.

#### Burndown data

A burndown requires dated remaining-work values, not just the current state of
issues. The implementation must use Jira-provided historical data if available
to the app, or capture periodic snapshots for future dates. Label the chart's
coverage and do not fabricate history before the first available observation.
If adequate history is unavailable, show the current completion summary and an
explicit message that burndown history is not available.

### 3.3 AI usage and cost reporting

#### Sources and range

- Support GitHub Copilot, OpenAI API, and Anthropic API as independently
  configurable sources.
- Let viewers select a date range. Enforce provider-supported date boundaries
  and explain any truncation or unavailable period.
- Display per-source coverage and the reporting period used.
- Show combined totals only when their underlying metrics are compatible.
  Preserve and label differing currencies; do not add unlike currencies
  without an approved conversion source and exchange-rate policy.

#### Metrics and identity

- Display provider-reported usage and cost when the source reports those
  metrics. Examples include token usage and billed cost, but availability and
  definitions vary by provider and API plan.
- Keep provider-reported values distinct from optional estimates. Every
  estimate must be labeled as estimated and expose enough context to interpret
  it (source, period, and estimation basis).
- Show team totals and a per-person breakdown for metrics with attributable
  identities.
- Match an identity to an Atlassian user by normalized work email only when
  both sides provide a usable email. Do not guess matches based on display
  name.
- Present records with missing or unmatched identities in a distinct
  “unmatched” group rather than assigning them to a person.
- A metric the provider does not expose is “unavailable,” not zero. Zero is
  valid only when the source successfully reports zero for the requested
  period.
- When one provider fails but another succeeds, show available data and a
  visible partial-data warning.

Provider capabilities, required organization permissions, retention windows,
identity fields, and metric definitions must be verified during integration
work. Provider-specific adapters should normalize results without implying
that similarly named metrics have identical semantics.

### 3.4 Refresh and data freshness

- Support manual refresh from the widget.
- Support periodic refresh on a cadence of a few minutes. Exact cadence and
  whether it is configurable remain open.
- Display the last successful retrieval time per source, not merely the time
  the page was opened.
- Do not allow refresh controls to bypass provider or Jira rate limits.
- Use a short-lived cache where appropriate to reduce repeated calls. Cached
  data must retain its source, period, retrieval time, and completeness
  metadata.
- If refreshing fails, retain a previously successful result only when its
  age is visible and it is clearly marked stale.

## 4. Proposed technical architecture

This section is an implementation proposal, not a confirmed choice of
framework or component API. Validate it against current Forge platform
capabilities before coding.

### 4.1 Components

1. **Confluence macro UI:** A Forge macro provides the embedded dashboard,
   controls, chart, tables, and empty/error states. A Custom UI frontend is the
   proposed option if it is needed for the required chart and responsive
   layout; choose UI Kit instead if it can meet the same interaction and
   accessibility requirements with less complexity.
2. **Forge resolver/backend:** Authenticated resolver functions validate
   requests, obtain data, normalize provider responses, and return only the
   fields needed by the UI.
3. **Jira adapter:** Reads boards, sprints, and issues using Atlassian APIs
   under the requesting user's Jira permissions. Use the narrowest feasible
   Forge scopes.
4. **Provider adapters:** Separate GitHub Copilot, OpenAI, and Anthropic
   clients translate each provider's reporting API/export into the normalized
   model in [Data model](#5-data-model).
5. **Configuration and secrets:** Store per-widget non-secret choices in
   widget configuration. Store organization-level provider credentials in a
   secure Forge-supported secret/configuration mechanism. Never expose
   credentials to the macro UI.
6. **Cache and history:** Use Forge-supported storage only where required for
   short-lived caching and future burndown observations. Apply tenant,
   installation, board, sprint, provider, and date-range boundaries to cache
   keys and access checks.

### 4.2 Request flow

1. The macro loads its non-secret configuration and requests data for the
   selected sprint and reporting range.
2. The resolver validates the caller, widget configuration, date range, and
   requested source identifiers.
3. The Jira adapter reads Jira data with the viewer's authorization context.
4. Provider adapters retrieve organization-level usage using secure backend
   credentials, subject to each provider's authorization and rate limits.
5. The backend normalizes, aggregates, and annotates results with source,
   period, retrieval timestamp, metric kind (reported/estimated), and
   completeness.
6. The macro renders successful sources and separately reports unavailable,
   stale, or failed sources.

### 4.3 Integration and scope constraints

- Confirm that the selected Forge product modules, authentication model,
  storage, scheduled execution, and outbound network access support the
  proposed flows.
- Allowlist only the external provider hosts required by enabled integrations.
- Do not assume an API exists for a metric until tested with the actual
  organization account and permissions.
- Avoid long-running or unbounded calls. Paginate provider and Jira results,
  cap request sizes, and respect platform execution limits.

## 5. Data model

The backend should use explicit normalized types. Names below describe
conceptual shapes; final language-specific types may differ.

| Entity | Required fields |
| --- | --- |
| `WidgetConfig` | Jira board ID; enabled provider IDs; optional estimate/status/blocker mapping; schema version. No secrets. |
| `SprintSummary` | Sprint ID/name/state/dates; board ID; retrieval time; source and coverage status. |
| `SprintIssue` | Jira issue ID/key/URL; summary; issue type; status; assignee identity if available; estimate if configured; completion and blocker classification. |
| `SprintHistoryPoint` | Sprint ID; observation date/time; remaining and completed issue counts; corresponding estimate totals when supported; provenance and coverage marker. |
| `UsageMetric` | Provider; organization/source ID; period; metric name/unit/value; reported or estimated kind; currency if monetary; retrieval time; coverage status. |
| `UsageIdentity` | Provider account/user identifier; email if exposed; matched Atlassian account ID/email if confidently matched; match status. |
| `SourceResult` | Source ID; success/partial/unavailable/error status; last successful retrieval; requested and actual periods; user-safe error code/message. |

Use decimal-safe representations for monetary amounts. Keep raw provider
payloads out of the UI and avoid persisting them unless a specific,
documented requirement justifies retention.

## 6. Security and privacy

- Enforce Atlassian authentication and authorization on every resolver
  operation; never rely on the frontend to enforce access.
- Use least-privilege Forge scopes and provider credentials with read-only
  reporting access where the provider supports it.
- Keep tokens and secrets server-side in supported secret storage. Do not put
  them in page content, macro configuration, client bundles, URLs, or logs.
- Validate and constrain all resolver inputs. Do not accept arbitrary URLs or
  provider endpoints from widget configuration.
- Scope cached and stored data to the correct Atlassian installation and
  configured source. Prevent cross-tenant and cross-widget data access.
- Minimize stored usage data and define retention/deletion behavior before
  enabling persistent per-person history.
- Redact credentials, email addresses, and usage details from operational
  logs unless a documented diagnostic need and access policy justify them.
- Obtain company privacy/policy approval before showing individual usage to
  every viewer of a Confluence page.
- Confirm provider terms, organization authorization, and any data residency
  requirements before production rollout.

## 7. Error handling and observability

Every source result must have an explicit status: successful, partial, stale,
unavailable, permission denied, rate limited, or failed. The UI must distinguish
these states from a genuine zero.

Provide user-safe messages for:

- Invalid or inaccessible Jira board/sprint.
- Jira permission failure.
- Provider credentials missing, expired, or insufficient.
- Provider rate limit or transient outage.
- Unsupported metric, date range, or identity field.
- No data for a successfully queried period.
- Burndown history not yet collected or unavailable.

Logs should record operation, source, installation-safe correlation identifier,
duration, and error category. Do not log access tokens, full provider payloads,
or unnecessary personal usage data. Add monitoring sufficient to identify
repeated integration failures and rate-limit problems without logging secrets.

## 8. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Authorization | Confluence page access and Jira permissions are enforced; provider access is limited to configured organizations. |
| Data integrity | Unavailable, zero, stale, partial, and estimated values are represented distinctly. |
| Responsiveness | Paginate and bound requests; use caching where safe. Set and validate a UI load-time target during implementation. |
| Accessibility | Controls and tables are keyboard-operable; chart information has a textual/table equivalent. |
| Compatibility | Operate as an installable Confluence Cloud Forge app. |
| Maintainability | Keep Jira and provider-specific API handling isolated behind adapters and test normalized results. |
| Privacy | Individual usage is visible only after policy approval; minimize collection and retention. |

## 9. Verification plan and acceptance criteria

### 9.1 Automated checks

- Unit-test provider normalization, metric aggregation, currency handling,
  identity matching, sprint inclusion/exclusion, progress calculations, and
  result-state mapping.
- Test edge cases: no estimates, missing emails, duplicate emails, provider
  partial failure, legitimate zero, unavailable metric, stale cache, and
  mixed currencies.
- Test resolver validation, authorization, and tenant/widget cache isolation.
- Run the repository's formatting, lint, and type/build checks after the Forge
  app is added.

### 9.2 Site validation

Use the available Confluence Cloud site and administrator install permission to
verify:

1. An authorized editor can install/add/configure the widget.
2. Different instances can select different boards and provider sources.
3. A viewer can select current and historical sprints and an AI date range.
4. Jira issue scope includes stories/tasks/bugs and excludes subtasks/epics.
5. Sprint progress, blockers, and burndown coverage are accurately labeled.
6. Provider-reported values, optional estimates, unmatched identities, and
   unavailable metrics are visibly distinct.
7. Access is denied or data is appropriately limited for users lacking Jira
   permissions, and page access continues to govern widget visibility.
8. Manual and periodic refresh behave correctly and show source timestamps.
9. Errors and stale data are visible and do not appear as successful zero
   values.

### 9.3 Release gates

Do not enable production individual-level AI usage reporting until the
organizational privacy decision is recorded. Do not claim provider metric or
historical coverage until it has been verified against the actual authorized
accounts.

## 10. Delivery phases

Phases are an implementation sequence, not a reduction in the agreed first
release scope; Jira and AI usage reporting are both intended for the first
release.

1. **Forge foundation:** Create/installable Confluence macro, resolver,
   per-widget configuration, permission checks, and UI state shell.
2. **Jira sprint reporting:** Board/sprint selection, issue filtering,
   confirmed progress rules, blockers, and available burndown history.
3. **Provider integrations:** Implement and validate GitHub Copilot, OpenAI,
   and Anthropic adapters independently; expose only metrics verified for the
   configured organization.
4. **Aggregation and identity:** Date-range filtering, team totals,
   work-email matching, unmatched group, and optional labeled estimates.
5. **Hardening and rollout:** Security/privacy review, rate-limit/error
   handling, accessibility checks, site validation, and production install.

## 11. Assumptions, decisions, and risks

### Implementation status (2026-10-13)

The Forge hosting shell has not been scaffolded. A React/Express dashboard
prototype is implemented and locally tested (see the prototype milestone below). The repository
contains a separate Python/GitHub Actions weekly Jira report utility; it now
excludes epics and subtasks from its completed, in-progress, and blocker
sections, and its six focused unit tests pass. This utility is not the
dashboard implementation.

### Decisions Made

| ID | Decision | Status / boundary |
| --- | --- | --- |
| D-001 | Use React 18/Vite, Express and PostgreSQL 15 for the prototype, embedded through a Confluence macro/widget shell; pure Forge-native runtime is excluded (clarify Decisions 1/13). | Current MVP baseline verified locally; live release prerequisites remain open. |
| D-002 | Include both Jira sprint reporting and AI usage reporting in the first release; implement Jira reporting before provider API integrations. | Scope and sequencing selected; this does not defer AI reporting out of the first release. |
| D-003 | Widget settings remain non-secret and instance-specific. Backend deployment secrets are bound to one approved installation/provider-organization set; production provisioning/revocation must use the host protected secret manager (clarify Decision 7). | Current MVP baseline verified locally; live release prerequisites remain open. |
| D-004 | Preserve reported units/definitions, zero-versus-absence, compatible totals and honest history. Individual attribution/email matching, estimates/monetary metrics and periodic refresh are excluded from MVP (clarify Decisions 2/5/6/8/18). | Current MVP baseline verified locally; live release prerequisites remain open. |
| D-005 | Treat the existing Python/GitHub Actions weekly Jira report as separate automation, not as the Forge dashboard foundation or completion of dashboard requirements. | Scope boundary confirmed by repository inspection. |

These are the decisions supported by the current requirements and repository
evidence. Clarify Decisions 1/7/13 select the external stack and deployment
secret mechanism. The actual Confluence embedding/session verifier and protected
secret lifecycle still require live deployment validation. Track material requirement changes in
[change_request_registry.md](./change_request_registry.md); synchronize
milestones and decisions with [backlog.md](./backlog.md) and [TODO.md](./TODO.md).

### Confirmed requirements

- Jira Cloud and Confluence Cloud.
- React/Vite + Express + PostgreSQL prototype embedded through a Confluence
  macro/widget shell (D-001).
- One Jira board per widget instance, with full sprint-history selection.
- Stories, tasks, and bugs are in scope; subtasks and epics are excluded.
- Include sprint completion, blockers, burndown-style reporting, and
  configurable AI usage sources for GitHub Copilot, OpenAI, and Anthropic.
- Include team and individual AI usage views, work-email matching where
  possible, unmatched records, selectable date ranges, reported metrics by
  default, and optional clearly labeled estimates.
- Page viewers inherit access from the Confluence page.
- A Confluence Cloud site and app-install administrator access are available.

### Open decisions

1. **Progress unit:** story points, issue count, or both. Suggested default:
   both where estimates exist, with issue count as fallback.
2. **Workflow mapping:** which Jira statuses count as complete and how blockers
   are identified.
3. **Estimate field:** which Jira field contains story points, if used.
4. **Provider coverage:** exact API/report access, user attribution, metrics,
   date range, and retention for each provider.
5. **Refresh cadence:** exact interval and who controls it.
6. **Individual visibility:** policy approval for exposing per-person usage to
   all page viewers.
7. **Currency aggregation:** whether to keep currencies separate or provide
   conversion, and the approved exchange-rate source if conversion is required.
8. **Burndown history:** available historical Jira data versus collection of
   new periodic snapshots and their retention.
9. **Hosting/runtime details:** final Forge UI approach and confirmation of
   platform capabilities for provider API access, storage, and scheduled
   refresh.

### Key risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Provider does not expose per-user usage, cost, tokens, or sufficient history | Verify access early; show explicit coverage gaps and never infer reported metrics. |
| Jira workflows differ across projects | Confirm and configure completion/blocker rules; avoid hard-coded assumptions. |
| Burndown history cannot be reconstructed | Use available historical data or start labeled snapshots; do not fabricate earlier points. |
| Individual usage is sensitive | Require policy approval, minimize retention, and make access implications clear. |
| Provider currencies or metric definitions differ | Keep source values separate unless a documented normalization/conversion policy exists. |
| API throttling or platform execution limits | Paginate, cache safely, bound work, and expose stale/partial state. |

## 12. Related requirements

- [Interview requirements](./SPRINT_DASHBOARD_REQUIREMENTS.md) — source of
  agreed product requirements and interview decisions.
- [Weekly status report template](./STATUS_REPORT_TEMPLATE.md) — existing
  Jira reporting fields that may inform dashboard terminology.
- [Change request registry](./change_request_registry.md) — log of accepted,
  rejected, deferred, and implemented scope or requirement changes.

## Verified prototype milestone (2026-10-13)

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
