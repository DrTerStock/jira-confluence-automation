# Specification implementation checklist

Audit and remediation date: **2026-10-13**. Base revision: **`eaf4363`**;
results below include the completed prototype remediation and mock walkthrough.
Baseline: [specification.md](./specification.md), sections 1–15, with the
explicit MVP decisions in [clarify.md](./clarify.md).

Every previously incomplete row now has a **Disposition**. Real local gaps
were implemented and regression-tested. Existing prototype exclusions are
marked **Out of scope**; optional refinements are listed under **Nice-to-have**.
Real deployment and verification gaps remain **Pending P1–P4**. They are not
polish or waived requirements, and fixture tests do not establish production
readiness.

## How to interpret the results

`Yes / Pass` describes verified local behavior. `Yes (MVP) / Pass (MVP)` means
its implemented subset is complete under the cited scope decision. `Partial /
Unverified` retains a real release prerequisite. `Out of scope / N/A` is an
explicit prototype exclusion. A nice-to-have does not block the tested MVP.
The original findings below are retained as audit history, with current fixes
and residual prerequisites stated alongside them.

## Scope exclusions

- **O1 — Individual attribution:** email matching, individual views and unmatched
  groups are out of scope under clarify Decisions 2/6. No identities are
  collected. The UI explains this limitation; adding the feature requires a
  separate privacy/audience decision.
- **O2 — Estimates and monetary reporting:** only the reported counter allowlist
  in clarify Decisions 5/18 is supported. Cost estimates, estimation basis and
  monetary serialization/storage are out of scope. Currency conversion remains
  disabled (Decision 12).
- **O3 — Periodic refresh:** polling, scheduled source refresh and periodic
  snapshots are out of scope (Decisions 8/9). The clock timer only ages displayed
  data and the retention timer only deletes expired records; neither fetches
  upstream reports.
- **O4 — Alternative runtime:** a pure Forge-native application is out of scope
  under Decisions 1/13. The required Confluence embedding/authentication shell
  remains a real release prerequisite. The separate Python automation is not
  dashboard implementation (Decision 15).

## Nice-to-have

- [ ] **N1:** Resolve the header's `Board <id>` label to a friendly board/team
  name. Current board identification and sprint/state labels work.
- [ ] **N2:** Replace the usage panel's duplicate read-only date controls with
  a compact period label; editable dates are already in the dashboard.
- [ ] **N3:** Expand optional installation status/update metadata and provider
  capability records. The non-binding logical model does not require these
  entities to persist; the MVP uses tenant-bound secrets, live readiness and a
  small allowlist, not an enterprise capability matrix (Decision 5).
- [ ] **N4:** Add optional text search to paginated board choices and remove
  unused scaffold placeholders. Neither affects current reporting behavior.

## Real release prerequisites still pending

- **P1 — Host integration:** supply and verify the deployment-specific Confluence
  macro/iframe, authenticated session verifier, page/widget/editor/admin binding,
  viewer Jira token and installation-removal subscription. The CLI now loads a
  local host module via `DASHBOARD_HOST_MODULE` and connects its removal hook;
  missing integration fails closed. No authorized host/site connection exists
  in this workspace, so a production verifier cannot be invented here.
- **P2 — Authorized account evidence:** compare results against a real Jira board
  and each enabled provider organization, confirm workflow rules, reporting
  windows and least-privilege credentials. Account-specific historical limits
  must be reported as unavailable/partial when actual queries cannot cover them;
  the 31-day application cap is not a claim about a provider's retention.
- **P3 — Site/accessibility/performance verification:** 21 local Chrome checks
  passed with mocks, including native keyboard controls, mobile overflow and a
  500-issue/three-provider load below three seconds. Screen-reader behavior,
  actual Confluence embedding and representative live network performance remain
  unverified. The synthetic local timing is not a production performance result.
- **P4 — Production review:** verify protected secret provisioning/revocation,
  provider terms, retention, residency and deployment security, then obtain
  stakeholder release approval. Local tenant purge/expiry behavior is tested.

## Verification performed

| Check | Result | Limits |
| --- | --- | --- |
| `DATABASE_URL=postgresql://dashboard:dashboard@127.0.0.1:5432/dashboard npm test` | **107 passed, 0 failed, 0 skipped; 18 test files** | Local PostgreSQL; synthetic upstream responses and injected authentication. |
| `npm run lint` | Pass | Static analysis. |
| `npm run typecheck` | Pass | Workspace application types; runtime account integration is not established. |
| `npm run build` | Pass | Backend compilation and Vite production bundle. |
| `npm run format:check` | Pass | Covers nested backend/frontend sources, tests and shared types; Markdown has its own validator. |
| Isolated audit probes AP1–AP7 below | Original defects reproduced, then covered by regression tests | Fixture-only, no real account calls or production writes. |
| `python3 scripts/validate_markdown.py` | Pass | Final report includes this checklist; see [Markdown validation](../reports/markdown-validation.md). |
| `npm run test:walkthrough` | **21 passed, 0 failed; no uncaught browser errors** | Installed Chrome; synthetic context/Jira/providers, real local PostgreSQL. Keyboard controls, 390px mobile layout and 500-issue fixture checked. [Guide and screenshots](./walkthrough.md), [results](../reports/walkthrough/results.json). |
| Confluence installation, live Jira/provider accounts, screen-reader behavior and live load time | Not run | No verified host adapter or authorized site/account evidence was established. |

### Evidence index

Evidence labels in the tables refer to these implementation and test files.

| Label | Implementation evidence | Verification evidence |
| --- | --- | --- |
| E1 — configuration | [widgetConfig.ts](../backend/src/config/widgetConfig.ts), [config routes](../backend/src/config/routes.ts), [migrations](../backend/migrations/001_widget_config.sql) | [widgetConfig tests](../tests/backend/widgetConfig.test.ts), [release flow tests](../tests/backend/releaseFlow.test.ts); AP1. |
| E2 — authentication/runtime | [auth context](../backend/src/auth/context.ts), [server](../backend/src/server.ts), [entry point](../backend/src/index.ts) | [auth tests](../tests/backend/authContext.test.ts), [Jira route tests](../tests/backend/jira.test.ts); AP2. |
| E3 — Jira transport | [Jira client](../backend/src/jira/client.ts), [Jira routes](../backend/src/jira/routes.ts) | [Jira tests](../tests/backend/jira.test.ts). |
| E4 — sprint rules | [sprintReport.ts](../backend/src/services/sprintReport.ts) | [sprint report tests](../tests/backend/sprintReport.test.ts). |
| E5 — dashboard UI | [Dashboard.tsx](../frontend/src/Dashboard.tsx), [App.tsx](../frontend/src/App.tsx), [SprintPanel.tsx](../frontend/src/components/SprintPanel.tsx), [BlockerPanel.tsx](../frontend/src/components/BlockerPanel.tsx) | [App markup tests](../tests/frontend/App.test.tsx), [release flow tests](../tests/backend/releaseFlow.test.ts). Mounted DOM and local Chrome controls tested; live embedding and screen-reader audit remain Pending P3. |
| E6 — history UI | [BurndownChart.tsx](../frontend/src/components/BurndownChart.tsx), [history type](../shared/types/dashboard.d.ts) | Manual history storage/expiry/purge is covered in [backend regressions](../tests/backend/checklistFixes.test.ts); dated-observation/provenance cases in [App tests](../tests/frontend/App.test.tsx). |
| E7 — usage adapters/service | [adapters.ts](../backend/src/providers/adapters.ts), [usage service](../backend/src/providers/usage.ts), [usage routes](../backend/src/providers/usageRoutes.ts) | [adapter tests](../tests/backend/providerAdapters.test.ts), [usage route tests](../tests/backend/providerUsageRoutes.test.ts); AP3, AP6. |
| E8 — metric policy | [metricPolicy.ts](../backend/src/providers/metricPolicy.ts) | [metric policy tests](../tests/backend/providerMetricPolicy.test.ts). |
| E9 — refresh | [dashboardRefresh.ts](../frontend/src/api/dashboardRefresh.ts), [httpRetry.ts](../backend/src/httpRetry.ts) | [refresh tests](../tests/frontend/dashboardRefresh.test.ts), [retry tests](../tests/backend/httpRetry.test.ts); AP4, AP7. |
| E10 — usage/status UI | [UsagePanel.tsx](../frontend/src/components/UsagePanel.tsx), [SourceStatus.tsx](../frontend/src/components/SourceStatus.tsx), [App.tsx](../frontend/src/App.tsx) | [UsagePanel tests](../tests/frontend/UsagePanel.test.tsx), [App tests](../tests/frontend/App.test.tsx); AP5. |
| E11 — readiness/secrets | [readiness.ts](../backend/src/providers/readiness.ts), [probe.ts](../backend/src/providers/probe.ts), [admin routes](../backend/src/providers/routes.ts), [readiness panel](../frontend/src/components/ProviderReadinessPanel.tsx) | [readiness tests](../tests/backend/providerReadiness.test.ts), [adapter tests](../tests/backend/providerAdapters.test.ts). |
| E12 — cache/lifecycle | [reportCache.ts](../backend/src/providers/reportCache.ts), [usage routes](../backend/src/providers/usageRoutes.ts), [server purge callback](../backend/src/server.ts) | [cache tests](../tests/backend/reportCache.test.ts), [usage route tests](../tests/backend/providerUsageRoutes.test.ts), [release flow tests](../tests/backend/releaseFlow.test.ts). |
| E13 — architecture/release | [constitution](./constitution.md), [clarifications](./clarify.md), [release validation](./release-validation.md), [Compose](../docker-compose.yml), [CI](../.github/workflows/node-ci.yml) | Current build/check results above; host/site validation remains open. |

