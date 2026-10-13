# Module 14 Completion Report

## Backlog Contents
# Implementation Backlog

> Status key: `[x]` complete, `[ ]` not complete, `[~]` partially complete.
> Update the backlog, TODO, and project specification together when a material
> milestone or decision changes. Record scope/change requests in
> [change_request_registry.md](./change_request_registry.md).

## Current progress

- Repository and existing automation inspected. The repository contains a
  Python/GitHub Actions weekly Jira status-report utility, but no Forge app
  scaffold; that utility does not satisfy the dashboard's Jira reporting
  requirements.
- The standalone report utility now filters epics and subtasks out of its
  completed, in-progress, and blocker sections; its six focused unit tests pass.
- No dashboard implementation, provider integration, Forge build, or site
  validation is present. Those backlog items remain open.
- The Forge capability check is partial: documented outbound requests,
  installation-scoped storage, and five-minute scheduled triggers without a
  user context. Macro/resolver/authentication and provider-secret details still
  need verification.

## Decisions Made

- **D-001 — Product/runtime:** Build a native Atlassian Forge app embedded in a
  Confluence Cloud page; the widget is not a Jira gadget.
- **D-002 — Release scope and sequencing:** Include both Jira sprint reporting
  and AI usage reporting in the first release. Complete the Jira workflow
  before implementing provider API integrations.
- **D-003 — Configuration and credentials:** Keep widget configuration
  non-secret and instance-specific. Provider credentials must remain
  server-side and organization-configured; the exact Forge secret mechanism is
  not yet selected.
- **D-004 — Reporting integrity and privacy:** Do not present unavailable
  metrics as zero, combine unlike currencies without an approved policy, infer
  identity by display name, or fabricate burndown history. Individual-level
  usage remains gated on organizational approval.
- **D-005 — Existing utility boundary:** The Python weekly status report and
  its GitHub Actions workflow are a separate automation, not the Forge
  dashboard foundation or completion of dashboard requirements.

## Priorities and sequencing

- Deliver Jira sprint reporting and AI usage reporting in the same first
  release; neither feature track is out of scope.
- Complete the Jira sprint reporting workflow before beginning provider API
  integrations.
- Build the Forge foundation first. Provider adapters can then be implemented
  as separate, independently verifiable integrations.
- Treat privacy approval for individual AI usage, verified provider
  capabilities, and confirmed Jira metric rules as release gates where
  applicable.

## MCP and custom skill assessment

