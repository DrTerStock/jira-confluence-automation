# How to Fill Out the Weekly Status Report

Use [template.md](./template.md) to prepare one report for each reporting
period. Keep the report concise, link to source records where possible, and
include only information that is current and verified.

## Before You Start

1. Set the reporting period and identify the report owner.
2. Check the Jira board and sprint dates. Link the board and Jira issues so
   readers can verify details.
3. Gather current sprint and provider data for that period. Record when each
   source was last successfully updated.
4. Confirm that the report is appropriate for its audience. Share individual
   AI usage only when organizational policy permits it.

## Completing the Sections

- **Header:** Use the actual project/team, board, sprint, reporting dates, and
  report owner. Select an overall status and explain it briefly; use “At risk”
  or “Off track” when a material issue warrants it.
- **Summary:** State the main outcome, the most important change, and any
  decision or help needed. Avoid repeating every issue listed later.
- **Sprint Progress:** Report completed and remaining work with an explicit
  unit, such as issues or story points. Do not compare different units. Note
  whether estimates are missing or progress data covers only part of the
  sprint. If reporting both points and issue count, keep them separate.
- **Completed Issues:** Include issues completed during this reporting period,
  with their Jira links, concise outcomes, and owners where useful.
- **In-Progress Items:** List notable active work with its current status and
  target date. Do not present a target date as a commitment unless it has been
  agreed.
- **Blockers and Risks:** Describe the impact, accountable owner, and specific
  help or decision needed. Distinguish an active blocker from a potential risk.
  Say “None” only after checking.
- **AI Usage and Cost:** Complete this section when AI usage reporting is in
  scope, including when some or all source data is unavailable.
  - Name each source and its actual reporting period. Note truncation or gaps.
  - Preserve provider units and semantics. State the metric (for example,
    requests or tokens) and its unit; do not combine unlike metrics.
  - Keep costs separated by currency. Do not add different currencies together
    without an approved conversion policy.
  - Mark provider-reported figures separately from estimates. For each
    estimate, state the basis and label it as estimated.
  - Treat a successfully reported zero as zero, but identify an unavailable
    metric or failed source as “Unavailable” or “Not reported,” never as zero.
  - Summarize identity matching and unmatched records without guessing matches
    from display names. Follow organizational privacy rules for individual
    breakdowns.
  - Give the last successful retrieval time for each source and disclose
    partial coverage, errors, or stale data.
- **Next Sprint Goals:** Choose a small number of concrete goals. Link a Jira
  epic or issue and identify an owner and measurable success criterion.
- **Decisions and Follow-Ups:** Capture decisions needed and actions that do
  not fit elsewhere, with a named owner and due date.

## Final Check

- Replace all bracketed prompts and remove unused optional lines.
- Check that dates, counts, units, issue links, owners, and status statements
  agree with their sources.
- Confirm that the example values are not copied into a real report without
  verification.
- Remove credentials, access tokens, and unnecessary personal information.
- Make the report period and any known data limitations clear to readers.
