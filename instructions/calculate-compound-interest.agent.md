- Use `./tools/compound_interest.py` when asked to calculate or estimate compound growth from an initial principal, annual interest rate, compounding frequency, and duration.
- Invoke it from the repository root with positional arguments in this order: `python3 tools/compound_interest.py <principal> <annual_rate> <compounds_per_year> <years>`.
  + Enter `annual_rate` as a percentage, such as `5` for 5%, not `0.05`.
  + `principal` must be non-negative, `compounds_per_year` a positive integer, and `years` a positive number. Fractional years are accepted.
  + Example: `python3 tools/compound_interest.py 1000 5 12 2`.
- Present the script's `Final amount` and `Interest earned` values, preserving its two-decimal-place formatting.
  + Label the results clearly and include the inputs or units when needed to make the estimate understandable.
  + Do not imply the estimate accounts for taxes, fees, inflation, or terms not supplied by the user.
- If the script rejects the inputs, report the validation error and ask for corrected values instead of presenting a result.
