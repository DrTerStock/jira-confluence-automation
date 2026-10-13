#!/usr/bin/env python3
"""Calculate compound interest from command-line inputs."""

from __future__ import annotations

import argparse
import math


def calculate_compound_interest(
    principal: float,
    annual_rate: float,
    compounds_per_year: int,
    years: float,
) -> tuple[float, float]:
    """Return the final amount and interest earned."""
    if not math.isfinite(principal) or principal < 0:
        raise ValueError("principal must be a finite, non-negative number")
    if not math.isfinite(annual_rate):
        raise ValueError("annual rate must be a finite number")
    if compounds_per_year <= 0:
        raise ValueError("compounds per year must be a positive integer")
    if not math.isfinite(years) or years <= 0:
        raise ValueError("years must be a finite, positive number")

    periodic_rate = annual_rate / (100 * compounds_per_year)
    if periodic_rate < -1:
        raise ValueError("annual rate is too low for the compounding frequency")

    try:
        final_amount = principal * (1 + periodic_rate) ** (compounds_per_year * years)
    except OverflowError as exc:
        raise ValueError("the supplied values are too large to calculate") from exc

    if not math.isfinite(final_amount):
        raise ValueError("the supplied values are too large to calculate")

    return final_amount, final_amount - principal


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("principal", type=float, help="initial amount")
    parser.add_argument(
        "annual_rate",
        type=float,
        help="annual interest rate as a percentage (for example, 5 for 5%%)",
    )
    parser.add_argument(
        "compounds_per_year",
        type=int,
        help="number of times interest is compounded per year",
    )
    parser.add_argument("years", type=float, help="total duration in years")
    args = parser.parse_args()

    try:
        final_amount, interest_earned = calculate_compound_interest(
            args.principal,
            args.annual_rate,
            args.compounds_per_year,
            args.years,
        )
    except ValueError as exc:
        parser.error(str(exc))

    print(f"Final amount: {final_amount:.2f}")
    print(f"Interest earned: {interest_earned:.2f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
