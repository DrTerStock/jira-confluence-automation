---
description: "Use when aggregating normalized AI provider usage or cost rows by compatible metric, unit, currency, source, and reporting period."
---
# Using the AI usage aggregator

- Use `tools/aggregate_ai_usage.py` to calculate verified team totals from a normalized CSV export. It does not retrieve data from GitHub Copilot, OpenAI, Anthropic, or another provider.
- Only use data obtained from an authorized source. The CSV must have these headers: `source,metric,metric_kind,unit,currency,period_start,period_end,amount`. Leave `currency` blank only for metrics that are not denominated in a currency.
- Run from the repository root:

```sh
python3 tools/aggregate_ai_usage.py normalized-usage.csv
```

- Each output group retains source, metric, metric kind (`reported` or `estimated` as supplied), unit, currency, and period. Values are summed only when all these fields match; currencies and incompatible units/periods are never converted or combined.
- The tool prints JSON with decimal-safe amount strings and the number of contributing rows. Preserve the provider's metric definition and the output dimensions when reporting totals.
- If the CSV is missing a required dimension or contains an invalid/non-finite amount, report the validation error and request corrected data rather than presenting a partial total.
- Do not label an estimate as provider-reported usage, combine unlike currencies, or imply coverage beyond the supplied rows.
