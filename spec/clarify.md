# Specification Clarification Review

This review is based on [constitution.md](./constitution.md) and [specification.md](./specification.md). The specification is strong on governance, privacy, and state semantics, but it still leaves several product and engineering decisions undefined. Those unresolved points are the main risk to implementation, testing, and stakeholder alignment.

## Executive summary

The draft is directionally good: it defines a dashboard for Jira sprint reporting and AI usage visibility, insists on evidence-based reporting, and sets privacy/security guardrails. However, the spec still has multiple unresolved design choices that would materially affect architecture, implementation, and release readiness.

The biggest issues are:

- A platform/runtime conflict between Forge and a React/Express/PostgreSQL stack.
- Unresolved Jira business rules (estimate field, completion mapping, blocker classification).
- Missing provider-specific capability contracts and metric definitions.
- Ambiguous privacy posture for individual-level AI attribution.
- Incomplete operational requirements for refresh cadence, retention, and admin configuration.

Without resolving these items, teams will build against different assumptions, and the product will not be testable as a single coherent system.

## MVP resolution decisions

The following are the decisions for this prototype. Each item either resolves a gap with a practical default or is explicitly excluded from the MVP scope so the project can ship a working dashboard without overcommitting to enterprise-grade features.

### Decision 1 — Runtime architecture

Decision: For the prototype, the authoritative runtime is a single application stack: React 18 + Vite frontend, Node.js + Express backend, PostgreSQL 15 via Docker. Confluence embedding is handled through the platform macro/iframe or widget integration pattern, but the dashboard logic and persistence run in the Express service, not in a separate Forge-native runtime. Forge is treated as the hosting/integration shell, not as the primary app runtime.

This resolves the constitution/spec conflict by making the constitution’s baseline authoritative and keeping a single implementation model.

### Decision 2 — Individual AI usage attribution

Status: Out of scope for MVP.

The prototype will show only team-level usage totals where the provider exposes them and the user has access. There will be no individual-level usage views, no person matching by email, and no production exposure of matched/unmatched identities. This aligns with privacy-first defaults and the constitution.

### Decision 3 — Jira summary unit and estimate policy

Decision: The default sprint progress unit for MVP is issue count. Story points are shown as a secondary field only when the configured Jira board has a valid estimate field and the project explicitly uses it. If no estimate field is configured or the field is empty, the UI shows "Not estimated" rather than zero. Issue counts and story points are never mixed into a single total.

This resolves the unresolved progress/estimate issue without requiring a complex estimate policy in phase 1.

### Decision 4 — Jira completion and blocker rules

Decision: Complete = Jira issue status category is Done/Closed. For the MVP, blocked means an in-scope, non-completed issue whose Jira status name matches an explicitly configured status name (case-insensitive). If no blocked-status mapping is configured, the UI shows the count as unavailable rather than guessing. Custom blocker fields and issue-link inference are out of scope until a project-specific rule is confirmed.

This is a common-practice, configurable default that respects the constitution’s requirement not to silently assume a mapping.

### Decision 5 — Provider metric policy

Decision: For MVP, each provider adapter supports a small verified allowlist of metrics. The app will allow only metrics that are explicitly mapped in code and verified for the organization account. Unsupported metrics are shown as "unsupported" and never converted into zero. Provider metrics are normalized only to the shape: metric name, value, unit, currency, kind, and period. The prototype does not attempt a comprehensive provider capability matrix beyond those allowlisted metrics.

This keeps the implementation realistic while honoring the requirement for evidence-based reporting.

### Decision 6 — Identity matching

Status: Out of scope for MVP.

The prototype does not attempt a work-email identity match beyond the backend contract shape. No identity attribution is displayed in the UI. Any later identity functionality must be explicitly approved and implemented under the privacy policy.

### Decision 7 — Admin configuration model

Decision: Provider credentials are configured only in the secure backend secret store, not in the Confluence page configuration or browser. The macro/configuration UI allows only board selection, enabled providers, and non-secret preferences. The backend exposes a source readiness endpoint for administrators and may show configured, missing credentials, insufficient permissions, unsupported metric coverage, and transient error states.