New remediation evidence: [backend gap regressions](../tests/backend/checklistFixes.test.ts),
[frontend state regressions](../tests/frontend/checklistFixes.test.tsx),
[mounted controls](../tests/frontend/Dashboard.interactions.test.tsx),
[configuration UI](../frontend/src/components/ConfigurationPanel.tsx),
[host loader](../backend/src/auth/hostIntegration.ts),
[request budget](../backend/src/requestWork.ts), and
[manual observations](../backend/src/storage/sprintObservations.ts).

## Original findings and current resolutions

The Finding/Observed columns describe the base revision. The final column
records the current implementation and remaining prerequisites.

| ID | Finding | Evidence / observed result | Affected requirements | Resolution / disposition |
| --- | --- | --- | --- | --- |
| F1 | Default startup cannot deliver an authenticated dashboard; no Confluence hosting integration exists. | `index.ts` does not supply `resolveViewerContext`; AP2 requests `/api/v1/dashboard/context` on the default app and gets **401 `authentication_required`**. No macro manifest/resolver implementation provides the missing integration. | FR-001, FR-006, section 3, site validation. | Implemented host-module loader/removal hook and fail-closed validation contract; real macro/verifier remains Pending P1. |
| F2 | Editor configuration is absent and save validation is incomplete. | There is no configuration form. AP1: a non-admin gets **403**, while an admin saves `boardId: "does-not-exist"` with **200** and a save call. The route checks neither Jira board access nor provider readiness; its error contains only `code`. A numeric inaccessible board would also receive no access check. | Scenario 1, FR-002/003, section 6.2, save operation. | Implemented editor role, paginated board/provider form, save/cancel, board access/estimate-field/readiness validation and full error envelopes. |
| F3 | One unconfigured provider prevents all provider results. | AP3 requests OpenAI plus Anthropic with credentials only for OpenAI. `getReport` rejects with **`ProviderUsageConfigurationError`** and the valid OpenAI adapter is called **0 times**. An unexpected adapter exception also rejects the shared `Promise.all`. Known `ProviderUsageError` failures are isolated correctly. | FR-005, Scenario 4.4, SC-009. | Implemented independent outcomes for missing credentials and unexpected adapter/readiness failures; good sources are preserved. Partial providers with valid allowlisted metrics remain selectable; wholly unsupported probes remain unavailable. |
| F4 | Dashboard freshness is replaced by client refresh time. | AP4 refreshes a report with source retrieval **2026-10-03T12:00:00Z** at client time **2026-10-13T12:00:00Z**. `lastSuccessfulAtBySource.provider_usage` becomes **2026-10-13T12:00:00.000Z**. Individual provider rows retain their original timestamp, but dashboard/stale messages use the newer client value. | Scenario 6.3/5, FR-021 presentation, SC-003. | Implemented original source timestamps; client refresh time never replaces retrieval time. |
| F5 | Overall success can conceal partial provider operation. | AP5 renders one successful OpenAI source and one failed Anthropic source: the dashboard says **Available**, contains **no “Partial data”** label, and only the Anthropic row shows the failure. AP7 confirms `applyDashboardRefresh` has `failures: []` and `stale: false` for that HTTP-success report without retained Anthropic data. | FR-004/005, Scenario 4.4, SC-009, shared partial state. | Implemented dashboard partial state from provider outcomes, including HTTP-success mixed reports. |
| F6 | A missing daily metric can be reported as a complete total. | AP6 gives Anthropic two dated buckets, one with `output_tokens: 10`, one with `{}`. The adapter returns **`status: success`, `output_tokens: "10"`**, and does **not** flag output tokens unsupported. It tracks day coverage and whether a metric appeared anywhere, rather than metric coverage across all rows/days. | FR-013/014, SC-002/003, reporting integrity. | Implemented missing-field tracking across every Anthropic/Copilot record/day; incomplete metrics are omitted, marked unsupported and partial. |
| F7 | Work groups and active/state labels are missing from the rendered view. | Backend computes `groups`, but no component renders them. `SprintPanel` renders sprint names/dates; option labels omit state/active indicators. Header has a fixed title and no configured board/team label. | FR-007/009, Scenario 2.1/6, section 6.1. | Implemented status/type groups, active/history labels, board ID label and source retrieval time; friendly board name is N1. |
| F8 | Jira authorization/rate-limit detail is lost in the UI. | `requestReport` retains only source, HTTP status and correlation ID. `App` uses generic failed/partial/stale messaging; it does not render the Jira safe code/message, retryability or retry-after. Bootstrap failures also become a generic unavailable message. Stale Jira panels still use their old success badge beneath the global stale warning. | FR-004/006, Scenario 2.7, shared permission/rate-limit/loading states. | Implemented Jira/bootstrap permission/rate/failure messages, safe retry/correlation details and loading/stale Jira panel badges; protected retained data clears on denial. |
| F9 | Provider credential and organization selection are process-wide. | `getCredential(providerId)` accepts no installation or organization context. `index.ts` constructs one secret store and one GitHub enterprise slug for all viewers. Cache keys are tenant-scoped, but that does not isolate the upstream organization data or enforce a separate provider audience. Safe only if deployment is deliberately restricted to one approved tenant/organization. | FR-015/021, security isolation, NFR authorization. | Implemented fail-closed installation binding for deployment secrets. One deployment serves one approved tenant/provider organization set; multi-tenant hosts must inject their own scoped store/adapters. Live evidence Pending P2/P4. |
| F10 | Refresh has no server-side request deduplication or concurrency budget. | UI disables its button during refresh, but simultaneous clients/cache misses call upstream independently. `no-cache` is sent for every frontend report request, including initial load. React effect cleanup suppresses state updates without cancelling those report fetches; StrictMode can repeat initial work. Retry/page limits exist, but total duplicate work is not controlled. | Scenario 6.4, FR-019/021, performance NFR. | Implemented request deduplication, per-tenant/global work caps, initial cache reuse and effect abort; manual refresh alone bypasses cache. |
| F11 | Logs and error envelopes are incomplete. | No duration logging exists. Several logs omit operation/error category; config errors omit message/retryability and sometimes body correlation ID. Request-header correlation IDs and safe parsing errors exist. | FR-023, section 7.1, section 9. | Implemented safe operation/correlation/duration/category logs and complete configuration/body error envelopes. |
| F12 | Some specification features are intentionally excluded or only component-level. | No identity matching/unmatched view, estimates with basis, periodic worker, historical acquisition or snapshot persistence. A supplied burndown series can render, but real sprint reports never contain it. | FR-011/015/016/017/020, Scenarios 3/5/6. | Implemented viewer-scoped manual sprint observations, expiry and purge. Identity, estimates and periodic refresh are explicitly Out of scope O1/O2/O3. |

The original AP1–AP7 probes used synthetic inputs against the base revision.
Their defects now have source regression tests in the files linked
above. They remain local evidence, not real account or Confluence deployment validation.

## Sections 1–3: product scope, exclusions and actors

