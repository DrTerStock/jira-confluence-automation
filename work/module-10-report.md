# Module 10 Completion Report

## Instruction Files
```text
instructions/create-status-report.agent.md
instructions/creating-instructions.agent.md
instructions/main.agent.md
instructions/synchronize-project-records.agent.md
instructions/validate-evidence.agent.md
instructions/verify-provider-capabilities.agent.md
```

## main.agent.md Contents
```markdown
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

- [`./instructions/verify-provider-capabilities.agent.md`](./verify-provider-capabilities.agent.md) — Verify provider reporting capabilities and record evidence-backed implementation limits.
  + Keywords: provider API, provider capabilities, usage reporting, capability matrix, integration coverage
  + Target: `backlog.md`, `project_spec.md`, provider integration work

- [`./instructions/synchronize-project-records.agent.md`](./synchronize-project-records.agent.md) — Keep project decisions and verified milestones consistent across planning records.
  + Keywords: synchronize backlog, update TODO, project specification, decision record, milestone status
  + Target: `backlog.md`, `TODO.md`, `project_spec.md`, `change_request_registry.md`

- [`./instructions/validate-evidence.agent.md`](./validate-evidence.agent.md) — Apply consistent evidence standards when verifying claims and project status.
  + Keywords: verify evidence, validate claim, evidence standard, status verification, source validation
  + Target: project verification workflows
```

## Sample Instruction
- File: instructions/validate-evidence.agent.md
- Contents:
```markdown
- Identify the exact claim or status being established and what evidence would support it.
- Prefer current primary sources for external capabilities and repository records, tests, or explicit decisions for project status.
- Record the source and verification date for material claims, and distinguish documented behavior from account-specific or runtime verification.
- Treat absent, incomplete, or conflicting evidence as unresolved; do not infer support, success, completion, or a zero value from missing data.
- State evidence gaps and limitations explicitly, and do not present assumptions or inferences as verified facts.
```