For this prototype, deployment-managed environment secrets are the backend secret-store integration. Local values may be loaded from the gitignored `.env`; production values must be injected by the host's protected secret manager. Credential presence is not treated as proof of provider permissions; readiness remains "configured, unverified" until an adapter probe succeeds, after which it is marked "ready". Use `GITHUB_COPILOT_TOKEN`, `OPENAI_ADMIN_API_KEY`, and `ANTHROPIC_ADMIN_API_KEY`; GitHub additionally needs `GITHUB_ENTERPRISE_SLUG`.

This is the standard security pattern for a prototype and satisfies the constitution.

### Decision 8 — Refresh behavior

Status: Out of scope for MVP.

The prototype supports manual refresh only. It does not implement periodic background refresh, staggered retry loops, or automatic polling. A manual refresh retries a rate-limited request at most once, only when the requested retry delay is no more than five seconds (one second when no valid delay is provided); otherwise the rate-limit state is returned without retrying early. A failed source refresh preserves its last successful result and marks that data stale.

### Decision 9 — Retention and deletion policy

Decision: For MVP, cache entries expire after 24 hours, provider usage snapshots are retained for 30 days max, and Jira sprint snapshots are retained for 30 days unless the project requires a shorter period. Jira sprint history is collected only during user-triggered manual refresh; periodic snapshots are out of scope. Tenant removal triggers a purge of tenant-scoped records. Logs store only safe correlation IDs and error categories; no provider payloads or raw usage details are kept.

This is a conservative, common-practice baseline that aligns with the privacy requirements without over-engineering lifecycle policy.

### Decision 10 — Performance targets

Decision: The prototype target is: dashboard initial render under 3 seconds for a normal board with up to 500 sprint issues and 3 enabled providers, assuming cached or fresh data; source refreshes may complete asynchronously and do not block page view. A board larger than this is treated as a scale-out item and is not part of the MVP requirement.

This avoids creating an unbounded performance requirement while still giving engineering a measurable target.

### Decision 11 — Mixed source state precedence

Decision: The source status precedence is deterministic:

1. success: all requested metrics succeeded
2. partial: at least one metric or source succeeded and at least one failed or unsupported field remains
3. stale: last successful data exists but freshness threshold has been exceeded
4. unavailable: metric/source is not supported or not configured
5. permission_denied: access denied by Jira or provider
6. rate_limited: provider or Jira rate checks triggered a retry block
7. failed: request failed without a valid partial result

The UI shows the highest-precedence state that applies, while preserving any successful values from other sources.

### Decision 12 — Currency and metric aggregation

Decision: Monetary totals remain separated by currency; no cross-currency conversion is implemented in the MVP. Team totals may be aggregated only within the same unit and same metric definition. If metrics differ in currency, unit, or meaning, they remain separate cards/totals and are never combined.

This is consistent with the constitution and the product spec’s “no fabricated conversion” rule.

### Decision 13 — Confluence hosting model

Decision: The prototype uses a Confluence macro/widget embedded in the page, backed by a separate Express service. The app is not implemented as a pure Forge-native app and does not require a Forge-only runtime for MVP. This keeps the product aligned with the constitution while still satisfying the Confluence embedding requirement.

### Decision 14 — Freshness SLA

Decision: Jira data is considered stale after 30 minutes without a successful refresh. Provider data is considered stale after 6 hours without a successful refresh unless a provider-specific contract defines a stricter rule. Stale data remains visible with a warning and the last successful retrieval timestamp. This is a practical default for team dashboard usage.

### Decision 15 — Python weekly report automation integration

Status: Out of scope for MVP.

The existing Python weekly report automation remains a separate tool and is not integrated into the dashboard prototype. The dashboard reads Jira and provider APIs directly and does not depend on the Python report automation for MVP functionality.

### Decision 16 — Internal spec governance

Decision: The specification is the implementation source of truth. Any item that is still TBD must be labeled as either "MVP decision" or "out of scope" in the spec. HTTP route examples remain illustrative; they are not binding transport requirements for the prototype.

### Decision 17 — Provider reporting integrations

Decision: Provider reports are organization/enterprise aggregates only; the
adapters do not request per-user dimensions or expose identity data. Reporting
periods are inclusive UTC dates capped at 31 days. Each adapter returns the
provider's actual coverage and status rather than filling missing days with
zeroes.