| Requirement | Implemented? | Works? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- |
| Confluence-embedded, configurable board/team dashboard | Partial | Unverified | Local host-module loading, trusted editor/admin/context checks, viewer Jira token forwarding, fail-closed denials and configuration UI tested. Deploy-specific macro/session verifier and installation hook must be supplied and validated. E1/E2/E13; host-loader tests. | Real gap — Pending P1 |
| Authorized editors configure board/providers | Yes | Pass | Trusted editor/admin checks; paginated board and ready-source choices; save validates board access, optional board estimate field and provider readiness. Safe errors, save and cancel tested. E1; backend regressions; mounted controls. | Implemented — real gap closed |
| Viewers explore sprint progress/history, blockers, usage periods | Yes | Pass | Active/historical choices, explicit bounded-list notice, groups and manual history implemented. Sprint change/manual refresh tested in mounted DOM; history verified in PostgreSQL. E3–E6; gap regressions. | Implemented — real gap closed |
| Preserve source meaning, access, freshness and completeness | Yes | Pass | Provider fields/definitions and original retrieval times retained; metric coverage tracked across all rows/days. Missing fields are unsupported, never partial sums disguised as complete totals. E7/E8/E9; gap regressions. | Implemented — real gap closed |
| Useful partial operation | Yes | Pass | Each provider fails independently, including missing secrets/unexpected exceptions. Overall dashboard derives partial status from source outcomes while preserving good values. E7/E9/E10; gap regressions. | Implemented — real gap closed |
| Jira scope includes stories/tasks/bugs, excludes epics/subtasks | Yes | Pass | E3/E4 unit and integration fixtures. | Verified local; no implementation gap |
| Independently configured Copilot, OpenAI and Anthropic | Yes | Pass | Each source is independently enabled/probed and tenant-bound. Environment store rejects absent/other installation IDs; the default deployment represents one approved organization per provider. E1/E7/E11; gap regressions. | Implemented — real gap closed |
| Team metrics, optional estimates, authorized individuals | Yes (MVP) | Pass (MVP) | Reported team counters, source-native definitions, compatible totals, exact integer serialization, date/coverage/status and independent failures implemented. Individual/unmatched/estimate/monetary extensions excluded by clarify Decisions 2/5/6/18. E7–E10. | Out of scope O1/O2; implemented MVP subset |
| Work-email matching and unmatched group | Out of scope | N/A | Individual identity collection, email matching and unmatched groups are explicitly excluded by clarify Decisions 2/6. | Out of scope O1 |
| Manual/periodic refresh and source freshness | Yes (MVP) | Pass (MVP) | Manual refresh, bounded retry and original-source freshness work; periodic retrieval is excluded by clarify Decision 8. No background fetch is enabled. | Out of scope O3; implemented MVP subset |
| Read-only Jira/provider integrations; no issue/admin edits | Yes | Pass | Upstream transport uses reporting GET requests; only local widget config is writable. E3/E7. | Verified local; no implementation gap |
| Do not replace provider/Jira administration or build a Jira gadget | Yes | Pass | No gadget/admin-replacement flow exists; dashboard scope is local reporting. | Verified local; no implementation gap |
| Do not guess history, missing metrics, identity or currency conversion | Yes | Pass | Provider fields/definitions and original retrieval times retained; metric coverage tracked across all rows/days. Missing fields are unsupported, never partial sums disguised as complete totals. E7/E8/E9; gap regressions. | Implemented — real gap closed |
| Disable production individual usage before approval | Yes | Pass | No individual data path or UI; E7/E10. | Verified local; no implementation gap |
| Do not assume equal meaning solely from equal metric names | Yes | Pass | Explicit provider definition/unit/kind/currency/period checks govern compatible totals. Original provider names and field descriptions are exposed; actual authorized accounts remain P2. E8. | Verified local policy; live evidence tracked at P2 |
| Site admin installs and provisions connections | Partial | Unverified | Readiness/editor controls and installation-bound deployment-secret reads implemented. Actual installation and protected secret-manager provisioning require the trusted deployment. E11/E13. | Real gap — Pending P1/P4 |
| Trusted host derives tenant/user/page/widget/admin context | Partial | Unverified | Local host-module loading, trusted editor/admin/context checks, viewer Jira token forwarding, fail-closed denials and configuration UI tested. Deploy-specific macro/session verifier and installation hook must be supplied and validated. E1/E2/E13; host-loader tests. | Real gap — Pending P1 |
| Reject browser identity/role/token as authorization proof | Yes | Pass | E2 auth and Jira route tests. | Verified local; no implementation gap |
| Organization credentials do not override viewer Jira authorization | Yes | Pass | Jira receives only viewer-scoped token; provider tokens are separate. E2/E3. | Verified local; no implementation gap |
| Background refresh respects authorization/retention if enabled | Yes (MVP) | Pass (MVP) | Manual refresh, bounded retry and original-source freshness work; periodic retrieval is excluded by clarify Decision 8. No background fetch is enabled. | Out of scope O3; implemented MVP subset |

## Section 4: every scenario acceptance criterion

| Criterion | Requirement | Implemented? | Works? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- | --- |
| S1.1 | Editor configures one board and any configured provider subset | Yes | Pass | Trusted editor/admin checks; paginated board and ready-source choices; save validates board access, optional board estimate field and provider readiness. Safe errors, save and cancel tested. E1; backend regressions; mounted controls. | Implemented — real gap closed |
| S1.2 | Save only non-secret settings; no credential UI | Yes | Pass | Trusted editor/admin checks; paginated board and ready-source choices; save validates board access, optional board estimate field and provider readiness. Safe errors, save and cancel tested. E1; backend regressions; mounted controls. | Implemented — real gap closed |
| S1.3 | Widget instances have independent selections | Yes | Pass | PostgreSQL installation + widget key isolation tested. E1. | Verified local; no implementation gap |
| S1.4 | Reject invalid/inaccessible/unconfigured choices usefully | Yes | Pass | Trusted editor/admin checks; paginated board and ready-source choices; save validates board access, optional board estimate field and provider readiness. Safe errors, save and cancel tested. E1; backend regressions; mounted controls. | Implemented — real gap closed |
| S1.5 | Version and migrate configuration | Yes | Pass | Schema version, three idempotent migrations and read validation. E1. | Verified local; no implementation gap |
| S2.1 | List sprint history; indicate active; select historical sprint | Yes | Pass | Active/historical choices, explicit bounded-list notice, groups and manual history implemented. Sprint change/manual refresh tested in mounted DOM; history verified in PostgreSQL. E3–E6; gap regressions. | Implemented — real gap closed |
| S2.2 | Show selected sprint name and dates | Yes | Pass | Rendered markup tests cover names/date span and absent dates. E5. | Verified local; no implementation gap |
| S2.3 | Count only sprint stories/tasks/bugs | Yes | Pass | Scoped sprint endpoint, issue filtering and fixture tests. E3/E4. | Verified local; no implementation gap |
| S2.4 | Completed/remaining work with units and configured points | Yes | Pass | Issue count labels and board-field-matched story points implemented. Partial estimate coverage shows coverage text rather than numeric subtotals. E4/E5. | Verified local; no implementation gap |
| S2.5 | Missing estimates are not zero; keep points/counts separate | Yes | Pass | Null/absence and “Not estimated” semantics tested. E4/E5. | Verified local; no implementation gap |
| S2.6 | Render status/type groups and Jira issue links | Yes | Pass | Renders status/type tables, Jira links, active/closed labels, coverage, retrieval time and selected sprint dates. E4/E5; mounted controls. | Implemented — real gap closed |
| S2.7 | Permission UI, no other viewer's protected Jira data | Partial | Unverified | Jira permission UI, viewer token isolation and protected-data clearing tested. Real page/session/token verifier remains unverified. E2/E3/E9; gap regressions. | Real gap — Pending P1 |
| S3.1 | Blocked count, key/summary/status/assignee | Yes | Pass | Explicit mapping and blocker metadata rendering tests. Counts are from fetched scope; partial Jira coverage also marks the blocker panel partial. E4/E5. | Verified local; no implementation gap |
| S3.2 | Explicit/confirmed blocker rule, no guessing | Yes | Pass | Configured case-insensitive status mapping; absent mapping yields unavailable. Per-project live confirmation remains open. E1/E4. | Verified local; no implementation gap |
| S3.3 | Plot dated history from Jira or collected snapshots | Yes | Pass | Migration 003 stores only complete classified issue counts from manual refresh, scoped by installation/widget/viewer/board/sprint. History exposes dated points/provenance and precise last-observation time, capped to 500 points; initial reads do not invent observations. Thirty-day filtering/expiry and cascade purge tested. E6; PostgreSQL gap regression. | Implemented — real gap closed |
| S3.4 | Coverage/provenance; no invented pre-history points | Yes | Pass | Migration 003 stores only complete classified issue counts from manual refresh, scoped by installation/widget/viewer/board/sprint. History exposes dated points/provenance and precise last-observation time, capped to 500 points; initial reads do not invent observations. Thirty-day filtering/expiry and cascade purge tested. E6; PostgreSQL gap regression. | Implemented — real gap closed |
| S3.5 | Keep summary and explicit unavailable-history message | Yes | Pass | Initial reports without observations show summary plus unavailable history; manual refresh can collect real dated count observations. E4/E5/E6. | Verified local; no implementation gap |
| S4.1 | Select range; enforce provider range; requested/actual coverage | Partial | Unverified | Date controls, inclusive UTC 31-day cap and actual coverage/completeness work. Missing days/fields are explicitly partial. Real organization-specific retention/available bounds require authorized-account evidence. E5/E7; gap regressions. | Real gap — Pending P2 |
| S4.2 | Independent source/period/units/definitions/time/status | Yes | Pass | Provider fields/definitions and original retrieval times retained; metric coverage tracked across all rows/days. Missing fields are unsupported, never partial sums disguised as complete totals. E7/E8/E9; gap regressions. | Implemented — real gap closed |
| S4.3 | Legitimate zero distinct from missing/unsupported/failure | Yes | Pass | Explicit zero, absence and status tests pass. Does not establish per-day completeness; see F6. E7/E8/E10. | Verified local; no implementation gap |
| S4.4 | Retain good source data with prominent partial indication | Yes | Pass | Each provider fails independently, including missing secrets/unexpected exceptions. Overall dashboard derives partial status from source outcomes while preserving good values. E7/E9/E10; gap regressions. | Implemented — real gap closed |
| S4.5 | Only compatible totals; separate currencies | Yes | Pass | Allowlist, definition key, unit/kind/currency/actual-period checks; currency metrics excluded. E8. | Verified local; no implementation gap |
| S4.6 | Estimates distinguishable with basis/source/period | Out of scope | N/A | No estimated/monetary metric producer or persistence is enabled under clarify Decisions 5/18. Current metrics are reported integer counters. | Out of scope O2 |
| S5.1 | Match usable normalized work emails from both systems | Out of scope | N/A | Individual identity collection, email matching and unmatched groups are explicitly excluded by clarify Decisions 2/6. | Out of scope O1 |
| S5.2 | Never infer identity from display names | Yes | Pass | No AI identity inference path exists. Jira assignee display names are presentation only. | Verified local; no implementation gap |
| S5.3 | Separate unmatched/missing identity group | Out of scope | N/A | Individual identity collection, email matching and unmatched groups are explicitly excluded by clarify Decisions 2/6. | Out of scope O1 |
| S5.4 | No individual production view without approval/audience | Yes | Pass | Individual feature entirely absent, so cannot be enabled accidentally through current settings. | Verified local; no implementation gap |
| S5.5 | Explain unavailable individual reporting while allowing teams | Yes | Pass | Team reporting remains usable and the usage UI explicitly explains the individual attribution/identity/cost-estimate exclusions. E10. | Implemented — real gap closed |
| S6.1 | Manual dashboard source refresh | Yes | Pass | Bounded GET report requests, refresh state and mounted button click verified; real browser/site remains P3. E9. | Verified local; no implementation gap |
| S6.2 | Periodic refresh only when verified/configured | Yes (MVP) | Pass (MVP) | Manual refresh, bounded retry and original-source freshness work; periodic retrieval is excluded by clarify Decision 8. No background fetch is enabled. | Out of scope O3; implemented MVP subset |
| S6.3 | Source retrieval timestamps, not page/client time | Yes | Pass | Provider fields/definitions and original retrieval times retained; metric coverage tracked across all rows/days. Missing fields are unsupported, never partial sums disguised as complete totals. E7/E8/E9; gap regressions. | Implemented — real gap closed |
| S6.4 | Honor rate limits; bounded and non-duplicate work | Yes | Pass | Deduplicates scoped in-flight reports, caps active work at four per tenant/100 per Jira or provider work pool, aborts effect requests, reuses initial provider cache and bypasses on manual refresh. Cache includes board and tenant/page/widget/viewer/provider/period; configuration changes purge widget reports and prevent late cache repopulation. E9/E12; gap regressions. | Implemented — real gap closed |
| S6.5 | Retained results have age/stale warning and separate failure | Yes | Pass | Jira/provider/bootstrap states preserve bounded safe messages, retry and correlation details. Panels reflect loading/stale/permission/rate states; clock ageing performs no upstream polling. Denial clears protected retained data. E5/E9/E10; gap regressions. | Implemented — real gap closed |
| S7.1 | Verified secure backend secret provisioning | Partial | Unverified | Readiness/editor controls and installation-bound deployment-secret reads implemented. Actual installation and protected secret-manager provisioning require the trusted deployment. E11/E13. | Real gap — Pending P1/P4 |
| S7.2 | No credentials in config/responses/bundle/URL/logs | Yes | Pass | Secret-field rejection and synthetic containment tests; current browser bundle contains no provider credential code. Production secrets not audited. E1/E2/E7/E11. | Verified local; no implementation gap |
| S7.3 | Distinct readiness outcomes | Yes | Pass | Ready/configured/missing/permission/unsupported/transient tested. E11. | Verified local; no implementation gap |
| S7.4 | Read-only reporting access where supported | Partial | Unverified | Read-only adapters, safe probes, allowlist and readiness validation work locally. The UI shows only returned allowlisted counters, not an unverified account capability matrix. Real account scopes/results/windows remain unverified. E7/E8/E11. | Real gap — Pending P2 |
| S7.5 | Advertise capabilities only after account verification | Partial | Unverified | Read-only adapters, safe probes, allowlist and readiness validation work locally. The UI shows only returned allowlisted counters, not an unverified account capability matrix. Real account scopes/results/windows remain unverified. E7/E8/E11. | Real gap — Pending P2 |

