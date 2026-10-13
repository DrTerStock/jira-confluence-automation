# Task Analysis

This assessment reviews [tasks.md](./tasks.md) against [plan.md](./plan.md),
[specification.md](./specification.md), [clarify.md](./clarify.md), and
[constitution.md](./constitution.md).

## Estimation assumptions

- Complexity means implementation uncertainty and integration difficulty:
  low, medium, or high.
- Token consumption is an estimate for AI-assisted engineering work per task,
  including investigation, implementation, review, and focused test iteration.
  It is not a measure of production inference usage. Actual consumption depends
  on repository size, model/context, number of iterations, and reused code.
- Human effort uses a broad engineering-hour range; it is not a schedule
  commitment and excludes stakeholder wait time and provider approval delays.
- Monetary investment is illustrative at **USD 100 per engineering hour**.
  This is a planning assumption, not a vendor quote, local labor rate, or
  approved budget. Use `hours × approved rate` to replace it.
- AI usage cost is not monetized as a fixed amount because model and token
  prices are unspecified. For a rough comparison only, at an assumed blended
  rate of **USD 10 per 1 million input-plus-output tokens**, the total token
  estimate below would cost approximately **USD 3.70–6.61**. Replace that
  assumed rate with the actual provider/model rates and input/output mix.
- “Business value” is relative MVP value, not a revenue estimate. ROI cannot
  be calculated without adoption, cost-saving, or reporting-time baselines.

## Per-task assessment

| Task | Complexity | Projected AI tokens | Engineering effort | Illustrative labor value | Business value | Primary risk |
|---|---|---:|---:|---:|---|---|
| 1. Set up the project foundation | Medium | 24k–40k | 24–40 h | $2,400–$4,000 | High | Runtime/deployment assumptions and CI choices may conflict with the actual repository or Confluence hosting requirements. |
| 2. Define configuration schema and persistence | Medium | 14k–24k | 16–28 h | $1,600–$2,800 | High | Tenant/widget identity, migrations, and config ownership are not finalized; current acceptance criteria imply an admin write flow without defining it. |
| 3. Build dashboard shell UI | Low | 18k–30k | 20–36 h | $2,000–$3,600 | High | Shell may be built without a defined Confluence embedding mechanism or stable backend response contracts. |
| 4. Implement Jira board and sprint retrieval | High | 25k–45k | 28–48 h | $2,800–$4,800 | High | Jira/Confluence auth strategy, scopes, pagination, user identity propagation, and board/sprint access checks are unspecified. |
| 5. Implement issue filtering and summary calculations | Medium | 25k–45k | 28–48 h | $2,800–$4,800 | High | Story-point field configuration and treatment of Jira issue-type hierarchy/custom issue types need a precise source of truth. |
| 6. Implement blocker detection and listing | Medium | 12k–22k | 12–24 h | $1,200–$2,400 | Medium | No blocker mapping schema or configuration task exists; it is unclear who configures and validates a flag/status rule. |
| 7. Implement burndown coverage handling | High | 18k–32k | 20–36 h | $2,000–$3,600 | Medium | No task gathers or persists dated observations, so the chart may always be unavailable; Jira history capability is unverified. |
| 8. Implement source readiness and admin configuration | High | 24k–42k | 28–48 h | $2,800–$4,800 | High | “Secure backend secret store” and admin authorization/UI are not selected or represented by a concrete artifact. |
| 9. Implement three provider adapters | High | 50k–90k | 60–100 h | $6,000–$10,000 | High | Provider access, supported metrics, API limits, date coverage, credentials, and authorized test accounts are unresolved; three integrations are bundled into one large task. |
| 10. Implement metric allowlist and compatibility rules | Medium | 15k–26k | 16–28 h | $1,600–$2,800 | High | No approved per-provider metric matrix or evidence artifact defines what is allowlisted. |
| 11. Implement manual refresh and stale behavior | Medium | 20k–36k | 24–40 h | $2,400–$4,000 | High | Clarified decisions give different manual-refresh retry guidance; deduplication, freshness timestamps, and cache behavior are not precisely assigned. |
| 12. Build AI usage panel and status presentation | Medium | 25k–45k | 28–48 h | $2,800–$4,800 | High | Task does not include date-range selection despite the spec requiring it; aggregation and source-status precedence need contract tests. |
| 13. Implement auth and authorization checks | High | 30k–55k | 36–60 h | $3,600–$6,000 | Critical | This is sequenced after integration work although those tasks require trusted identity and authorization from the outset; auth platform and integration tests are unspecified. |
| 14. Implement cache, retention, and purge | High | 20k–35k | 24–40 h | $2,400–$4,000 | High | The 24-hour cache and 30-day data retention decisions are not reflected precisely in acceptance criteria or in a lifecycle/deletion design. |
| 15. Write tests for Jira and provider behavior | Medium | 30k–55k | 36–60 h | $3,600–$6,000 | High | Tests are deferred as a separate late task instead of being part of each implementation task; required fixture and authorized-account setup is absent. |
| 16. Validate end-to-end and prepare release candidate | Medium | 20k–35k | 24–40 h | $2,400–$4,000 | High | “Works in Confluence” and “valid provider configuration” require an actual deployed/test environment, credentials, and a release checklist/runbook not planned as artifacts. |