- GitHub Copilot uses the enterprise one-day aggregate metrics report. The
  enterprise Copilot metrics policy must be enabled and the token must have
  enterprise Copilot metrics access. Only the aggregate interaction,
  generation, and acceptance counts are normalized.
- OpenAI uses the organization completions-usage endpoint with an Admin API
  key. It normalizes input tokens, output tokens, and model request counts.
- Anthropic uses the organization analytics usage report, requiring a
  compatible Claude Enterprise organization and `read:analytics` permission.
  It normalizes uncached input, cache-read, cache-creation, and output token
  counts.

Decision 18 defines the provider metric compatibility allowlist and
cross-source aggregation rules. A provider endpoint or metric unavailable to an
organization is reported as unavailable/unsupported, never simulated.

This removes ambiguity and prevents engineers from treating unresolved items as requirements.

### Decision 18 — Provider metric allowlist and compatible totals

Decision: The MVP allowlist is limited to the following reported metrics:

- GitHub Copilot: `user_initiated_interaction_count`,
  `code_generation_activity_count`, and `code_acceptance_activity_count`
  (events).
- OpenAI: `input_tokens` and `output_tokens` (tokens), and `model_requests`
  (requests).
- Anthropic: `uncached_input_tokens`, `cache_read_input_tokens`,
  `cache_creation.ephemeral_1h_input_tokens`,
  `cache_creation.ephemeral_5m_input_tokens`, and `output_tokens` (tokens).

Only OpenAI and Anthropic `output_tokens` share a compatible total definition.
That total is produced only when both sources report successful data for the
same actual period, unit, currency, and metric kind. Other metrics remain
source-specific. A reported zero is retained; absent, malformed, or unsupported
metrics are not replaced with zero. No monetary metrics or currency conversion
are included in the MVP.

### Decision 19 — Trusted host authentication boundary

Decision: The Express API uses a host-injected, server-side authentication
resolver. The host integration must verify the platform authentication
material, derive viewer, installation, page, and widget identity from trusted
context, enforce Confluence page access, and provide a viewer-scoped Jira
access token and verified administrator status where applicable. The API
rejects requests when the resolver is not configured or cannot verify access.
Client-supplied identity, tenant, page, widget, role, or Jira-token values are
never trusted. The exact platform authentication protocol is intentionally
deferred to the host integration.

## 1. Contradictions and conflicts

### 1.1 Runtime architecture is not aligned

Resolved by Decision 1: the architecture is a single React + Express + PostgreSQL stack, with Confluence integration as the embedding shell.

### 1.2 Product and governance wording around individual usage is internally inconsistent

Resolved by Decision 2: individual usage is explicitly out of scope for the MVP. The dashboard only exposes authorized team totals.

### 1.3 The spec says some values are unresolved, but still includes them as acceptance criteria

Resolved by Decision 3 and Decision 4: the unit and estimate policy and the completion/blocker rules are now explicitly defined for MVP.

### 1.4 The constitution says no second application runtime, but the specification is written as if multiple deployment models are still acceptable

Resolved by Decision 1 and Decision 16: a single runtime is now designated as the implementation baseline; alternative hosting models are not part of the prototype.

## 2. Major gaps in the functional specification

### 2.1 No exact Jira completion mapping is defined

Resolved by Decision 4.

### 2.2 Estimate field and progress unit are still unresolved

Resolved by Decision 3.

### 2.3 Provider metric contracts are not specified per provider

Resolved by Decision 5, Decision 17, and Decision 18. The provider data fields,
compatibility allowlist, and aggregation policy are now defined.

### 2.4 Identity matching rules are too underspecified

Resolved by Decision 6: identity matching is out of scope for MVP.

### 2.5 No concrete admin configuration model is defined

Resolved by Decision 7.

### 2.6 Refresh behavior is not fully specified

Resolved by Decision 8.

### 2.7 Data retention and deletion policy is not defined operationally

Resolved by Decision 9.

### 2.8 Performance and load-time requirement is missing

Resolved by Decision 10.

### 2.9 The spec does not define what exactly is exposed in the UI when a provider is unsupported or partially available

Resolved by Decision 11.

## 3. Unclear requirements that need stakeholder decisions

The following are intentionally defaulted for MVP or marked out of scope:

- Confluence hosting model: Decision 13
- Dashboard composition/integration precedence: Decision 11
- Freshness SLA: Decision 14
- Python weekly report automation relationship: Decision 15
- Currency/estimates/totals policy: Decision 12
- Individual data approval threshold: Decision 2

## 4. Recommended next step

The specification should now be updated to include the decisions above and remove any remaining TBD claims that are no longer necessary. For the prototype, the only remaining open items should be implementation details, not product-level ambiguities.

## 5. Overall assessment

The clarification review is now converted into a prototype-ready decision set. The major risks are still privacy and architecture, but both are now resolved with explicit MVP defaults or explicit out-of-scope exclusions. This is a practical and defensible baseline for a first working implementation.

### 1.1 Runtime architecture is not aligned

There is an explicit contradiction between the constitution and the product spec:

- [constitution.md](./constitution.md) states the approved stack is: React 18 + Vite, Node.js + Express, PostgreSQL 15 via Docker.
- [specification.md](./specification.md) says the target product is a Confluence Cloud embedded macro/widget, and it references Forge as the selected runtime/hosting model in the implementation decisions section.
- The API contract section says: "The source specification selects Forge resolvers; the constitution records React/Vite, Express, and PostgreSQL 15 as the engineering baseline. The application transport and hosting architecture must be reconciled before implementation. If HTTP is selected ... If Forge is selected ..."

This is a direct unresolved architecture conflict. The document currently tells teams to implement both a Forge-based platform and a Node/Express/PostgreSQL service without deciding which one is authoritative.

Impact:

- backend service boundaries are unclear
- storage strategy is unclear
- deployment, auth, and widget integration requirements are unclear
- testing strategy depends on the selected runtime

### 1.2 Product and governance wording around individual usage is internally inconsistent

The spec states that individual-level AI usage visibility is forbidden in production until approval, but also describes individual attribution features as product requirements and acceptance criteria.

Examples:

- "Production individual-level AI usage visibility before organizational approval" is explicitly out of scope.
- Scenario 5 uses authorized viewer and individual attribution as a target capability.
- The acceptance criteria say individual reporting is disabled in production until approval, but the product description still requires display of matched/unmatched identities and optional individual aggregates when approved.

This leaves the feature state unclear: is individual attribution a first-release feature, a gated feature, or a later phase?

### 1.3 The spec says some values are unresolved, but still includes them as acceptance criteria

Scenario 2 acceptance criterion 4 says:

- "Progress shows completed and remaining work with its unit. The unit may include issue count and configured story points; the final unit and estimate field are unresolved until Jira configuration is confirmed."

That means the product requirement itself is deliberately incomplete and not yet implementable. The same issue appears in the blocker classification rules and burndown history requirements.

This is not necessarily wrong for a draft, but it means the specification is not yet actionable for engineering implementation. Acceptance criteria should be final or explicitly flagged as P2 until the decision is made.

### 1.4 The constitution says no second application runtime, but the specification is written as if multiple deployment models are still acceptable

The constitution contains a clear rule: "This stack is the project's engineering baseline. Reconcile conflicting architecture statements or platform requirements through a recorded decision before implementation; do not silently introduce a second application runtime."

But the specification contains a decision tree that explicitly says the app may use either Forge or HTTP routes and that the runtime architecture must be reconciled before implementation. That is a partial contradiction: the constitution requires a single runtime baseline, while the specification keeps architecture open as late-stage design.

## 2. Major gaps in the functional specification

### 2.1 No exact Jira completion mapping is defined

The spec says:

- "blocker classification uses a confirmed project/Jira rule; until then the mapping is configurable or explicitly marked unresolved, not guessed."
- "completion mapping ... shall use confirmed Jira/project configuration; unresolved mappings shall not be silently assumed."

But it does not define:

- which statuses count as complete
- which statuses count as blocked
- how to handle custom workflows
- whether blockers are workflow-based or issue-link-based
- whether blocked status excludes done, in progress, or waiting states

Without a canonical rule set, different engineers will implement different logic and produce inconsistent team reports.

### 2.2 Estimate field and progress unit are still unresolved

The spec explicitly admits this is unresolved:

- issue count, story points, or both
- which Jira field is the approved estimate
- how to present no-estimate work and partial estimate coverage