## Section 5: every functional requirement

| ID | Requirement | Implemented? | Works? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- | --- |
| FR-001 | Confluence-embeddable dashboard, not gadget | Partial | Unverified | Local host-module loading, trusted editor/admin/context checks, viewer Jira token forwarding, fail-closed denials and configuration UI tested. Deploy-specific macro/session verifier and installation hook must be supplied and validated. E1/E2/E13; host-loader tests. | Real gap — Pending P1 |
| FR-002 | Exactly one board; independently enabled configured providers | Yes | Pass | Trusted editor/admin checks; paginated board and ready-source choices; save validates board access, optional board estimate field and provider readiness. Safe errors, save and cancel tested. E1; backend regressions; mounted controls. | Implemented — real gap closed |
| FR-003 | Non-secret config validated on backend operations | Yes | Pass | Trusted editor/admin checks; paginated board and ready-source choices; save validates board access, optional board estimate field and provider readiness. Safe errors, save and cancel tested. E1; backend regressions; mounted controls. | Implemented — real gap closed |
| FR-004 | Loading/empty/partial/stale/permission/rate/unavailable/failed UI | Yes | Pass | Jira/provider/bootstrap states preserve bounded safe messages, retry and correlation details. Panels reflect loading/stale/permission/rate states; clock ageing performs no upstream polling. Denial clears protected retained data. E5/E9/E10; gap regressions. | Implemented — real gap closed |
| FR-005 | Preserve successful sources with explicit incompleteness | Yes | Pass | Each provider fails independently, including missing secrets/unexpected exceptions. Overall dashboard derives partial status from source outcomes while preserving good values. E7/E9/E10; gap regressions. | Implemented — real gap closed |
| FR-006 | Viewer-scoped Jira authorization | Partial | Unverified | Local host-module loading, trusted editor/admin/context checks, viewer Jira token forwarding, fail-closed denials and configuration UI tested. Deploy-specific macro/session verifier and installation hook must be supplied and validated. E1/E2/E13; host-loader tests. | Real gap — Pending P1 |
| FR-007 | Configured-board history and active identification | Yes | Pass | Active/historical choices, explicit bounded-list notice, groups and manual history implemented. Sprint change/manual refresh tested in mounted DOM; history verified in PostgreSQL. E3–E6; gap regressions. | Implemented — real gap closed |
| FR-008 | Correct story/task/bug sprint issue scope | Yes | Pass | E3/E4 filtering and membership tests. | Verified local; no implementation gap |
| FR-009 | Metadata, progress, groups, links, retrieval, coverage | Yes | Pass | Renders status/type tables, Jira links, active/closed labels, coverage, retrieval time and selected sprint dates. E4/E5; mounted controls. | Implemented — real gap closed |
| FR-010 | Confirmed/configured rules; no silent unresolved mappings | Partial | Unverified | Clarify Decision 4 selects Done category; blocker names and board estimate field are explicit configurable preferences. Verify these rules against the intended real board. E1/E4. | Real gap — Pending P2 |
| FR-011 | Burndown only from timestamped, sourced observations | Yes | Pass | Migration 003 stores only complete classified issue counts from manual refresh, scoped by installation/widget/viewer/board/sprint. History exposes dated points/provenance and precise last-observation time, capped to 500 points; initial reads do not invent observations. Thirty-day filtering/expiry and cascade purge tested. E6; PostgreSQL gap regression. | Implemented — real gap closed |
| FR-012 | Three independent optional providers | Yes | Pass | Provider enum/allowlist, adapter implementations and per-widget subset. E1/E7/E11. | Verified local; no implementation gap |
| FR-013 | Preserve provider names/definitions/units/currency/period/source | Yes | Pass | Provider fields/definitions and original retrieval times retained; metric coverage tracked across all rows/days. Missing fields are unsupported, never partial sums disguised as complete totals. E7/E8/E9; gap regressions. | Implemented — real gap closed |
| FR-014 | Requested and actual provider-supported date range | Partial | Unverified | Date controls, inclusive UTC 31-day cap and actual coverage/completeness work. Missing days/fields are explicitly partial. Real organization-specific retention/available bounds require authorized-account evidence. E5/E7; gap regressions. | Real gap — Pending P2 |
| FR-015 | Only supported and audience-authorized team/individual metrics | Partial | Unverified | Only allowlisted organization/team counters are collected; default deployment secrets are bound to one approved installation and page access is host-controlled. Individual feature is Out of scope O1; actual organization/audience approval is unverified. E2/E7/E11. | Real gap — Pending P2/P4 |
| FR-016 | Email-only matching; unmatched remain unmatched | Out of scope | N/A | Individual identity collection, email matching and unmatched groups are explicitly excluded by clarify Decisions 2/6. | Out of scope O1 |
| FR-017 | Estimates labeled with basis/source/period | Out of scope | N/A | No estimated/monetary metric producer or persistence is enabled under clarify Decisions 5/18. Current metrics are reported integer counters. | Out of scope O2 |
| FR-018 | No unlike-metric/unit/currency aggregation | Yes | Pass | Integer-safe compatible output-token aggregation; incompatible data rejected. E8. | Verified local; no implementation gap |
| FR-019 | Manual refresh UI | Yes | Pass | Refresh helpers/request scope and mounted native button click verified; real browser/site remains P3. E5/E9. | Verified local; no implementation gap |
| FR-020 | Gate periodic refresh on platform/rate/auth verification | Yes (MVP) | Pass (MVP) | Manual refresh, bounded retry and original-source freshness work; periodic retrieval is excluded by clarify Decision 8. No background fetch is enabled. | Out of scope O3; implemented MVP subset |
| FR-021 | Cache source/period/time/completeness and applicable isolation | Yes | Pass | Deduplicates scoped in-flight reports, caps active work at four per tenant/100 per Jira or provider work pool, aborts effect requests, reuses initial provider cache and bypasses on manual refresh. Cache includes board and tenant/page/widget/viewer/provider/period; configuration changes purge widget reports and prevent late cache repopulation. E9/E12; gap regressions. | Implemented — real gap closed |
| FR-022 | Minimized reporting persistence with retention/deletion | Partial | Unverified | Widget config/count snapshots cascade on tenant deletion; report cache expires and purges on settings changes. Manual observations are filtered/expired at 30 days; host module can register removal callback. Actual uninstall delivery and external secret revocation need production validation. E6/E12/E13. | Real gap — Pending P1/P4 |
| FR-023 | Safe logs with operation/correlation/duration/category | Yes | Pass | Safe normalized request logs carry route template, generated correlation ID, duration and error category. Configuration/body/auth/report errors include safe code/message/correlation/retryability. No query/body/payload logging. E1/E2; gap regressions. | Implemented — real gap closed |