**Estimated total:** approximately **370k–661k AI tokens**, **424–724
engineering hours** (about 53–91 eight-hour person-days), and **USD
42,400–72,400** at the illustrative labor rate above. Ranges are coarse and
should be revised after architecture and provider capability decisions are
verified.

## Dependency and sequencing review

The task dependencies are a useful outline, but the suggested execution order
does not consistently follow the necessary technical prerequisites:

1. **Authentication must precede protected integration work.** Task 13 depends
   on Tasks 4, 8, and 9, while Tasks 4, 8, and 9 need authenticated caller,
   administrator, and tenant context. Split out an early authentication/
   platform-context task or move the core of Task 13 ahead of those tasks.
   Authorization tests should be added in each protected task, not deferred.
2. **Task 7 lacks a producer for burndown observations.** Task 5 only retrieves
   current sprint issues. Add an explicit decision and implementation task for
   Jira changelog/history retrieval or scheduled/manual snapshot capture; if
   neither is in MVP, mark the burndown chart out of scope and implement the
   unavailable state only.
3. **Task 6 lacks configuration ownership.** Task 2 does not define blocker
   mapping fields, and no task implements their editor or provisioning
   workflow. Either add a non-secret, validated blocker-rule configuration
   task or explicitly make blocker classification unavailable in MVP.
4. **Task 9 should be split by provider.** GitHub Copilot, OpenAI, and
   Anthropic have separate capabilities, permissions, verification needs, and
   failure modes. Track them as separately deliverable adapter tasks behind
   a shared contract so one unavailable provider does not block the others.
5. **Task 8 must depend on authentication and a named secret mechanism.** A
   “secure backend secret store” is not a deployable design. Select a
   mechanism appropriate to the actual hosting platform and define how local
   development supplies secrets without committing them.
6. **Task 11 and Task 14 need exact freshness/retention contracts.** State the
   30-minute Jira and six-hour provider stale thresholds, the 24-hour cache
   expiration, 30-day snapshot retention, and purge trigger in their
   acceptance criteria. A cache TTL does not itself define persistent snapshot
   retention.
7. **Task 15 should not be a testing-only phase dependency.** Each task needs
   acceptance tests delivered with its implementation. Keep Task 15 for
   integration, authorization-boundary, and end-to-end coverage.
8. **Task 16 depends on missing deployment and operational artifacts.** Add
   tasks for an environment/deployment recipe, a test installation or
   equivalent Confluence integration harness, and the runbook/release
   checklist, or narrow the release criteria to what can be verified locally.

## Cross-document gaps, contradictions, and missing artifacts

### Blocking contradictions

- **Runtime/hosting remains unresolved in the authoritative spec.** The
  constitution specifies React/Vite, Express, and PostgreSQL locally via
  Docker, while [specification.md](./specification.md) still identifies Forge
  resolvers and says the architecture must be decided. [clarify.md](./clarify.md)
  chooses a separate Express service and describes Forge as an “embedding
  shell,” but does not amend the source specification or explain how the
  Confluence macro securely embeds/authenticates to that service. Treat the
  decision as provisional until the specification/decision record and
  deployment design are updated.
- **MVP exclusions are not propagated into the source specification.**
  Individual attribution, periodic refresh, identity matching, and scheduled
  burndown snapshots still appear in the specification’s in-scope sections,
  requirements, scenarios, and release criteria. The plan/tasks omit or
  contradict parts of those requirements, so acceptance cannot be judged
  consistently.