- The official [Atlassian Rovo MCP Server](https://github.com/atlassian/atlassian-mcp-server)
  is available for VS Code and connects to Atlassian Cloud through OAuth 2.1 or
  API tokens. It can search and retrieve Jira/Confluence content and create or
  update work items/pages, subject to the authenticated user's permissions.
  The community [MCP Atlassian server](https://github.com/sooperset/mcp-atlassian)
  is another Jira/Confluence option.
- These servers can help gather project-specific Jira facts and work with
  Confluence content, but they do not implement or host the Forge widget,
  provide the dashboard's viewer-context runtime authorization, guarantee
  board/sprint/burndown APIs, or integrate GitHub Copilot, OpenAI, and
  Anthropic usage APIs. Those tasks need project-specific implementation and
  verification (custom skill).
- `(MCP)` marks work that can use an existing Atlassian MCP server for its
  primary Jira/Confluence discovery or content operation. `(custom skill)`
  marks work requiring this project's implementation, provider-specific work,
  testing, release validation, or human approval. An MCP label is not a
  substitute for any app code that remains part of the task.
- The Atlassian MCP server was found in the ecosystem; no authenticated
  Atlassian MCP connection was verified in this workspace. Configure and
  authorize one before using it.

## Setup

- [x] (custom skill) Inspect the repository, existing app scaffold, scripts, and test setup;
  record which can be reused for the Forge app. There is no Forge scaffold to
  reuse; the Python weekly-report utility and its tests are separate tooling.
- [~] (custom skill) Verify current Forge support for the required Confluence macro module,
  resolver/authentication model, storage, scheduled execution, and outbound
  provider requests; record constraints that affect implementation. Outbound
  requests, installation-scoped storage, and five-minute scheduled triggers
  (without user context) are documented; macro/resolver/authentication and
  secure provider credential details remain to be verified.
- [ ] (custom skill) Select UI Kit or Custom UI based on whether it can satisfy the dashboard's
  chart, responsive layout, keyboard accessibility, and textual chart
  equivalent requirements.
- [ ] (custom skill) Create or update the installable Forge app scaffold, environment
  configuration, development scripts, and app manifest.
- [ ] (custom skill) Define the resolver/backend and frontend boundaries, normalized
  response types, and source-result status model before implementing features.
- [ ] (custom skill) Establish least-privilege Forge scopes for Confluence and viewer-context
  Jira reads; verify that Jira calls preserve the current viewer's permissions.
- [ ] (custom skill) Identify the supported Forge secret/configuration mechanism for
  organization-level provider credentials; document how credentials are
  provisioned without exposing them to widget configuration or the browser.
- [ ] (custom skill) Define a versioned, non-secret per-widget configuration schema for Jira
  board ID, enabled providers, optional metric mappings, and preferences.
- [ ] (custom skill) Decide and document the initial load-time target, safe cache lifetime,
  maximum request sizes, and limits needed to stay within Forge execution
  constraints.
- [ ] (custom skill) Record open decisions and owners for Jira estimate field, completion and
  blocker rules, provider access/coverage, refresh cadence, individual-usage
  approval, currency handling, burndown history/retention, and privacy/data
  residency requirements. (GitHub issue #1)
- [ ] (custom skill) Obtain organizational privacy/policy approval before enabling
  individual-level AI usage visibility in production.

## Core Features

### Forge widget foundation

- [ ] (custom skill) Implement the Confluence macro/widget entry point and load its
  instance-specific, non-secret configuration.
- [ ] (custom skill) Implement authenticated resolver operations that validate the caller,
  widget configuration, requested sprint/date range, and source identifiers.
- [ ] (custom skill) Enforce authorization in every resolver operation; do not rely on
  frontend checks for page access, Jira permissions, or tenant isolation.
- [ ] (custom skill) Implement shared loading, empty, partial-data, stale, permission-denied,
  unavailable, rate-limited, and failed UI states; never represent an error as
  a successful zero.
- [ ] (custom skill) Add accessible widget controls and layout primitives for sprint
  selection, reporting-range selection, refresh, source status, and freshness.

### Jira sprint reporting (complete before provider integrations)

- [ ] (custom skill) Implement a Jira adapter that reads the configured board and its sprint
  history using the current viewer's authorization context.
- [ ] (custom skill) Populate sprint selection from the configured board's history and
  identify the active sprint when Jira reports one.
- [ ] (custom skill) Implement paginated and bounded Jira issue retrieval for a selected
  sprint; include stories, tasks, and bugs assigned to that sprint, and exclude
  subtasks and epics.
- [ ] (MCP) Confirm the project's estimate field and completion-status mapping with
  the Jira administrator; configure these rules rather than assuming
  universal Jira workflows.
- [ ] (custom skill) Confirm the project's blocker-identification rule and implement it
  without hard-coding an unverified status or flag.
- [ ] (custom skill) Normalize sprint and issue data into typed sprint summary, issue, and
  coverage results, including retrieval timestamps and issue links.
- [ ] (custom skill) Calculate completed and remaining issue counts and, when a usable
  estimate field exists, corresponding estimate totals without treating
  unestimated issues as zero or mixing units.
- [ ] (custom skill) Render sprint name and dates, completed versus remaining work, work
  grouped by status and issue type, and links to included Jira issues.
- [ ] (custom skill) Render blocked issue count and the blocked issues list with key, summary,
  status, and assignee when available.
- [ ] (custom skill) Investigate Jira-provided historical data for burndown; document the
  available dates, fields, and permissions before selecting the history
  implementation.
- [ ] (custom skill) If adequate Jira history is unavailable, implement bounded periodic
  snapshots for future burndown observations, scoped to the installation,
  board, and sprint, with an explicit retention policy.
- [ ] (custom skill) Render a burndown-style chart only for observed or verified historical
  remaining-work values; identify coverage and do not fabricate points before
  the first observation.
- [ ] (custom skill) Show the current completion summary and an explicit history-unavailable
  message when sufficient burndown data does not exist.
- [ ] (custom skill) Display Jira retrieval time and incomplete issue/history coverage; show
  actionable guidance when the configured board or its issues are
  inaccessible.
- [ ] (custom skill) Verify that separate widget instances can use separate board
  configurations without leaking configuration or data across instances.

## Integration

### Shared provider integration

- [ ] (custom skill) Verify each provider's reporting API/export against authorized
  organization accounts, including required permissions, metric definitions,
  identity fields, retention window, supported date boundaries, pagination,
  and rate limits.
- [ ] (custom skill) Record a per-provider capability matrix; implement only metrics and
  periods that were verified, and represent unsupported metrics or periods as
  unavailable rather than zero.
- [ ] (custom skill) Configure provider credentials using the selected server-side secret
  mechanism and allowlist only the external hosts required by enabled sources.
- [ ] (custom skill) Implement provider adapter interfaces and normalized usage/source result
  types that preserve provider-specific metric semantics, units, currency,
  requested/actual periods, retrieval time, and completeness.
- [ ] (custom skill) Ensure raw provider payloads and credentials are not returned to the UI
  and are not persisted unless a documented retention need is approved.

### Provider adapters

- [ ] (custom skill) Implement and validate the GitHub Copilot reporting adapter for the
  metrics, identities, and historical period exposed to the authorized
  organization.
- [ ] (custom skill) Implement and validate the OpenAI API usage/cost adapter for the metrics,
  identities, and historical period exposed to the authorized organization.
- [ ] (custom skill) Implement and validate the Anthropic API usage/cost adapter for the
  metrics, identities, and historical period exposed to the authorized
  organization.
- [ ] (custom skill) Add provider-specific pagination, bounded request handling, and
  provider-specific rate-limit and transient-error classification to each
  adapter.
- [ ] (custom skill) Add organization-level configuration for enabling and securely
  provisioning each provider independently.
- [ ] (custom skill) Allow each widget instance to select from the configured provider
  sources; keep provider secrets out of macro/page configuration.

### Usage aggregation and dashboard

- [ ] (custom skill) Implement validated AI reporting date-range selection and enforce each
  provider's supported date boundaries, visibly reporting truncation or
  unavailable periods.
- [ ] (custom skill) Aggregate verified team totals by compatible metric, retaining metric
  kind (reported or estimated), unit, currency, source, and period.
- [ ] (custom skill) Keep unlike currencies separate unless an approved conversion source and
  exchange-rate policy are documented and implemented; use decimal-safe
  monetary representations.
- [ ] (custom skill) Implement normalized work-email matching between provider identities
  and Atlassian users only when both sides have usable email addresses; do not
  match by display name.
- [ ] (custom skill) Place missing or unmatched identities in a distinct unmatched group;
  handle duplicate emails without making an ambiguous person assignment.
- [ ] (custom skill) Display per-person breakdowns only for attributable metrics and gate
  production individual-level visibility on recorded organizational
  approval.
- [ ] (custom skill) Keep optional estimates separate from provider-reported values; label
  each estimate and expose its source, period, and estimation basis.
- [ ] (custom skill) Render per-source totals, metric definitions/units, coverage, reporting
  period, and last successful retrieval time.
- [ ] (custom skill) Show successful zero distinctly from no data, unavailable metric,
  partial result, and failed source; show available providers alongside a
  visible partial-data warning when another provider fails.

### Refresh, caching, and observability

- [ ] (custom skill) Implement on-demand widget refresh without bypassing Jira or provider
  rate limits.
- [ ] (custom skill) Agree and implement the periodic refresh cadence and its owner/control
  model; refresh only through bounded, rate-limit-aware work.
- [ ] (custom skill) Add short-lived caching where safe; scope keys and access checks to
  installation, widget, board, sprint, provider, and date range.
- [ ] (custom skill) Preserve source, requested/actual period, retrieval time, and
  completeness metadata in cached results; display last successful retrieval
  per source.
- [ ] (custom skill) On refresh failure, retain a previous successful result only when its
  age is visible and it is clearly marked stale.
- [ ] (custom skill) Emit structured, privacy-safe operational logs with operation, source,
  installation-safe correlation ID, duration, and error category; redact
  credentials, unnecessary email addresses, and personal usage details.
- [ ] (custom skill) Add monitoring for repeated provider/Jira failures and rate-limit
  problems without recording secrets or full provider payloads.

## Testing

### Automated verification

- [ ] (custom skill) Unit-test Jira issue inclusion/exclusion, sprint selection, progress
  calculations, estimates with missing values, status mapping, and blocker
  classification.
- [ ] (custom skill) Unit-test burndown history normalization, snapshot coverage, first
  observation behavior, and the unavailable-history state.
- [ ] (custom skill) Unit-test each provider adapter's normalization, pagination, supported
  date handling, reported versus estimated metrics, and provider error
  mapping.
- [ ] (custom skill) Unit-test metric aggregation for compatible/incompatible metrics,
  decimal-safe monetary amounts, mixed currencies, and explicit conversion
  policy behavior if conversion is approved.
- [ ] (custom skill) Unit-test identity matching for normalized emails, missing emails,
  unmatched identities, and duplicate/ambiguous emails.
- [ ] (custom skill) Unit-test source-result/UI mapping for legitimate zero, no data,
  unavailable metrics, partial provider failure, permission denial,
  rate-limiting, stale cache, and general failure.
- [ ] (custom skill) Test resolver input validation, authentication/authorization, source
  allowlisting, and tenant/widget/cache isolation.
- [ ] (custom skill) Test manual and periodic refresh behavior, cache freshness metadata,
  stale fallback behavior, pagination limits, and rate-limit safeguards.
- [ ] (custom skill) Run repository formatting, lint, type-check, and build checks for the
  Forge app; resolve regressions introduced by the implementation.
- [ ] (custom skill) Validate keyboard operation, focus order, accessible labels, and a
  textual/table equivalent for chart information.
- [ ] (custom skill) Measure representative dashboard load time against the agreed target
  with paginated Jira and provider responses.

### Site validation and release gates

- [ ] (custom skill) On the available Confluence Cloud site, verify an authorized
  administrator can install the app and an editor can add and configure the
  widget.
- [ ] (custom skill) Verify multiple widget instances can select different boards and
  provider sources and retain their own configuration.
- [ ] (custom skill) Verify viewers can select current and historical sprints, choose an AI
  reporting date range, and manually refresh.
- [ ] (custom skill) Verify real Jira results include stories/tasks/bugs and exclude
  subtasks/epics, with correct issue links, progress, blockers, and coverage.
- [ ] (custom skill) Verify burndown points correspond to actual historical/snapshot data and
  unavailable history is clearly identified.
- [ ] (custom skill) Verify each provider's displayed values, metric definitions, identities,
  currencies, supported periods, and coverage against the authorized
  organization account.
- [ ] (custom skill) Verify users without Jira permissions receive an actionable permission
  error and that Confluence page access continues to govern widget visibility.
- [ ] (custom skill) Verify provider failures, rate limits, stale values, and partial data
  remain distinct from successful zero values.
- [ ] (custom skill) Verify production individual-level usage remains disabled until
  organizational privacy/policy approval is recorded.
- [ ] (custom skill) Verify the release does not claim unsupported provider metrics or
  historical coverage and has approved retention, privacy, and data residency
  behavior.

## Documentation

- [ ] (custom skill) Document local Forge setup, prerequisites, environment configuration,
  app deployment, and installation on the development Confluence site.
- [ ] (custom skill) Document widget editor and viewer workflows, including board/provider
  selection, sprint and date-range controls, refresh, source status, and
  freshness indicators.
- [ ] (MCP) Document Jira configuration dependencies: board access, estimate field,
  completion-status mapping, blocker rule, and burndown data/retention.
- [ ] (custom skill) Document provider onboarding for GitHub Copilot, OpenAI, and Anthropic,
  including required organization permissions, secure credential setup, and
  verified metric/date/identity coverage.
- [ ] (custom skill) Document normalized metric meanings, units, currencies, reported versus
  estimated values, unmatched identities, and conditions that prevent totals
  from being combined.
- [ ] (custom skill) Document refresh cadence, cache lifetime, rate-limit behavior, stale
  result behavior, and source-specific troubleshooting guidance.
- [ ] (custom skill) Document security scopes, resolver authorization, tenant/widget data
  boundaries, secret handling, log redaction, retention/deletion, and privacy
  approval requirements.
- [ ] (custom skill) Document automated test, lint, type-check, build, and site-validation
  commands and the release gates required before production rollout.

## GitHub Issues
| Issue URL | Title | Created via MCP? |
|-----------|-------|-----------------|
| https://github.com/DrTerStock/jira-confluence-automation/issues/1 | Confirm Jira reporting requirements and policies | Yes |

## MCP Tools Used
- github-mcp-server-search_repositories
- github-mcp-server-get_me
- github-mcp-server-create_repository
- github-mcp-server-get_file_contents
- github-mcp-server-list_branches
- github-mcp-server-list_issues
- github-mcp-server-get_label
- github-mcp-server-issue_write
- github-mcp-server-issue_read
- github-mcp-server-push_files
- github-mcp-server-pull_request_read
- github-add_issue_comment
- github-issue_write