## Section 6: every UI surface and shared state

| Requirement | Implemented? | Works? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- |
| 6.1 Header: board/team, selected sprint/state, refresh/loading | Yes (MVP) | Pass (MVP) | Header identifies configured board ID; selected sprint/state/active labels and refresh/loading work. Friendly board-name lookup is optional. E5; mounted controls. | Nice-to-have N1; required behavior works |
| 6.1 Sprint controls: history, active indicator, dates | Yes | Pass | Renders status/type tables, Jira links, active/closed labels, coverage, retrieval time and selected sprint dates. E4/E5; mounted controls. | Implemented — real gap closed |
| 6.1 Summary: explicit units and estimate coverage | Yes | Pass | Issue labels and point/coverage states verified in markup. E5. | Verified local; no implementation gap |
| 6.1 Burndown: accessible chart/table, coverage, last observation | Yes | Pass | Migration 003 stores only complete classified issue counts from manual refresh, scoped by installation/widget/viewer/board/sprint. History exposes dated points/provenance and precise last-observation time, capped to 500 points; initial reads do not invent observations. Thirty-day filtering/expiry and cascade purge tested. E6; PostgreSQL gap regression. | Implemented — real gap closed |
| 6.1 Blocker metadata and Jira links | Yes | Pass | Blocker count/list/link/assignee fixtures render. E5. | Verified local; no implementation gap |
| 6.1 Work breakdown grouped by status/type | Yes | Pass | Renders status/type tables, Jira links, active/closed labels, coverage, retrieval time and selected sprint dates. E4/E5; mounted controls. | Implemented — real gap closed |
| 6.1 AI date and enabled-provider selection controls | Yes | Pass | Editable usage dates and enabled-source checkboxes update scoped requests; deselecting all sources omits usage requests. Backend enforces 31 inclusive UTC days. E5/E7; mounted controls. | Implemented — real gap closed; Nice-to-have N2 |
| 6.1 Usage sources/totals/units/currencies/period/freshness/coverage | Yes (MVP) | Pass (MVP) | Reported team counters, source-native definitions, compatible totals, exact integer serialization, date/coverage/status and independent failures implemented. Individual/unmatched/estimate/monetary extensions excluded by clarify Decisions 2/5/6/18. E7–E10. | Out of scope O1/O2; implemented MVP subset |
| 6.1 Per-source safe outcome detail | Yes | Pass | Jira/provider/bootstrap states preserve bounded safe messages, retry and correlation details. Panels reflect loading/stale/permission/rate states; clock ageing performs no upstream polling. Denial clears protected retained data. E5/E9/E10; gap regressions. | Implemented — real gap closed |
| 6.1 Keyboard/semantic/non-color presentation | Partial | Unverified | Native labeled controls, headings, text states and accessible history table exist; mounted selection/configuration/save/cancel/refresh tests pass. Actual keyboard/screen-reader/browser audit remains pending. E5/E6/E10. | Real gap — Pending P3 |
| 6.2 Board selection and validation result | Yes | Pass | Trusted editor/admin checks; paginated board and ready-source choices; save validates board access, optional board estimate field and provider readiness. Safe errors, save and cancel tested. E1; backend regressions; mounted controls. | Implemented — real gap closed |
| 6.2 Checkboxes restricted to configured/available providers | Yes | Pass | Trusted editor/admin checks; paginated board and ready-source choices; save validates board access, optional board estimate field and provider readiness. Safe errors, save and cancel tested. E1; backend regressions; mounted controls. | Implemented — real gap closed |
| 6.2 Approved non-secret reporting preference controls | Yes | Pass | Trusted editor/admin checks; paginated board and ready-source choices; save validates board access, optional board estimate field and provider readiness. Safe errors, save and cancel tested. E1; backend regressions; mounted controls. | Implemented — real gap closed |
| 6.2 Save/cancel and actionable errors | Yes | Pass | Trusted editor/admin checks; paginated board and ready-source choices; save validates board access, optional board estimate field and provider readiness. Safe errors, save and cancel tested. E1; backend regressions; mounted controls. | Implemented — real gap closed |
| 6.2 No secret input fields | Yes | Pass | Dashboard, readiness and implemented configuration form contain no secret inputs; mounted save/cancel test confirms this. E5/E11. | Verified local; no implementation gap |
| 6.3 Secure admin provider configuration and readiness | Partial | Unverified | Readiness/editor controls and installation-bound deployment-secret reads implemented. Actual installation and protected secret-manager provisioning require the trusted deployment. E11/E13. | Real gap — Pending P1/P4 |
| 6.4 Loading identifies refreshing sources and old-data status | Yes | Pass | Jira/provider/bootstrap states preserve bounded safe messages, retry and correlation details. Panels reflect loading/stale/permission/rate states; clock ageing performs no upstream polling. Denial clears protected retained data. E5/E9/E10; gap regressions. | Implemented — real gap closed |
| 6.4 Empty means successful no-record query | Yes | Pass | Empty statuses and nonzero-substitution fixtures. E7/E10. | Verified local; no implementation gap |
| 6.4 Zero only for successfully reported numeric zero | Yes | Pass | Metric and rendered zero tests. E7/E8/E10. | Verified local; no implementation gap |
| 6.4 Partial identifies failed/incomplete sources | Yes | Pass | Each provider fails independently, including missing secrets/unexpected exceptions. Overall dashboard derives partial status from source outcomes while preserving good values. E7/E9/E10; gap regressions. | Implemented — real gap closed |
| 6.4 Stale has original last-success and warning | Yes | Pass | Jira/provider/bootstrap states preserve bounded safe messages, retry and correlation details. Panels reflect loading/stale/permission/rate states; clock ageing performs no upstream polling. Denial clears protected retained data. E5/E9/E10; gap regressions. | Implemented — real gap closed |
| 6.4 Unavailable explains unsupported source/history | Yes | Pass | Unsupported/history messages render without zero. E6/E10. | Verified local; no implementation gap |
| 6.4 Permission denied explains access safely | Yes | Pass | Jira/provider/bootstrap states preserve bounded safe messages, retry and correlation details. Panels reflect loading/stale/permission/rate states; clock ageing performs no upstream polling. Denial clears protected retained data. E5/E9/E10; gap regressions. | Implemented — real gap closed |
| 6.4 Rate-limited/failed has safe retry guidance | Yes | Pass | Jira/provider/bootstrap states preserve bounded safe messages, retry and correlation details. Panels reflect loading/stale/permission/rate states; clock ageing performs no upstream polling. Denial clears protected retained data. E5/E9/E10; gap regressions. | Implemented — real gap closed |

## Section 7: API contracts

Route names are proposals. Alternative routes are acceptable only if the logical
behavior and authorization requirements are preserved.

