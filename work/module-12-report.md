# Module 12 Completion Report

## Instruction File
- Filename: instructions/use-calculate_sprint_progress.agent.md

````markdown
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
````

## Script File
- Filename: tools/calculate_sprint_progress.py
- Language: Python

```python
#!/usr/bin/env python3
"""Summarize completed and remaining Jira sprint issues from a CSV export."""

from __future__ import annotations

import argparse
import csv
import json
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable, Mapping


DEFAULT_EXCLUDED_TYPES = frozenset({"epic", "sub-task", "subtask"})


def _decimal_text(value: Decimal | None) -> str | None:
    return format(value, "f") if value is not None else None


def summarize_sprint_progress(
    rows: Iterable[Mapping[str, str | None]],
    *,
    completed_statuses: set[str],
    key_column: str = "key",
    status_column: str = "status",
    issue_type_column: str = "issue_type",
    excluded_types: set[str] | frozenset[str] = DEFAULT_EXCLUDED_TYPES,
    estimate_column: str | None = None,
    estimate_unit: str | None = None,
) -> dict[str, object]:
    """Return counts and optional estimate totals without inventing missing values."""
    normalized_completed = {status.strip().casefold() for status in completed_statuses}
    if not normalized_completed or "" in normalized_completed:
        raise ValueError("at least one non-empty completed status is required")
    if bool(estimate_column) != bool(estimate_unit):
        raise ValueError("--estimate-column and --estimate-unit must be used together")

    normalized_excluded = {issue_type.strip().casefold() for issue_type in excluded_types}
    seen_keys: set[str] = set()
    completed_count = 0
    remaining_count = 0
    excluded_count = 0
    estimate_counts = {"completed": 0, "remaining": 0}
    estimate_unestimated = {"completed": 0, "remaining": 0}
    estimate_totals = {"completed": Decimal(0), "remaining": Decimal(0)}

    for row_number, row in enumerate(rows, start=2):
        issue_type_value = (row.get(issue_type_column) or "").strip()
        if not issue_type_value:
            raise ValueError(
                f"row {row_number}: missing issue type in column {issue_type_column!r}"
            )
        issue_type = issue_type_value.casefold()
        if issue_type in normalized_excluded:
            excluded_count += 1
            continue

        issue_key = (row.get(key_column) or "").strip()
        if not issue_key:
            raise ValueError(f"row {row_number}: missing issue key in column {key_column!r}")
        if issue_key.casefold() in seen_keys:
            raise ValueError(f"row {row_number}: duplicate issue key {issue_key!r}")
        seen_keys.add(issue_key.casefold())

        status = (row.get(status_column) or "").strip()
        if not status:
            raise ValueError(f"row {row_number}: missing status in column {status_column!r}")
        bucket = "completed" if status.casefold() in normalized_completed else "remaining"
        if bucket == "completed":
            completed_count += 1
        else:
            remaining_count += 1

        if estimate_column:
            estimate_value = (row.get(estimate_column) or "").strip()
            if not estimate_value:
                estimate_unestimated[bucket] += 1
                continue
            try:
                estimate = Decimal(estimate_value)
            except InvalidOperation as exc:
                raise ValueError(
                    f"row {row_number}: invalid estimate {estimate_value!r}"
                ) from exc
            if not estimate.is_finite() or estimate < 0:
                raise ValueError(
                    f"row {row_number}: estimate must be finite and non-negative"
                )
            estimate_totals[bucket] += estimate
            estimate_counts[bucket] += 1

    total_count = completed_count + remaining_count
    result: dict[str, object] = {
        "counts": {
            "completed": completed_count,
            "remaining": remaining_count,
            "included_total": total_count,
            "excluded": excluded_count,
        },
        "completed_statuses": sorted(status.strip() for status in completed_statuses),
    }
    if estimate_column and estimate_unit:
        result["estimates"] = {
            "unit": estimate_unit,
            "completed": {
                "known_total": _decimal_text(
                    estimate_totals["completed"] if estimate_counts["completed"] else None
                ),
                "estimated_issues": estimate_counts["completed"],
                "unestimated_issues": estimate_unestimated["completed"],
            },
            "remaining": {
                "known_total": _decimal_text(
                    estimate_totals["remaining"] if estimate_counts["remaining"] else None
                ),
                "estimated_issues": estimate_counts["remaining"],
                "unestimated_issues": estimate_unestimated["remaining"],
            },
        }
    else:
        result["estimates"] = None
    return result


def _validate_headers(
    fieldnames: list[str] | None, required: set[str]
) -> None:
    available = set(fieldnames or [])
    missing = sorted(required - available)
    if missing:
        raise ValueError(f"CSV is missing required columns: {', '.join(missing)}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", type=Path, help="path to a Jira issue CSV export")
    parser.add_argument(
        "--completed-status",
        action="append",
        required=True,
        help="completed status name; repeat for each completed status",
    )
    parser.add_argument("--key-column", default="key")
    parser.add_argument("--status-column", default="status")
    parser.add_argument("--issue-type-column", default="issue_type")
    parser.add_argument(
        "--exclude-type",
        action="append",
        default=sorted(DEFAULT_EXCLUDED_TYPES),
        help="issue type to exclude (repeatable; defaults to epic and subtask types)",
    )
    parser.add_argument("--estimate-column", help="optional numeric estimate column")
    parser.add_argument(
        "--estimate-unit",
        help="unit for the estimate column, such as story points or hours",
    )
    args = parser.parse_args(argv)

    required = {args.key_column, args.status_column, args.issue_type_column}
    if args.estimate_column:
        required.add(args.estimate_column)
    try:
        with args.csv_file.open(encoding="utf-8-sig", newline="") as csv_file:
            reader = csv.DictReader(csv_file)
            _validate_headers(reader.fieldnames, required)
            result = summarize_sprint_progress(
                reader,
                completed_statuses=set(args.completed_status),
                key_column=args.key_column,
                status_column=args.status_column,
                issue_type_column=args.issue_type_column,
                excluded_types=set(args.exclude_type),
                estimate_column=args.estimate_column,
                estimate_unit=args.estimate_unit,
            )
    except (OSError, csv.Error, ValueError) as exc:
        parser.error(str(exc))

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

## Script Execution Output

Sample CSV input (`work/module-12-sample-sprint.csv`):
```csv
key,status,issue_type,story_points
ENG-101,Done,Story,5
ENG-102,In Progress,Task,3
ENG-103,To Do,Epic,8
ENG-104,Closed,Bug,
```

Command:
```sh
/Users/Aliaksandr_Shcherba2/workspace/.venv/bin/python tools/calculate_sprint_progress.py work/module-12-sample-sprint.csv --completed-status Done --completed-status Closed --estimate-column story_points --estimate-unit 'story points'
```

Raw script output:
```json
{
  "counts": {
    "completed": 2,
    "remaining": 1,
    "included_total": 3,
    "excluded": 1
  },
  "completed_statuses": [
    "Closed",
    "Done"
  ],
  "estimates": {
    "unit": "story points",
    "completed": {
      "known_total": "5",
      "estimated_issues": 1,
      "unestimated_issues": 1
    },
    "remaining": {
      "known_total": "3",
      "estimated_issues": 1,
      "unestimated_issues": 0
    }
  }
}
```

Validation error example:
```sh
/Users/Aliaksandr_Shcherba2/workspace/.venv/bin/python tools/calculate_sprint_progress.py work/module-12-sample-sprint.csv --completed-status Done --estimate-column missing_estimate --estimate-unit 'story points'
```

Raw terminal output:
```text
usage: calculate_sprint_progress.py [-h] --completed-status COMPLETED_STATUS
                                    [--key-column KEY_COLUMN]
                                    [--status-column STATUS_COLUMN]
                                    [--issue-type-column ISSUE_TYPE_COLUMN]
                                    [--exclude-type EXCLUDE_TYPE]
                                    [--estimate-column ESTIMATE_COLUMN]
                                    [--estimate-unit ESTIMATE_UNIT]
                                    csv_file