This is a critical missing requirement because it affects:

- sprint summary logic
- burndown calculations
- status reporting
- user-visible metrics
- acceptance tests

### 2.3 Provider metric contracts are not specified per provider

The spec says all three providers are in scope, but the actual provider-specific required metrics are not defined.

Missing details include:

- which GitHub Copilot metrics are used
- which OpenAI metrics are available and supported
- which Anthropic metrics are available and supported
- valid date ranges and pagination limits for each provider
- metric names, units, currency semantics, and zero semantics per source
- whether provider data is organization-level, team-level, or user-level
- how unsupported metrics are represented in the UI and API

The document anticipates a provider capability matrix but leaves the matrix itself undefined.

### 2.4 Identity matching rules are too underspecified

The spec says identity matching uses normalized work email only, but it does not define:

- exact normalization algorithm
- whether subdomain aliases are treated as same identity
- what to do with multiple email addresses for one person
- how to handle duplicate or stale provider identities
- how to match Atlassian user identity to provider identity from work email
- whether unmatched identities are grouped by provider or by dashboard

This creates a compliance and reliability risk because identity matching mistakes could expose sensitive data or misattribute usage.

### 2.5 No concrete admin configuration model is defined

The administrator integration setup/status section says the exact surface is platform-dependent and subject to architecture verification.

But an implementation still needs clear answers to:

- where provider credentials are stored
- who can configure them
- how readiness is checked
- how invalid credentials and insufficient permissions are surfaced
- whether there is a UI or an installation-time configuration flow
- what the source-readiness model looks like in the database

Right now, the spec acknowledges the need for backend/admin functionality but does not define the actual workflow or constraints.

### 2.6 Refresh behavior is not fully specified

The spec requires manual refresh and allows periodic refresh but leaves several design choices open:

- exact cadence for periodic refresh
- whether it is user-configurable
- what refresh scope is allowed (whole dashboard, provider-specific, sprint-specific, usage-specific)
- rate-limited retry strategy
- deduplication of concurrent refresh requests
- stale-data retention semantics after refresh failure

The text says periodic refresh is allowed only after platform mechanism and cadence are verified, but it also implies the feature is part of the first release in the general design. This is not a clean product decision.

### 2.7 Data retention and deletion policy is not defined operationally

The constitution emphasizes minimizing data and defining retention before persisting reporting history. The specification repeats that but does not define:

- Retention duration for cache entries
- Retention duration for usage metrics and snapshots
- Whether historical burndown snapshots are stored at all
- How data deletion is invoked/verified
- Whether tenant removal triggers purge
- Which data may be kept in logs, metrics, or telemetry

The result is that the privacy principle is clear, but the implementation policy is still absent.

### 2.8 Performance and load-time requirement is missing

The non-functional requirements say: "Establish a measurable UI load-time target during implementation." This is intentionally deferred, but a product spec should still define the expected scale and performance limits.

Unclear items:

- acceptable dashboard load time
- number of board/sprint records expected per board
- expected data volume for provider usage and burndown history
- whether all history is fetched in one request or paginated
- acceptable cache staleness

### 2.9 The spec does not define what exactly is exposed in the UI when a provider is unsupported or partially available

It repeatedly says unsupported metrics, missing data, and provider failures should be distinct states, but it does not define:

- precedence rules when multiple states overlap
- whether a partial source hides or preserves prior values
- how partial success interacts with team totals
- whether unsupported metrics should still be shown in the source summary

This is a meaningful product and UX gap.

## 3. Unclear requirements that need stakeholder decisions

### 3.1 What is the supported Confluence hosting model?

The product is described as a Confluence Cloud macro/widget, but the actual architecture decision remains open. The project must decide:

- Forge app only
- external service + Forge embedding
- pure client-side embed with secure backend service

This decision affects the design of auth, storage, refresh, and configuration.

### 3.2 What is the final supported dashboard composition?

A dashboard instance is described as representing one Jira board and one or more AI usage sources, but it is not fully specified what the rendering contract is when:

- multiple providers are enabled but only some have data
- some sources are stale while others are fresh
- Jira access is partial
- usage period is partially supported by one provider

The UI states are listed, but not the precedence or combination rules.