| Requirement / operation | Implemented? | Works? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- |
| 7.1 Trusted installation/caller, no client identity authority | Yes | Pass | Injected middleware context and rejection tests. Host adapter remains external. E2. | Verified local; no implementation gap |
| 7.1 IDs/enums/dates/pagination/request size validation | Yes | Pass | ID/enum/date/page/request-size checks are enforced. Audit correction: config and Jira already share the same opaque identifier pattern; the actual missing board access validation is now implemented. E1/E3/E7; gap regressions. | Implemented — real gap closed |
| 7.1 No arbitrary client URLs/hosts/endpoints | Yes | Pass | Client API accepts IDs only; deployment Jira origin validated. Copilot file URL comes from upstream and is HTTPS/local-host checked, without credentials. E3/E7. | Verified local; no implementation gap |
| 7.1 Only normalized necessary fields, no raw payload/secrets | Yes | Pass | Parsers/allowlist produce bounded normalized fields; synthetic secrecy tests. E3/E7/E8. | Verified local; no implementation gap |
| 7.1 Consistent error envelope with message/ID/retryability | Yes | Pass | Safe normalized request logs carry route template, generated correlation ID, duration and error category. Configuration/body/auth/report errors include safe code/message/correlation/retryability. No query/body/payload logging. E1/E2; gap regressions. | Implemented — real gap closed |
| Read dashboard configuration | Yes | Pass | `/api/v1/dashboard/context` returns widget ID/config/admin flag through trusted scope. E1; no readiness summary. | Verified local; no implementation gap |
| Save dashboard configuration | Yes | Pass | Trusted editor/admin checks; paginated board and ready-source choices; save validates board access, optional board estimate field and provider readiness. Safe errors, save and cancel tested. E1; backend regressions; mounted controls. | Implemented — real gap closed |
| List boards | Yes | Pass | Viewer-scoped bounded paging/labels; optional text query is Nice-to-have N4. E3. | Nice-to-have N4; required behavior works |
| List sprints | Yes | Pass | Viewer token, state filter, paging, names/dates/active flag. E3. | Verified local; no implementation gap |
| Read sprint report | Yes | Pass | Migration 003 stores only complete classified issue counts from manual refresh, scoped by installation/widget/viewer/board/sprint. History exposes dated points/provenance and precise last-observation time, capped to 500 points; initial reads do not invent observations. Thirty-day filtering/expiry and cascade purge tested. E6; PostgreSQL gap regression. | Implemented — real gap closed |
| Read usage report | Yes (MVP) | Pass (MVP) | Reported team counters, source-native definitions, compatible totals, exact integer serialization, date/coverage/status and independent failures implemented. Individual/unmatched/estimate/monetary extensions excluded by clarify Decisions 2/5/6/18. E7–E10. | Out of scope O1/O2; implemented MVP subset |
| Refresh dashboard data | Yes | Pass | Deduplicates scoped in-flight reports, caps active work at four per tenant/100 per Jira or provider work pool, aborts effect requests, reuses initial provider cache and bypasses on manual refresh. Cache includes board and tenant/page/widget/viewer/provider/period; configuration changes purge widget reports and prevent late cache repopulation. E9/E12; gap regressions. | Implemented — real gap closed |
| Read admin source readiness | Yes (MVP) | Pass (MVP) | Required tenant identity/config boundary and live readiness work; secret lookup is installation-bound and secrets stay in deployment storage. Optional lifecycle/capability persistence is non-binding; no comprehensive registry is required by clarify Decision 5. E1/E11. | Nice-to-have N3; required behavior works |
| 7.3 Illustrative response behavior | Yes (MVP) | Pass (MVP) | Reported team counters, source-native definitions, compatible totals, exact integer serialization, date/coverage/status and independent failures implemented. Individual/unmatched/estimate/monetary extensions excluded by clarify Decisions 2/5/6/18. E7–E10. | Out of scope O1/O2; implemented MVP subset |
| 7.3 Exact monetary serialization | Out of scope | N/A | No estimated/monetary metric producer or persistence is enabled under clarify Decisions 5/18. Current metrics are reported integer counters. | Out of scope O2 |

## Section 8: logical data model and lifecycle

The specification permits ephemeral responses and does not require every entity
or the proposed SQL table shape to be persisted.

| Requirement | Implemented? | Works? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- |
| Prefer retrieval/cache; persist reporting only when justified | Yes | Pass | Widget settings and justified manual count observations persist; provider reports stay in memory; no issue summaries/raw payloads persist. E1/E12. | Verified local; no implementation gap |
| Installation tenant identity/status/timestamps | Yes (MVP) | Pass (MVP) | Required tenant identity/config boundary and live readiness work; secret lookup is installation-bound and secrets stay in deployment storage. Optional lifecycle/capability persistence is non-binding; no comprehensive registry is required by clarify Decision 5. E1/E11. | Nice-to-have N3; required behavior works |
| WidgetConfig: unique tenant/widget, schema/board/providers/preferences/time | Yes | Pass | Composite primary key, JSON validation, migrations, DB tests. E1. | Verified local; no implementation gap |
| ProviderConfig: tenant/org, readiness, secret reference, scopes/capabilities | Yes (MVP) | Pass (MVP) | Required tenant identity/config boundary and live readiness work; secret lookup is installation-bound and secrets stay in deployment storage. Optional lifecycle/capability persistence is non-binding; no comprehensive registry is required by clarify Decision 5. E1/E11. | Nice-to-have N3; required behavior works |
| SprintSnapshot: timestamped scoped observation and ≤30-day retention | Yes | Pass | Migration 003 stores only complete classified issue counts from manual refresh, scoped by installation/widget/viewer/board/sprint. History exposes dated points/provenance and precise last-observation time, capped to 500 points; initial reads do not invent observations. Thirty-day filtering/expiry and cascade purge tested. E6; PostgreSQL gap regression. | Implemented — real gap closed |
| UsageMetric: decimal-safe value/source/period/status/kind/basis | Yes (MVP) | Pass (MVP) | Reported team counters, source-native definitions, compatible totals, exact integer serialization, date/coverage/status and independent failures implemented. Individual/unmatched/estimate/monetary extensions excluded by clarify Decisions 2/5/6/18. E7–E10. | Out of scope O1/O2; implemented MVP subset |
| UsageIdentity: provider identity/email/match state | Out of scope | N/A | Individual identity collection, email matching and unmatched groups are explicitly excluded by clarify Decisions 2/6. | Out of scope O1 |
| SourceResult: status/error/period/time/completeness/correlation | Yes | Pass | Original timestamps, requested/actual period, partial metric coverage and normalized safe errors are retained. HTTP response/failure correlation supplies diagnostics; per-success-source IDs are non-binding optional shape. E7/E9/E12. | Implemented — real gap closed |
| CacheEntry: scoped normalized result/time/expiry/completeness | Yes | Pass | Deduplicates scoped in-flight reports, caps active work at four per tenant/100 per Jira or provider work pool, aborts effect requests, reuses initial provider cache and bypasses on manual refresh. Cache includes board and tenant/page/widget/viewer/provider/period; configuration changes purge widget reports and prevent late cache repopulation. E9/E12; gap regressions. | Implemented — real gap closed |
| 8.2 Relational schema/types/indexes/migrations finalized for chosen stack | Yes | Pass | Three idempotent PostgreSQL migrations provide config and manual count observations with tenant foreign keys and expiry index; optional illustrative entities need not be persisted. E1/E6/E13; PostgreSQL tests. | Implemented — real gap closed |
| 8.2 No persisted Jira summaries/full provider payloads by default | Yes | Pass | Only scoped timestamped count observations persist; no Jira issue summaries or full provider payloads. E1/E12. | Verified local; no implementation gap |
| 8.2 Tenant scope in repository and schema | Yes | Pass | Parameterized tenant/widget lookups, composite key and cascade tested. E1. Provider secret scope is a separate gap. | Verified local; no implementation gap |
| 8.3 Exact monetary storage/serialization | Out of scope | N/A | No estimated/monetary metric producer or persistence is enabled under clarify Decisions 5/18. Current metrics are reported integer counters. | Out of scope O2 |
| 8.3 Store source-native units/currency | Yes | Pass | All accepted metrics carry unit/currency; currencies currently null. E7/E8. | Verified local; no implementation gap |
| 8.3 Reported zero versus absence/status | Yes | Pass | Zero/empty/error fixtures; no synthesized missing values. E7/E8. | Verified local; no implementation gap |
| 8.3 Separate cache expiry from persistent retention | Yes | Pass | Six-hour provider serve threshold, physical 24-hour cache expiry and separate 30-day count observation filtering/expiry. E12. | Verified local; no implementation gap |
| 8.3 Delete/expire tenant/source data on removal/retention | Partial | Unverified | Widget config/count snapshots cascade on tenant deletion; report cache expires and purges on settings changes. Manual observations are filtered/expired at 30 days; host module can register removal callback. Actual uninstall delivery and external secret revocation need production validation. E6/E12/E13. | Real gap — Pending P1/P4 |
| 8.3 No raw payload persistence without reviewed requirement | Yes | Pass | No raw-payload storage/logging path in reviewed implementation. | Verified local; no implementation gap |

## Section 9: error and source-status model

| Requirement | Implemented? | Works? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- |
| Typed success/partial/stale/unavailable/permission/rate/failed | Yes | Pass | Shared unions, provider outcomes and status labels; Jira source response itself supports success/partial and errors use separate envelope. E2/E4/E7/E10. | Verified local; no implementation gap |
| Empty separate from numeric zero and failure | Yes | Pass | Adapter/policy/UI fixtures explicitly verify distinction. E7/E8/E10. | Verified local; no implementation gap |
| Stable safe code, actionable message, correlation, retryability | Yes | Pass | Jira/provider/bootstrap states preserve bounded safe messages, retry and correlation details. Panels reflect loading/stale/permission/rate states; clock ageing performs no upstream polling. Denial clears protected retained data. E5/E9/E10; gap regressions. | Implemented — real gap closed |
| No sensitive bodies or credentials in errors | Yes | Pass | Synthetic provider-secret/auth-failure/malformed-body tests; actual host/production logging unverified. E2/E7/E11. | Verified local; no implementation gap |

## Section 10: every security/privacy requirement

