---
description: "Use when calculating Jira sprint completion, remaining issue counts, or estimate totals from a Jira CSV export with the sprint progress tool."
---
# Using the sprint progress calculator

- Use `tools/calculate_sprint_progress.py` for the backlog calculation of completed versus remaining sprint issues and optional estimate totals.
- First obtain an authorized Jira CSV export that contains one issue per row. This tool reads local CSV data; it does not connect to Jira or decide which statuses mean complete.
- Run from the repository root and supply every completed status explicitly. Status matching is case-insensitive; every other included status is counted as remaining.

```sh
python3 tools/calculate_sprint_progress.py jira-sprint.csv \
  --completed-status Done \
  --completed-status Closed \
  --estimate-column story_points \
  --estimate-unit "story points"
```

- The default columns are `key`, `status`, and `issue_type`. Use `--key-column`, `--status-column`, and `--issue-type-column` if the export uses different headers.
- Epic, `Sub-task`, and `Subtask` issue types are excluded by default. Add `--exclude-type NAME` for more excluded types.
- Estimate values must all use the single declared `--estimate-unit`. Blank estimates remain unestimated and are not treated as zero. Without an estimate column, the report only contains issue counts.
- The tool prints JSON. Report completed and remaining counts, excluded count, and—when requested—known estimate totals with their estimated/unestimated issue counts. A `null` estimate total means no issues in that group had estimates; preserve that distinction from a known zero.
- If the export is missing required columns, has duplicate/blank keys, missing statuses, or invalid estimates, report the validation error and request a corrected export or arguments. Do not present partial results.
- Do not imply the result includes issues outside the supplied export or that its estimates use a universal Jira workflow or unit.
