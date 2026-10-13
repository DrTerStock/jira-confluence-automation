# Project Constitution: Jira/Confluence Automation

## Purpose and Scope

This constitution establishes the engineering principles for the Jira and
Confluence automation project, including its sprint-progress and AI-usage
reporting capabilities. It governs implementation, review, testing, and
operation. Product requirements remain defined by the approved project
specification and recorded decisions.

## Core Principles

### I. Accurate, Evidence-Based Reporting

- Report only data returned by an authorized, successfully queried source.
- Distinguish zero from unavailable, missing, stale, partial, and estimated
  values in APIs and the user interface.
- Label estimates with their source and basis. Do not fabricate historical
  sprint data, infer unsupported provider metrics, or present unlike metrics
  as comparable.
- Keep currencies separate unless an approved conversion source and policy
  are documented.

### II. Authorization at Every Boundary

- Enforce authentication and authorization in the backend for every
  operation; frontend checks are not security controls.
- Respect the requesting user's Jira permissions and the access boundary of
  the containing Confluence page.
- Apply least privilege to Atlassian scopes, provider credentials, database
  roles, and service access.
- Scope reads, writes, caches, and stored records to the correct tenant,
  organization, board, and widget configuration. Never trust client-supplied
  identity or scope as proof of authorization.

### III. Privacy by Default

- Keep credentials and tokens on the server, outside browser bundles,
  responses, URLs, page content, and logs.
- Collect and retain only data required for an explicitly documented feature.
  Define retention and deletion behavior before persisting reporting history.
- Do not expose individual AI-usage data in production until organizational
  privacy approval and access rules are recorded.
- Redact secrets and minimize personal or usage data in logs and diagnostics.

### IV. Explicit, Layered Architecture

- The approved application stack is **React 18 with Vite** for the frontend,
  **Node.js with Express** for the backend, and **PostgreSQL 15** for
  persistent relational data, run locally through **Docker**.
- Keep provider- and Atlassian-specific API handling behind backend
  integration modules. The frontend must not call privileged provider APIs
  directly.
- Keep presentation, request validation, business rules, integrations, and
  persistence responsibilities separate, with explicit typed contracts at
  their boundaries.
- This stack is the project's engineering baseline. Reconcile conflicting
  architecture statements or platform requirements through a recorded
  decision before implementation; do not silently introduce a second
  application runtime.

### V. Verified Integrations and Bounded Work

- Verify each Jira, Confluence, GitHub Copilot, OpenAI, or Anthropic API
  capability, permission, metric definition, and date-coverage limit against
  authoritative documentation and an appropriately authorized account.
- Request only the scopes and fields needed. Validate and constrain inputs;
  never accept arbitrary provider endpoints or URLs from users.
- Paginate and bound requests, honor rate limits and platform constraints,
  and use caching only with correct tenant/source boundaries and visible
  freshness.
- Record unsupported capabilities as explicit limitations rather than
  simulating successful results.

### VI. Clear Failure and Data-Freshness Semantics

- Represent each source outcome explicitly, including success, partial,
  unavailable, stale, permission denied, rate limited, and failed.
- Show actionable, user-safe errors without leaking credentials, provider
  payloads, or unnecessary personal data.
- A failed refresh must not overwrite a successful result with a
  success-shaped fallback. If stale data is retained, display its age and
  status.
- Record source, reporting period, retrieval time, and completeness wherever
  results are presented or cached.

### VII. Testable, Maintainable Changes

- Add or update focused automated tests for business rules, input validation,
  authorization, integration normalization, aggregation, and error states.
- Test edge cases including missing estimates or identities, legitimate zero,
  partial provider failure, stale data, and incompatible currencies.
- Keep provider adapters independently testable and isolate external I/O
  behind replaceable boundaries.
- Changes must pass applicable formatting, lint, type-check, build, and
  focused test checks before they are considered complete. Document
  unverified checks and external prerequisites.

### VIII. Accessible and Understandable Experience

- Provide clear loading, empty, partial, error, stale, and permission states.
- Make controls keyboard-operable and provide textual or tabular equivalents
  for charts.
- Use clear labels for units, periods, currencies, data sources, estimates,
  and coverage limitations. Do not imply greater precision or comparability
  than the source supports.

### IX. Reproducible Local Data Services

- Run PostgreSQL 15 through Docker for local development and automated
  integration testing, with documented configuration and health checks.
- Keep credentials out of version control; provide safe examples and
  environment-variable names instead of real secrets.
- Manage schema changes through reviewed, repeatable migrations. Tests and
  local setup must not depend on manually prepared, undocumented database
  state.
- Use non-production fixtures for tests and avoid destructive operations
  against shared or production databases.

## Governance

- Requirements and product decisions are defined in the project
  specification and decision records; this constitution defines the
  engineering constraints applied while fulfilling them.
- If a requirement conflicts with a principle, document the conflict and
  obtain an explicit decision before proceeding. Security, privacy, and
  reporting-integrity principles cannot be waived by implementation
  convenience.
- Amendments must update this file, state the reason and impact, and identify
  any affected specifications, decisions, tests, or operational practices.
- Every implementation plan and code review must check applicable principles
  and record justified exceptions.