| Requirement | Implemented? | Works? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- |
| Authenticate/authorize backend reporting/config operations | Partial | Unverified | Local host-module loading, trusted editor/admin/context checks, viewer Jira token forwarding, fail-closed denials and configuration UI tested. Deploy-specific macro/session verifier and installation hook must be supplied and validated. E1/E2/E13; host-loader tests. | Real gap — Pending P1 |
| Respect Confluence page and Jira user permissions | Partial | Unverified | Local host-module loading, trusted editor/admin/context checks, viewer Jira token forwarding, fail-closed denials and configuration UI tested. Deploy-specific macro/session verifier and installation hook must be supplied and validated. E1/E2/E13; host-loader tests. | Real gap — Pending P1 |
| Least-privilege Jira/provider read access | Partial | Unverified | Read-only adapters, safe probes, allowlist and readiness validation work locally. The UI shows only returned allowlisted counters, not an unverified account capability matrix. Real account scopes/results/windows remain unverified. E7/E8/E11. | Real gap — Pending P2 |
| Keep secrets server-side/out of config/client/URL/logs | Yes | Pass | Environment reads, request headers, validation and synthetic containment tests. Production secret-manager integration unverified. E1/E7/E11. | Verified local; no implementation gap |
| Validate/constrain inputs and configured provider choices | Yes | Pass | Trusted editor/admin checks; paginated board and ready-source choices; save validates board access, optional board estimate field and provider readiness. Safe errors, save and cancel tested. E1; backend regressions; mounted controls. | Implemented — real gap closed |
| Prevent tenant/widget/board/provider leakage | Partial | Unverified | Tenant/widget/page/viewer/board/provider keys, viewer-scoped history, installation-bound secrets and purge denial are tested. Real platform identity/token and approved provider organizations require deployment evidence. E1/E2/E12; gap regressions. | Real gap — Pending P1/P2 |
| Minimize individual/email collection and retention | Yes | Pass | Provider requests avoid user dimensions; no identity storage; cache bounded/expiring. E7/E12. | Verified local; no implementation gap |
| Approval and audience policy before individual production usage | Out of scope | N/A | Individual usage remains disabled and outside MVP. Any future enablement must first obtain privacy/audience approval. | Out of scope O1 |
| Verify provider terms/permissions/retention/residency before production | Partial | Unverified | Local minimization, 30-day count retention, expiring cache and tenant purge implemented. Production terms/residency/privacy/security review and external secret lifecycle remain open. E12/E13. | Real gap — Pending P4 |
| Redact/minimize operational tokens/emails/detailed usage | Yes | Pass | Request logs contain route template, safe correlation, duration and error category, with no query/body/provider payloads. Tested secret containment; host logging remains production review P4. E2; gap regressions. | Implemented — real gap closed |

## Section 11: every non-functional requirement

| Area | Implemented? | Works? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- |
| Authorization | Partial | Unverified | Tenant/widget/page/viewer/board/provider keys, viewer-scoped history, installation-bound secrets and purge denial are tested. Real platform identity/token and approved provider organizations require deployment evidence. E1/E2/E12; gap regressions. | Real gap — Pending P1/P2 |
| Integrity | Yes (MVP) | Pass (MVP) | Reported team counters, source-native definitions, compatible totals, exact integer serialization, date/coverage/status and independent failures implemented. Individual/unmatched/estimate/monetary extensions excluded by clarify Decisions 2/5/6/18. E7–E10. | Out of scope O1/O2; implemented MVP subset |
| Performance | Partial | Unverified | Issue/page/date/cache/concurrency limits, upstream timeouts, request deduplication and initial provider cache reuse are implemented. Three-second target for ≤500 issues/three providers is documented but not measured in actual deployment. E9/E12/E13. | Real gap — Pending P3 |
| Accessibility | Partial | Unverified | Native labeled controls, headings, text states and accessible history table exist; mounted selection/configuration/save/cancel/refresh tests pass. Actual keyboard/screen-reader/browser audit remains pending. E5/E6/E10. | Real gap — Pending P3 |
| Maintainability | Yes | Pass | Typed adapters, services, repositories and fixture tests; some named provider client/resolver/cache files are empty placeholders rather than active implementations. E3/E4/E7. | Verified local; no implementation gap |
| Privacy | Partial | Unverified | Local minimization, 30-day count retention, expiring cache and tenant purge implemented. Production terms/residency/privacy/security review and external secret lifecycle remain open. E12/E13. | Real gap — Pending P4 |
| Compatibility | Partial | Unverified | React/Vite + Express + PostgreSQL baseline is explicit in specification and synchronized decisions; Forge-only legacy plan is superseded by clarify Decisions 1/13 (O4). Build passes. Actual Confluence macro deployment/approval remains unverified. E13. | Real gap — Pending P1 |

## Section 12: every success criterion

| ID | Implemented? | Works? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- |
| SC-001 — Correct Jira scope | Yes | Pass | Filtering/membership/count/estimate fixtures. E3/E4. | Verified local; no implementation gap |
| SC-002 — No false zeroes | Yes | Pass | Reported zero remains valid; empty/missing/error states remain separate. Missing Anthropic/Copilot fields across records/days now produce partial/unsupported output without an incomplete numeric total. E7/E8; gap regressions. | Implemented — real gap closed |
| SC-003 — Transparent coverage | Yes | Pass | Provider fields/definitions and original retrieval times retained; metric coverage tracked across all rows/days. Missing fields are unsupported, never partial sums disguised as complete totals. E7/E8/E9; gap regressions. | Implemented — real gap closed |
| SC-004 — Safe aggregation | Yes | Pass | Definitions/units/currencies/period checks and bigint arithmetic tested. E8. | Verified local; no implementation gap |
| SC-005 — Reliable identity handling | Out of scope | N/A | Individual identity collection, email matching and unmatched groups are explicitly excluded by clarify Decisions 2/6. | Out of scope O1 |
| SC-006 — Enforced access boundaries | Partial | Unverified | Tenant/widget/page/viewer/board/provider keys, viewer-scoped history, installation-bound secrets and purge denial are tested. Real platform identity/token and approved provider organizations require deployment evidence. E1/E2/E12; gap regressions. | Real gap — Pending P1/P2 |
| SC-007 — Secret containment | Yes | Pass | Synthetic boundary tests/current code review; actual deployment secrets/logging not verified. E1/E2/E7/E11. | Verified local; no implementation gap |
| SC-008 — Honest history | Yes | Pass | Migration 003 stores only complete classified issue counts from manual refresh, scoped by installation/widget/viewer/board/sprint. History exposes dated points/provenance and precise last-observation time, capped to 500 points; initial reads do not invent observations. Thirty-day filtering/expiry and cascade purge tested. E6; PostgreSQL gap regression. | Implemented — real gap closed |
| SC-009 — Usable partial operation | Yes | Pass | Each provider fails independently, including missing secrets/unexpected exceptions. Overall dashboard derives partial status from source outcomes while preserving good values. E7/E9/E10; gap regressions. | Implemented — real gap closed |
| SC-010 — Accessible reporting | Partial | Unverified | Native labeled controls, headings, text states and accessible history table exist; mounted selection/configuration/save/cancel/refresh tests pass. Actual keyboard/screen-reader/browser audit remains pending. E5/E6/E10. | Real gap — Pending P3 |
| SC-011 — Verified integrations | Partial | Unverified | Read-only adapters, safe probes, allowlist and readiness validation work locally. The UI shows only returned allowlisted counters, not an unverified account capability matrix. Real account scopes/results/windows remain unverified. E7/E8/E11. | Real gap — Pending P2 |

## Section 13: verification, site validation and release gates

### Automated verification requirements

| Requirement | Implemented? | Works? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- |
| Units cover normalization/metrics/currency/identity/Jira/progress/status | Yes (MVP) | Pass (MVP) | 107 passing tests cover implemented rules, field completeness, zero, stale/partial states, permission denial, PostgreSQL history/purge and mounted controls. Identity/cost production scenarios are excluded; monetary/estimated values are rejected by policy. | Out of scope O1/O2; implemented MVP subset |
| Edge cases: estimates, missing/duplicate emails, zero, missing metrics, currency, partial, stale, history | Yes (MVP) | Pass (MVP) | 107 passing tests cover implemented rules, field completeness, zero, stale/partial states, permission denial, PostgreSQL history/purge and mounted controls. Identity/cost production scenarios are excluded; monetary/estimated values are rejected by policy. | Out of scope O1/O2; implemented MVP subset |
| Auth tests cover validation/page/Jira/tenant/widget/cache isolation | Partial | Unverified | Tenant/widget/page/viewer/board/provider keys, viewer-scoped history, installation-bound secrets and purge denial are tested. Real platform identity/token and approved provider organizations require deployment evidence. E1/E2/E12; gap regressions. | Real gap — Pending P1/P2 |
| Integration tests cover pagination/rate limits/capability bounds | Yes | Pass | Fixture tests cover bounded pagination, 31-day range, rate retry policy and source completeness. 107 tests pass; actual account limits remain separately pending P2. E3/E7/E9. | Implemented — real gap closed |
| Formatting/lint/type/build/focused tests | Yes | Pass | Current checks pass; format command now covers nested source/test directories and shared types. | Verified local; no implementation gap |

### Site-validation checklist

