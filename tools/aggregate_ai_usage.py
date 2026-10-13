#!/usr/bin/env python3
"""Aggregate normalized AI usage CSV rows without combining unlike metrics."""

from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable, Mapping


GROUP_COLUMNS = (
    "source",
    "metric",
    "metric_kind",
    "unit",
    "currency",
    "period_start",
    "period_end",
)
REQUIRED_COLUMNS = frozenset((*GROUP_COLUMNS, "amount"))


def aggregate_usage(
    rows: Iterable[Mapping[str, str | None]],
) -> dict[str, object]:
    """Sum amounts only when source, metric, kind, unit, currency, and period match."""
    totals: dict[tuple[str, ...], Decimal] = defaultdict(Decimal)
    row_counts: dict[tuple[str, ...], int] = defaultdict(int)
    input_rows = 0

    for row_number, row in enumerate(rows, start=2):
        input_rows += 1
        dimensions: list[str] = []
        for column in GROUP_COLUMNS:
            value = (row.get(column) or "").strip()
            if column != "currency" and not value:
                raise ValueError(f"row {row_number}: missing value in column {column!r}")
            dimensions.append(value)

        amount_text = (row.get("amount") or "").strip()
        if not amount_text:
            raise ValueError(f"row {row_number}: missing amount")
        try:
            amount = Decimal(amount_text)
        except InvalidOperation as exc:
            raise ValueError(f"row {row_number}: invalid amount {amount_text!r}") from exc
        if not amount.is_finite():
            raise ValueError(f"row {row_number}: amount must be finite")

        key = tuple(dimensions)
        totals[key] += amount
        row_counts[key] += 1

    groups = []
    for key in sorted(totals):
        group = dict(zip(GROUP_COLUMNS, key))
        group["amount"] = format(totals[key], "f")
        group["rows"] = row_counts[key]
        groups.append(group)
    return {"input_rows": input_rows, "groups": groups}


def _validate_headers(fieldnames: list[str] | None) -> None:
    available = set(fieldnames or [])
    missing = sorted(REQUIRED_COLUMNS - available)
    if missing:
        raise ValueError(f"CSV is missing required columns: {', '.join(missing)}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv_file", type=Path, help="path to a normalized usage CSV export")
    args = parser.parse_args(argv)

    try:
        with args.csv_file.open(encoding="utf-8-sig", newline="") as csv_file:
            reader = csv.DictReader(csv_file)
            _validate_headers(reader.fieldnames)
            result = aggregate_usage(reader)
    except (OSError, csv.Error, ValueError) as exc:
        parser.error(str(exc))

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
