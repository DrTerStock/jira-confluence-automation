# Change Request Registry

Use this registry for proposed or accepted changes to project scope,
requirements, architecture, or release behavior. For each material change,
record its impact and update [backlog.md](./backlog.md), [TODO.md](./TODO.md),
and [project_spec.md](./project_spec.md) together. Keep the decision IDs and
status consistent across those documents.

## Status definitions

- **Proposed** — awaiting review; not approved for implementation.
- **Accepted** — approved, but implementation or documentation is not complete.
- **Deferred** — intentionally postponed; record the reason and revisit point.
- **Rejected** — reviewed and not accepted; retain the rationale.
- **Implemented** — approved change has been applied and verified.

## Registry

| ID | Date | Request | Impact | Status | Record |
| --- | --- | --- | --- | --- | --- |
| CR-001 | 2026-10-13 | Verify that progress records match repository evidence; add synchronized Decisions Made sections and establish this registry. | Documentation governance only. Clarifies that the existing Python/GitHub Actions weekly report is not the Forge dashboard implementation; records D-001 through D-005 and the partial Forge capability check. | Implemented | Updated [backlog.md](./backlog.md), [TODO.md](./TODO.md), and [project_spec.md](./project_spec.md). |
| CR-002 | 2026-10-13 | Evaluate existing Jira/Confluence MCP servers against the backlog and classify each task as MCP-assisted or requiring a custom skill. | Documentation and workflow guidance only; the Forge app remains project-specific implementation work. Existing Atlassian MCP servers may assist with Jira/Confluence discovery and content operations, but do not replace runtime authorization, Forge widget development, Jira reporting guarantees, or GitHub Copilot/OpenAI/Anthropic usage integrations. No authenticated MCP connection was verified in the workspace. | Implemented | Updated [backlog.md](./backlog.md) with the official Atlassian Rovo MCP Server and community MCP Atlassian references, capability boundaries, connection caveat, and MCP/custom skill labels on all checklist tasks. |
| CR-003 | 2026-10-13 | Reconcile legacy D-001/D-003/D-004 records with the existing MVP clarifications and remediate the specification checklist. | Express/React/PostgreSQL with a Confluence shell; tenant-bound deployment secrets; reported team counters and manual count history. Individual identity, estimates/monetary metrics, periodic refresh and pure Forge-native runtime are explicitly excluded. This records existing clarification decisions; live embedding/account/browser/security gates remain open. | Implemented | Synchronized [backlog.md](./backlog.md), [TODO.md](./TODO.md), [project_spec.md](./project_spec.md), [specification.md](./spec/specification.md), and [checklist.md](./spec/checklist.md). 107 local tests passed with PostgreSQL. |

## Current decision record

- **D-001/D-003/D-004 (CR-003, superseding their legacy CR-001 wording):**
  React/Vite + Express + PostgreSQL behind a Confluence shell; installation-bound
  backend secrets; reported organization counters and scoped manual count
  observations. Existing clarification exclusions remain explicit. Actual host,
  account, browser and production review gates remain open.
- **D-002/D-005 (CR-001):** Jira and AI reporting remain in the first release;
  the Python weekly report remains separate automation.
- **MCP assessment (CR-002):** Use an existing Atlassian MCP server only for
  suitable Jira/Confluence discovery or content operations. Treat the Forge
  dashboard, provider integrations, project-specific testing, and release
  validation as custom implementation work. MCP availability does not imply
  that a server is configured or authenticated.

## New request template

Copy this row for each new request and assign the next `CR-NNN` identifier:

| ID | Date | Request | Impact | Status | Record |
| --- | --- | --- | --- | --- | --- |
| CR-NNN | YYYY-MM-DD | Concise description of the requested change. | Scope, architecture, schedule, security/privacy, and compatibility implications. | Proposed | Decision/rationale and links to synchronized updates. |