| ID | Requirement | Implemented? | Works on site? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- | --- |
| SV-1 | Authorized editor adds/configures widget | Partial | Unverified | Local configuration/isolation, active/history selection, issue rules, manual history, refresh, denial and stale behavior are tested. This row is a site-validation criterion; no actual Confluence/Jira/provider site exercise has been performed. E1–E13; mounted controls and PostgreSQL regressions. | Real gap — Pending P1/P2/P3 |
| SV-2 | Two widgets have distinct boards/sources | Partial | Unverified | Local configuration/isolation, active/history selection, issue rules, manual history, refresh, denial and stale behavior are tested. This row is a site-validation criterion; no actual Confluence/Jira/provider site exercise has been performed. E1–E13; mounted controls and PostgreSQL regressions. | Real gap — Pending P1/P2/P3 |
| SV-3 | Viewer chooses active/historical sprint and usage dates | Partial | Unverified | Local configuration/isolation, active/history selection, issue rules, manual history, refresh, denial and stale behavior are tested. This row is a site-validation criterion; no actual Confluence/Jira/provider site exercise has been performed. E1–E13; mounted controls and PostgreSQL regressions. | Real gap — Pending P1/P2/P3 |
| SV-4 | Issue inclusion/exclusion matches scope | Partial | Unverified | Local configuration/isolation, active/history selection, issue rules, manual history, refresh, denial and stale behavior are tested. This row is a site-validation criterion; no actual Confluence/Jira/provider site exercise has been performed. E1–E13; mounted controls and PostgreSQL regressions. | Real gap — Pending P1/P2/P3 |
| SV-5 | Progress/blockers/history agree with source | Partial | Unverified | Local configuration/isolation, active/history selection, issue rules, manual history, refresh, denial and stale behavior are tested. This row is a site-validation criterion; no actual Confluence/Jira/provider site exercise has been performed. E1–E13; mounted controls and PostgreSQL regressions. | Real gap — Pending P1/P2/P3 |
| SV-6 | Reported/estimated/unmatched/unavailable visually distinct | Yes (MVP) | Unverified on site | Reported/zero/partial/unavailable distinctions are tested locally; individual unmatched and estimates are excluded. Actual site validation of the MVP presentation remains pending P3. | Out of scope O1/O2; real site gap Pending P3 |
| SV-7 | Users lacking page/Jira access cannot retrieve protected data | Partial | Unverified | Local configuration/isolation, active/history selection, issue rules, manual history, refresh, denial and stale behavior are tested. This row is a site-validation criterion; no actual Confluence/Jira/provider site exercise has been performed. E1–E13; mounted controls and PostgreSQL regressions. | Real gap — Pending P1/P2/P3 |
| SV-8 | Refresh/timestamps/stale/rate limits correct | Partial | Unverified | Local configuration/isolation, active/history selection, issue rules, manual history, refresh, denial and stale behavior are tested. This row is a site-validation criterion; no actual Confluence/Jira/provider site exercise has been performed. E1–E13; mounted controls and PostgreSQL regressions. | Real gap — Pending P1/P2/P3 |
| SV-9 | Individual production usage stays disabled before approval | Yes | Pass | No individual feature exists. Does not establish privacy approval. | Verified local; no implementation gap |

### Release gates

| Gate | Implemented? | Works / satisfied? | Evidence / gap | Disposition |
| --- | --- | --- | --- | --- |
| Individual approval/audience before enabling feature | Out of scope | N/A | Individual usage remains disabled and outside MVP. Any future enablement must first obtain privacy/audience approval. | Out of scope O1 |
| Claim metrics/identity/date/history only after authorized verification | Partial | Unverified | Read-only adapters, safe probes, allowlist and readiness validation work locally. The UI shows only returned allowlisted counters, not an unverified account capability matrix. Real account scopes/results/windows remain unverified. E7/E8/E11. | Real gap — Pending P2 |
| Record/approve runtime architecture consistency | Partial | Unverified | React/Vite + Express + PostgreSQL baseline is explicit in specification and synchronized decisions; Forge-only legacy plan is superseded by clarify Decisions 1/13 (O4). Build passes. Actual Confluence macro deployment/approval remains unverified. E13. | Real gap — Pending P1 |

## Sections 14–15: decisions, dependencies and delivery sequence

These sections contain planning decisions and prerequisites rather than new
runtime acceptance tests. Their resolution is recorded separately.

| Open decision / prerequisite | Implemented or resolved? | Works / verified? | Evidence / remaining action | Disposition |
| --- | --- | --- | --- | --- |
| 14.1 Runtime and host integration | Partial | Unverified | Local host-module loading, trusted editor/admin/context checks, viewer Jira token forwarding, fail-closed denials and configuration UI tested. Deploy-specific macro/session verifier and installation hook must be supplied and validated. E1/E2/E13; host-loader tests. | Real gap — Pending P1 |
| 14.2 Progress unit/field/fallback | Yes | Pass | Clarify Decision 3; issue counts, optional board estimate and null semantics tested. E4. | Verified local; no implementation gap |
| 14.3 Completion/blocker workflow rules | Partial | Unverified | Clarify Decision 4 selects Done category; blocker names and board estimate field are explicit configurable preferences. Verify these rules against the intended real board. E1/E4. | Real gap — Pending P2 |
| 14.4 Provider capabilities/permissions/periods | Partial | Unverified | Read-only adapters, safe probes, allowlist and readiness validation work locally. The UI shows only returned allowlisted counters, not an unverified account capability matrix. Real account scopes/results/windows remain unverified. E7/E8/E11. | Real gap — Pending P2 |
| 14.5 Periodic mechanism/cadence/configurability | Yes (MVP) | Pass (MVP) | Manual refresh, bounded retry and original-source freshness work; periodic retrieval is excluded by clarify Decision 8. No background fetch is enabled. | Out of scope O3; implemented MVP subset |
| 14.6 Individual visibility/audience | Out of scope | N/A | Individual usage remains disabled and outside MVP. Any future enablement must first obtain privacy/audience approval. | Out of scope O1 |
| 14.7 Currency conversion policy | Yes | Pass | Clarify Decision 12 keeps metrics/currencies separate; no conversion implemented. E8. | Verified local; no implementation gap |
| 14.8 Burndown source/snapshot cadence/retention | Yes | Pass | Migration 003 stores only complete classified issue counts from manual refresh, scoped by installation/widget/viewer/board/sprint. History exposes dated points/provenance and precise last-observation time, capped to 500 points; initial reads do not invent observations. Thirty-day filtering/expiry and cascade purge tested. E6; PostgreSQL gap regression. | Implemented — real gap closed |
| 14.9 Persistence/retention/deletion enforcement | Partial | Unverified | Widget config/count snapshots cascade on tenant deletion; report cache expires and purges on settings changes. Manual observations are filtered/expired at 30 days; host module can register removal callback. Actual uninstall delivery and external secret revocation need production validation. E6/E12/E13. | Real gap — Pending P1/P4 |
| 14.10 Measurable load-time target | Partial | Unverified | Issue/page/date/cache/concurrency limits, upstream timeouts, request deduplication and initial provider cache reuse are implemented. Three-second target for ≤500 issues/three providers is documented but not measured in actual deployment. E9/E12/E13. | Real gap — Pending P3 |
| 14 confirmed decisions: Cloud embed/one board/all three families/scope/non-secret settings/integrity/separate Python tool | Partial | Unverified | Local implemented MVP covers one board, independent reported sources, manual history, integrity, non-secret configuration, expiry/purge and separate Python utility. Individual/estimate/periodic/pure-Forge extensions are O1–O4; real installation/account/browser/security release checks remain open. | Real gap — Pending P1/P2/P3/P4 |
| 15.1 Foundation: auth/config/state/platform | Partial | Unverified | Local host-module loading, trusted editor/admin/context checks, viewer Jira token forwarding, fail-closed denials and configuration UI tested. Deploy-specific macro/session verifier and installation hook must be supplied and validated. E1/E2/E13; host-loader tests. | Real gap — Pending P1 |
| 15.2 Jira: selection/progress/blockers/history | Yes | Pass | Active/historical choices, explicit bounded-list notice, groups and manual history implemented. Sprint change/manual refresh tested in mounted DOM; history verified in PostgreSQL. E3–E6; gap regressions. | Implemented — real gap closed |
| 15.3 Verified independent provider adapters | Partial | Unverified | Read-only adapters, safe probes, allowlist and readiness validation work locally. The UI shows only returned allowlisted counters, not an unverified account capability matrix. Real account scopes/results/windows remain unverified. E7/E8/E11. | Real gap — Pending P2 |
| 15.4 Date/aggregate/identity/unmatched/estimates | Yes (MVP) | Pass (MVP) | Reported team counters, source-native definitions, compatible totals, exact integer serialization, date/coverage/status and independent failures implemented. Individual/unmatched/estimate/monetary extensions excluded by clarify Decisions 2/5/6/18. E7–E10. | Out of scope O1/O2; implemented MVP subset |
| 15.5 Security/privacy/accessibility/site/retention/installation rollout | Partial | Unverified | Local implemented MVP covers one board, independent reported sources, manual history, integrity, non-secret configuration, expiry/purge and separate Python utility. Individual/estimate/periodic/pure-Forge extensions are O1–O4; real installation/account/browser/security release checks remain open. | Real gap — Pending P1/P2/P3/P4 |

## Completion and remaining work

Local defects F2–F8/F10/F11 are implemented and tested. F9 now has an enforced
single-installation deployment boundary. F12 now includes manual count history
and explicit scope exclusions. F1 has executable host-module wiring, while the
actual platform verifier/embedding remains P1. Every original requirement row
is retained above with its disposition; no release prerequisite is checked off
using fixture-only evidence.

Next release work is P1–P4. Optional polish is N1–N4. Scope exclusions O1–O4
follow the existing clarification decisions rather than introducing new product
features or silently lowering release requirements.