calculate_sprint_progress.py: error: CSV is missing required columns: missing_estimate
```

Raw `--help` output:
```
usage: calculate_sprint_progress.py [-h] --completed-status COMPLETED_STATUS
                                    [--key-column KEY_COLUMN]
                                    [--status-column STATUS_COLUMN]
                                    [--issue-type-column ISSUE_TYPE_COLUMN]
                                    [--exclude-type EXCLUDE_TYPE]
                                    [--estimate-column ESTIMATE_COLUMN]
                                    [--estimate-unit ESTIMATE_UNIT]
                                    csv_file

Summarize completed and remaining Jira sprint issues from a CSV export.

positional arguments:
  csv_file              path to a Jira issue CSV export

optional arguments:
  -h, --help            show this help message and exit
  --completed-status COMPLETED_STATUS
                        completed status name; repeat for each completed
                        status
  --key-column KEY_COLUMN
  --status-column STATUS_COLUMN
  --issue-type-column ISSUE_TYPE_COLUMN
  --exclude-type EXCLUDE_TYPE
                        issue type to exclude (repeatable; defaults to epic
                        and subtask types)
  --estimate-column ESTIMATE_COLUMN
                        optional numeric estimate column
  --estimate-unit ESTIMATE_UNIT
                        unit for the estimate column, such as story points or
                        hours
```
