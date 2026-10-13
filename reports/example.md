# Weekly Engineering Status Report

> **Illustrative example only:** all names, issue keys, dates, counts, costs,
> and usage values below are fictional. They do not describe actual project or
> provider data.

- **Project/team:** Sprint and AI Usage Dashboard
- **Jira board:** Dashboard Team — [illustrative board]
- **Sprint:** Dashboard MVP 4 (October 5–16, 2026)
- **Reporting period:** October 5–9, 2026
- **Report owner:** Jordan Lee
- **Overall status:** At risk — provider reporting permissions and the sprint
  progress unit still need confirmation.

## Summary

The team completed the initial reporting requirements review and agreed on the
dashboard's source coverage and error-state behavior. Work is progressing on
the Forge widget design, but AI provider access and Jira progress rules remain
open and could affect implementation estimates.

## Sprint Progress

- **Completed:** 3 of 8 issues; 8 of 21 story points
- **Remaining:** 5 of 8 issues; 13 of 21 story points
- **Blocked issues:** 1
- **Progress notes:** Figures are illustrative. Point totals cover only issues
  with estimates; issue counts cover all included sprint issues. Burndown
  history has not yet been validated.

## Completed Issues

- **DASH-101** — Review dashboard requirements and document acceptance
  criteria; owner: Jordan Lee; outcome: requirements baseline reviewed.
- **DASH-102** — Define unavailable, partial, and error states; owner: Priya
  Nair; outcome: reporting states documented.
- **DASH-103** — Draft widget data-source configuration; owner: Mateo Ruiz;
  outcome: initial configuration fields agreed.

## In-Progress Items

- **DASH-104** — Verify Jira sprint and issue data; owner: Priya Nair;
  status: checking board access and completion mapping; target: October 14.
- **DASH-105** — Validate AI provider reporting capabilities; owner: Mateo
  Ruiz; status: access requirements under review; target: October 15.

## Blockers and Risks

- **DASH-106 — Provider access setup:** test organization access is not
  configured, blocking verification of provider-specific usage and identity
  coverage. **Owner:** Mateo Ruiz. **Help/decision needed:** administrator to
  confirm access by October 13.
- **Provider API access not confirmed:** provider-specific usage and identity
  coverage may delay the AI reporting design.
  **Owner:** Mateo Ruiz.
- **Progress definition undecided:** workflow completion rules and the Jira
  estimate field are unconfirmed, which may change how sprint progress is
  calculated. **Owner:** Jordan Lee. **Help/decision needed:** product owner to
  confirm the first-release progress unit by October 14.

## AI Usage and Cost

- **Reporting period:** October 1–9, 2026
- **Sources covered:** GitHub Copilot, OpenAI API, Anthropic API (sample data)
- **Team usage:** GitHub Copilot: 1,240 requests (illustrative); OpenAI API:
  820,000 input tokens and 160,000 output tokens (illustrative); Anthropic
  API: unavailable — access not configured.
- **Reported cost:** OpenAI API: USD 18.40 (illustrative); GitHub Copilot:
  unavailable — no cost value available in this sample; Anthropic API:
  unavailable.
- **Estimates:** None.
- **Attribution:** 7 sample records matched to users by work email; 2 records
  remain unmatched. Values are illustrative and not tied to actual individuals.
- **Freshness and limitations:** Sample retrieval time: October 9, 2026 at
  16:00 UTC. Anthropic data was not retrieved. Provider date coverage and
  per-user attribution have not been validated.

## Next Sprint Goals

- Confirm Jira progress and blocker rules — **DASH-104** — **Success measure:**
  approved status mapping and estimate field — **Owner:** Priya Nair
- Complete provider capability review — **DASH-105** — **Success measure:**
  documented metrics, permissions, and historical coverage for each source —
  **Owner:** Mateo Ruiz

## Decisions and Follow-Ups

- Confirm whether individual AI usage may be shown to all Confluence page
  viewers — **Owner:** Product owner — **Due:** October 14, 2026
- Confirm the desired periodic refresh interval — **Owner:** Jordan Lee —
  **Due:** October 16, 2026
