# Instructions Catalog

Each entry below is an instruction file with a one-line description.

- [`./instructions/create-status-report.agent.md`](./create-status-report.agent.md) — Generate concise weekly team status reports in Markdown.
  + Keywords: status report, weekly report, sprint summary, stakeholder update, team status
  + Target: `**/*.md`
  + Exceptions: not for deep technical troubleshooting or code review tasks

- [`./instructions/creating-instructions.agent.md`](./creating-instructions.agent.md) — Create and maintain reusable instruction files and instruction infrastructure for a project.
  + Keywords: create instruction, instruction file, instruction infrastructure, set up instructions, add agent workflow
  + Target: `**/*.md`
  + Exceptions: not for code implementation or feature delivery tasks
- [`./instructions/validate-markdown.agent.md`](./validate-markdown.agent.md) — Validate project Markdown files for consistent whitespace and encoding.
  + Keywords: Markdown validation, formatting consistency, validate docs
  + Target: `**/*.md`
- [`./instructions/calculate-compound-interest.agent.md`](./calculate-compound-interest.agent.md) — Calculate compound interest with the command-line tool and present its results.
  + Keywords: compound interest, compound growth, interest earned, final amount
  + Target: `tools/compound_interest.py`
- [`./instructions/use-calculate_sprint_progress.agent.md`](./use-calculate_sprint_progress.agent.md) — Calculate sprint progress and optional estimate totals from a Jira CSV export.
  + Keywords: sprint progress, completed issues, remaining issues, estimate totals
  + Target: `tools/calculate_sprint_progress.py`
- [`./instructions/use-aggregate_ai_usage.agent.md`](./use-aggregate_ai_usage.agent.md) — Aggregate compatible AI usage totals from normalized provider data.
  + Keywords: AI usage, provider usage, usage aggregation, cost totals
  + Target: `tools/aggregate_ai_usage.py`
- [`./instructions/verify-provider-capabilities.agent.md`](./verify-provider-capabilities.agent.md) — Verify provider reporting capabilities and record evidence-backed implementation limits.
  + Keywords: provider API, provider capabilities, usage reporting, capability matrix, integration coverage
  + Target: `backlog.md`, `project_spec.md`, provider integration work

- [`./instructions/synchronize-project-records.agent.md`](./synchronize-project-records.agent.md) — Keep project decisions and verified milestones consistent across planning records.
  + Keywords: synchronize backlog, update TODO, project specification, decision record, milestone status
  + Target: `backlog.md`, `TODO.md`, `project_spec.md`, `change_request_registry.md`

- [`./instructions/validate-evidence.agent.md`](./validate-evidence.agent.md) — Apply consistent evidence standards when verifying claims and project status.
  + Keywords: verify evidence, validate claim, evidence standard, status verification, source validation
  + Target: project verification workflows