### 3.3 What are the SLA and data freshness expectations?

The policy defines freshness and stale states, but does not define:

- freshness thresholds (for example, 15 minutes, 1 hour, 1 day)
- when data becomes stale
- who is allowed to see stale data
- whether stale data stays visible or is hidden

### 3.4 What is the exact relationship between the dashboard and the existing Python weekly report automation?

The specification says the existing automation is separate and not the dashboard implementation, but the broader project may still depend on it. This is a dependency yet to be specified clearly.

### 3.5 What is the approved policy for currency, estimates, and totals?

The spec repeatedly says not to combine unlike metrics, units, or currencies without approved policies. But it does not define:

- whether all provider metrics remain separate by default
- how team totals are calculated for compatible metrics
- how estimates are displayed in the UI when multiple units are present
- whether cost conversion is allowed or prohibited as a first release

### 3.6 What is the exact legal/privacy approval threshold for individual data?

The spec says production individual-level AI usage is blocked until org approval, but it does not define:

- who grants approval
- what the audience restrictions are
- whether the dashboard will support a redacted or role-gated version of individual data
- how review and logging of the policy are tracked

## 4. Documentation and traceability gaps

### 4.1 The spec references multiple external artifacts but does not make them authoritative in the same document

The document references:

- project_spec.md
- constitution.md
- approved decisions

But the product spec itself does not contain enough final decisions to be self-sufficient. For engineering work, the spec should either include or clearly reference the final approved decision records for architecture, data retention, provider policy, and identity rules.

### 4.2 Some sections describe operations as logical and transport-agnostic, but others look like concrete HTTP route design

This is confusing. The document says the API contract is logical and does not commit to HTTP, but the route examples are concrete. That can be useful, but the document should explicitly define the final contract style before implementation. Otherwise, engineers will treat the examples as requirement while the system is still meant to be platform-agnostic.

### 4.3 Acceptance criteria intentionally include unresolved decisions

This makes it difficult to run a clean verification pass. A spec should not claim a requirement is done if the actual requirement is intentionally unresolved in the same acceptance criteria.

## 5. Specific missing technical decisions

The following items must be decided before implementation can proceed without design churn:

1. Final runtime architecture and hosting model.
2. Final Jira completion and blocker rules.
3. Approved estimate field(s) and sprint progress unit.
4. Provider capability matrix for each provider and each required metric.
5. Exact data and privacy policy for individual attribution.
6. Refresh cadence and stale-data policy.
7. Cache retention and deletion lifecycle.
8. Performance and scale targets.
9. Source status precedence rules for mixed success/partial/failure states.
10. Approved method for currency and metric aggregation.
11. Exact admin and source-readiness configuration model.
12. Bug/issue backlog ownership for unresolved decisions (who decides and when).

## 6. Recommended clarification questions for stakeholders

The following questions should be resolved before implementation starts:

1. Is the product deployed as a Forge app only, or as a Forge-integrated external service with a React/Vite + Express + PostgreSQL backend?
2. What Jira statuses count as complete, blocked, and in progress for the selected board?
3. Which Jira field is the approved estimate field for progress and burndown? If no estimate field is available, what is the fallback behavior?
4. Which GitHub Copilot, OpenAI, and Anthropic metrics are in scope for v1, and what are their supported date ranges and permissions?
5. Is individual AI attribution in scope for v1, and if so under what approval and audience restrictions?
6. What is the official stale-data threshold and refresh policy?
7. What is the retention period for cache entries, usage metrics, burndown snapshots, and identity records?
8. Are currencies converted in the product, or are all monetary totals kept separate by default?
9. What is the exact admin workflow for configuring provider access and checking readiness?
10. What is the performance target for the dashboard under a representative board and reporting volume?

## 7. Overall assessment

The specification is close to a strong product definition, but it still reads like a draft architecture and product plan rather than a final implementation-ready specification. The missing decisions are not minor details; they directly determine the product's design, security posture, UX, and testability.

The highest-priority items to resolve before coding are:

- architecture/runtime decision
- Jira rule configuration (complete/blocker/estimate)
- provider metric and data contracts
- privacy/approval rules for individual identity visibility
- retention and refresh policy

Once those are fixed, the document can be converted from a planning artifact into an implementation-ready specification without major rework.
