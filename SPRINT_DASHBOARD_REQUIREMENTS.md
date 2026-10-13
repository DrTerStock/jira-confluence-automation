# Jira Sprint Progress Dashboard — Requirements

> Interview summary for a Confluence-embedded team dashboard. Confirm the open
> decisions in [Open questions](#open-questions) before implementation.

## Contents

- [Overview](#overview)
- [Product decisions](#product-decisions)
- [Functional requirements](#functional-requirements)
  - [Confluence experience and access](#confluence-experience-and-access)
  - [Jira sprint reporting](#jira-sprint-reporting)
  - [AI usage and cost reporting](#ai-usage-and-cost-reporting)
  - [Configuration and refresh](#configuration-and-refresh)
- [Quality and operational requirements](#quality-and-operational-requirements)
- [Acceptance criteria](#acceptance-criteria)
- [Open questions](#open-questions)
- [Related project material](#related-project-material)

## Overview

Build a native Atlassian Forge app that provides a configurable widget/macro on
a Confluence page. It will help a team track one Jira board's sprint progress
and, in the first release, view AI usage and cost information from GitHub
Copilot and OpenAI/Anthropic API accounts.

The dashboard is intended for team use. Any person who can view the containing
Confluence page may view its widget. The first release includes both Jira sprint
reporting and AI usage reporting.

## Product decisions

| Topic | Requirement / decision |
| --- | --- |
| Jira environment | Jira Cloud |
| Embed location | Confluence page widget/macro; not a Jira dashboard gadget |
| App approach | Native Atlassian Forge app |
| Initial Jira scope | One project/board per widget instance |
| Sprint navigation | Select any sprint, including full sprint history |
| AI reporting scope | GitHub Copilot plus OpenAI and Anthropic API usage |
| Audience | Anyone allowed to view the containing Confluence page |
| First-release scope | Include Jira and AI reporting together |

## Functional requirements

### Confluence experience and access

- The dashboard must be embeddable on a Confluence page as a native Forge
  widget/macro.
- A widget instance must be configurable independently so different pages can
  show different teams or data sources.
- Page-view permission is the default view-access boundary.
- The user's Confluence identity and the site's configured company sign-in
  should be used; the company SSO provider was identified as Okta or another
  SSO provider and should be confirmed against the Atlassian site.
- A Confluence Cloud site and administrator/install permission are available
  for app installation and end-to-end testing.

### Jira sprint reporting

- Connect to one Jira Cloud project/board for each widget instance.
- Allow viewers to select a sprint from the board's sprint history.
- Show sprint completion, remaining work, blockers, and a burndown-style view.
- Include stories, tasks, and bugs in sprint reporting.
- Exclude subtasks and epics.
- Refresh on demand and support periodic refresh at a cadence of a few minutes.
- Surface Jira data and integration errors rather than presenting missing or
  stale data as a successful result.

The sprint progress unit is not yet decided. See
[Progress measurement](#progress-measurement).

### AI usage and cost reporting

- Include organization-level usage for GitHub Copilot and OpenAI/Anthropic API
  accounts, subject to each provider's available reporting interfaces and
  permissions.
- Let viewers select a date range.
- Show team totals and an individual breakdown.
- Match provider identities to Atlassian users by work email where available.
  Show unmatched usage separately; do not silently assign it to a person.
- Prefer provider-reported token and cost figures.
- Offer estimated figures only as optional values, clearly labeled as
  estimates and distinguishable from provider-reported data.
- Show which sources and reporting periods contributed to each total. If a
  provider does not expose a requested metric, indicate that clearly rather
  than treating it as zero.

### Configuration and refresh

- Each widget instance must allow configuration of its Jira board and available
  usage sources.
- Use on-demand refresh and a periodic refresh option; the exact interval and
  whether it is viewer- or admin-controlled remain to be decided.
- Keep provider credentials and secrets in the appropriate secure Forge
  configuration/storage mechanism, never in page content or client-visible
  configuration.
- Report connection, permission, and provider-data errors visibly.

## Quality and operational requirements

- Respect Confluence page visibility and Jira/provider access permissions.
- Keep credentials out of browser-visible code, widget configuration exposed to
  viewers, and logs.
- Identify data freshness and source attribution for reported metrics.
- Preserve the distinction between unavailable data, zero usage, and estimated
  values.
- Individual usage is visible to everyone who can view the page under the
  current access choice; confirm that this is acceptable under team and
  company policy before rollout.
- Validate the Forge app against the available Confluence Cloud site and
  administrator install access.

## Acceptance criteria

1. An authorized page editor can add and configure the Forge widget on a
   Confluence page.
2. The widget reads one configured Jira Cloud board and lets a viewer select a
   sprint from its history.
3. For the selected sprint, the widget displays completion, remaining work,
   blockers, and a burndown-style view for stories, tasks, and bugs, excluding
   subtasks and epics.
4. A viewer can choose an AI usage date range and see available team-level
   totals and individual breakdowns for configured providers.
5. Identity matches use work email where available; unmatched usage is
   identified separately.
6. Provider-reported metrics are distinguishable from optional estimates.
   Missing metrics, stale data, and integration errors are not shown as zero or
   as successful data retrieval.
7. Page viewers can see the widget, while widget access is bounded by the
   containing page's permissions.
8. Data can be refreshed on demand, with periodic refresh supported.

## Open questions

### Progress measurement

Choose how sprint completion should be quantified:

- Story points, if the team estimates issues.
- Issue count, with each included issue weighted equally.
- Both, with issue counts as a fallback where estimates are absent.

**Suggested default:** show both when estimates are available, and retain issue
counts as a clear fallback. Confirm the team's estimation practice before
implementation.

### Jira workflow interpretation

Confirm which Jira statuses represent completed work and which statuses or
fields identify blockers. The project workflow has not yet been inspected.

### Provider reporting access and coverage

Although organization-level access to GitHub Copilot, OpenAI, and Anthropic
usage reports/APIs is available, verify the exact API/report permissions and
which metrics (tokens, cost, per-user attribution, historical range) each
provider actually exposes. Define a clear per-provider coverage/error state.

### Refresh cadence

Confirm the periodic refresh interval and whether it should be globally
configured or adjustable per widget.

### Individual usage visibility

Confirm that showing per-person usage to every viewer of the Confluence page is
acceptable under organizational privacy and reporting policy.

### Site and project setup

Record the Confluence site, Jira board/project, and the initial provider
organizations during implementation setup. Do not put credentials or tokens in
this document.

## Related project material

- [Weekly status report template](./STATUS_REPORT_TEMPLATE.md) — existing
  reporting fields for Jira board, sprint, completed issues, in-progress items,
  and blockers.