- **Refresh retry conflict.** [clarify.md](./clarify.md) calls periodic
  refresh out of scope but also says manual refresh retries once on transient
  rate-limit conditions. [plan.md](./plan.md) requires rate-limit/retry
  guardrails, while Task 11 only says to respect limits and does not define the
  retry rule. A rate-limit response normally needs `Retry-After` handling;
  retrying once immediately could violate the limit. Define one bounded policy
  or do not retry.
- **Story-point rule is weaker in tasks than the clarified decision.**
  [clarify.md](./clarify.md) requires explicit project use and a valid estimate
  field; Task 5 only says the field is configured and valid. Add the explicit
  project-use condition and partial-estimate coverage behavior.
- **Source-state precedence is potentially contradictory.** Clarify Decision
  11 orders `partial` ahead of `stale`, `unavailable`, `permission_denied`,
  and `rate_limited`, yet it also says preserve successful values from other
  sources. Status precedence should be defined per source/result, not as one
  global ordered enum; partial success and a concurrent permission/rate-limit
  error need to coexist in structured metadata.

### Missing or incomplete requirements/artifacts

- A single approved architecture decision/deployment diagram, including
  Confluence embedding, authentication handoff, network boundaries, hosting,
  database access, and local/test/prod environments.
- A concrete authentication design for Confluence page visibility,
  authenticated viewer identity, Jira user-context calls, site-admin checks,
  and tenant installation identity. The current task list has no early
  identity/context foundation.
- A migration/schema artifact and an explicit data ownership model for
  installation ID, widget instance key, board/provider scope, and uniqueness.
- A provider capability matrix with authoritative evidence per provider:
  metric names/definitions, units, date limits, permissions, pagination,
  rate limits, and test-account availability. “Verified allowlist” alone is
  not an acceptance test.
- A usage date-range control and validation task. The specification requires
  a selectable reporting period and requested-versus-actual coverage; the task
  list does not explicitly deliver the control or define allowed ranges.
- An explicit burndown decision/artifact: Jira history API evidence, snapshot
  source, collection trigger/cadence, retention, or an MVP exclusion.
- An explicit blocker mapping schema and editor/admin provisioning path.
- Error/source contract definitions for partial metric failures, missing
  credentials, permission errors, stale cache plus refresh failure, and
  requested/actual period fields. The examples in the spec are illustrative,
  so these should be made testable before adapter work.
- API/request and response schemas, correlation-ID propagation, and
  idempotency/concurrent-refresh behavior.
- Cache boundaries and authorization revalidation rules. Cache isolation
  dimensions must include tenant, widget, board, source, query period, and
  caller/Jira authorization context as applicable; otherwise a previously
  authorized result could be served to an unauthorized viewer.
- Privacy approval/process artifact is needed only if individual data returns
  to scope. For MVP, remove individual identity data collection and identity
  test obligations from the implementation baseline.
- The plan promises CI, README/setup instructions, and an operational runbook,
  but the task list does not assign named tasks for CI, documentation, or the
  runbook.
- An accessibility verification artifact/checklist is absent; the UI task
  says keyboard accessible but has no measurable test/check criteria.
- No task explicitly verifies the clarified 3-second initial-render target
  under the stated board/provider volume, and the plan does not define
  whether that target is cold or warm cache or how it is measured.
- The plan describes credentials in a backend secret facility, but the
  specification’s PostgreSQL `secret_reference` is only a reference and
  must not be mistaken for secret storage. The actual secret facility and
  rotation/removal behavior are absent.

## Recommended disposition

Before implementation is treated as ready:

1. Update [specification.md](./specification.md) or create an approved
   decision record that supersedes its Forge/runtime, individual-reporting,
   refresh, retention, and burndown statements.
2. Add or remove tasks for authentication foundation, Confluence integration,
   provider verification, burndown data production, blocker-rule configuration,
   deployment/CI/docs, and performance/accessibility checks.
3. Split provider adapters into independently verifiable deliverables and
   define measurable contracts and evidence for each.
4. Restructure dependencies so auth/platform context and shared contracts
   precede protected integrations; require focused tests alongside each task.
5. Re-estimate after those scope changes and after confirming available
   provider accounts, APIs, and hosting constraints.

Until then, token and labor estimates are order-of-magnitude planning ranges,
not a committed budget or implementation schedule.
