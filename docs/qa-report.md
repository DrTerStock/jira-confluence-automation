# QA Report: Jira Sprint and AI Usage Dashboard

Date: 2026-10-13 (Europe/Vilnius).

## Summary and scope

The session verified local startup, dashboard navigation, form submission,
reporting controls, failure handling, and browser diagnostics. The existing
Chrome walkthrough passed 21 checks; four additional checks passed during
report review. One low-severity resource-loading bug was found and fixed.
There are no unresolved bugs demonstrated by these checks.

Testing used installed Google Chrome driven through Playwright, not Chrome
DevTools MCP: MCP configuration was added, but its tools were not exposed to
this chat. Jira, provider responses, and authenticated roles were mocked;
PostgreSQL configuration and manual observations used real local persistence.
Normal servers remained separate from the isolated mock demo.

## Pages and views visited

The app has one dashboard with conditional panels, rather than separate routes.

| URL/view | Coverage | Screenshot |
| --- | --- | --- |
| Normal frontend, `http://127.0.0.1:5173/` | Permission-denied startup; visible text and controls inventoried; protected views unavailable without host authentication | [Normal access](../reports/walkthrough/01-unverified-access.png) |
| Mock frontend, `http://127.0.0.1:5174/`, new widget | Configuration prompt and unavailable history | [New widget](../reports/walkthrough/02-unconfigured.png) |
| Editor configuration panel | Board, provider checkboxes, blocked statuses, story points and estimate field; Save and Cancel | [Configuration](../reports/walkthrough/03-editor-configuration.png) |
| Configured/admin dashboard | Sprint summary, blockers, groups, provider metrics and readiness | [Dashboard](../reports/walkthrough/04-configured-dashboard.png) |
| Manual history and historical sprint | Refresh creates dated observations; sprint selector changes report | [History](../reports/walkthrough/05-manual-history.png), [Historical sprint](../reports/walkthrough/06-historical-sprint.png) |
| Failure and empty states | Retained/partial provider results, Jira denial and rate limit, empty reporting | [Provider failure](../reports/walkthrough/07-retained-provider-failure.png), [Partial](../reports/walkthrough/08-partial-report.png), [Jira denial](../reports/walkthrough/09-jira-denied.png), [Rate limit](../reports/walkthrough/10-jira-rate-limit.png), [Empty](../reports/walkthrough/11-empty-usage.png) |
| Viewer, second widget and denied page | Role restrictions, independent board/source settings, page access denial | [Viewer](../reports/walkthrough/12-viewer.png), [Second widget](../reports/walkthrough/13-second-widget.png), [Denied page](../reports/walkthrough/14-page-denied.png) |
| Stale, scale and mobile views | Old timestamps, 500 issues, narrow layout | [Stale](../reports/walkthrough/15-clock-stale.png), [Scale](../reports/walkthrough/15-scale-500.png), [Mobile](../reports/walkthrough/16-mobile.png) |

## Interactive tests and results

The main flow opened an unconfigured mock widget, selected board 12
(Prototype team), enabled GitHub Copilot/OpenAI/Anthropic, entered `Blocked`,
enabled story points with `customfield_10001`, and clicked **Save configuration**.
The active sprint and reports loaded; the form closed. Manual refresh then
created timestamped count history. Subsequent interactions covered historical
sprints, usage dates, provider selection, roles, and simulated failures.

| Check | Result |
| --- | --- |
| Normal startup rejects unverified access | PASS |
| New widget displays configuration entry and unavailable history | PASS |
| Configuration saves board, providers and explicit preferences without secrets | PASS |
| Summary filters epics/subtasks, groups work and shows explicit blockers | PASS |
| Manual refresh creates dated PostgreSQL history | PASS |
| Historical sprint selection works | PASS |
| Date range and provider controls update scoped reports | PASS |
| Provider failure preserves good and retained data with stale warning | PASS |
| Fresh mixed provider report has prominent partial status | PASS |
| Jira denial clears retained protected data | PASS |
| Jira rate limit exposes retry guidance and retained stale result | PASS |
| Successful empty provider query is distinct from zero | PASS |
| Viewer cannot configure or read admin readiness | PASS |
| Trusted editor can configure without administrator readiness access | PASS |
| Second widget has independent board and enabled sources | PASS |
| Denied Confluence page reveals no report data | PASS |
| Already old provider data is immediately marked stale | PASS |
| 500-issue mock dashboard becomes usable within three seconds | PASS |
| Mobile layout has no horizontal overflow | PASS |
| Dashboard and configuration controls work with the keyboard | PASS |
| Browser reports no uncaught JavaScript errors | PASS |

Evidence: [walkthrough results](../reports/walkthrough/results.json) and
[runner](../scripts/demo/walkthrough.js). The 500-issue mock load measured
56 ms in this run; this is a local synthetic measurement, not live performance.

## Bugs found and fixes

| Bug | Severity | Description and evidence | Fix/status |
| --- | --- | --- | --- |
| QA-001: Missing favicon | Low | Chrome logged a 404 for `/favicon.ico` during dashboard load, refresh and configuration inspection. No uncaught JavaScript exception was observed. [Original console capture](qa-evidence/console-before-fix.json). [Affected dashboard screenshot](../reports/walkthrough/04-configured-dashboard.png) shows the page, not the console; no pre-fix console screenshot was captured. | Fixed in `1adb6a5`, `fix: add dashboard favicon to prevent browser console 404`. Added `frontend/public/favicon.svg` and an explicit icon link in `frontend/index.html`. |

After the fix, the favicon returned HTTP 200 with SVG content type, and Chrome
reported no errors, warnings or uncaught exceptions in the verification run.
Frontend production build and formatting passed. SVG formatting required an
explicit HTML parser; the initial parser-inference failure was a tooling issue,
not an application defect. [Post-fix screenshot](qa-evidence/fixed-dashboard.png).

Permission-denied normal startup and intentionally injected provider/Jira
failures are expected behavior, not additional discovered bugs.

## Additional tests identified during report review

Form submission coverage needed negative-input and cancellation checks. These
were executed against the mock admin configuration panel; request monitoring
confirmed that invalid submissions and Cancel sent no configuration PUT.

| Additional test case | Expected behavior | Result |
| --- | --- | --- |
| Clear required Jira board and click Save | Native required-field validation; no configuration write | PASS |
| Enable story points, enter `invalid` as estimate field, click Save | Pattern validation rejects field; no configuration write | PASS |
| Click Cancel after editing the form | Panel closes; no configuration write | PASS |
| Reload after favicon fix and inspect browser console | Icon returns 200; no errors, warnings or uncaught exceptions | PASS |

Evidence: [additional results](qa-evidence/additional-results.json),
[invalid estimate screenshot](qa-evidence/invalid-estimate.png).
These checks used the existing configured fixture widget; invalid changes
were canceled rather than saved.

## Current application status and remaining testing

All 25 executed browser checks passed. PostgreSQL was healthy, backend health
and readiness endpoints returned 200, and the normal frontend returned 200.
The mock demo was started at port 5174 with its API at port 4100. No broader
unit-test suite was rerun in this session; the frontend build passed after the
favicon fix. The original 21-check walkthrough ran before that small fix;
the subsequent console and additional validation checks ran after it.

The local prototype remains pending live release validation. Required follow-up
cases need an authorized environment and cannot be established by these mocks:

- Add/configure the widget in real Confluence; verify page/editor/admin context,
  viewer Jira authorization and installation removal/deletion.
- Compare sprint scope, estimates and blocker mapping with the intended Jira board.
- Exercise each provider against approved organization accounts and verify
  metrics, supported date ranges, permission errors and real rate limits.
- Audit keyboard and screen-reader behavior in the real embed; measure load time
  on representative networks and devices. Mobile overflow and basic keyboard
  checks here are not a complete accessibility audit.
- Complete production privacy/security and secret-lifecycle reviews.

These are release prerequisites, not failed local test cases. See
[release validation](../spec/release-validation.md) and
[scope checklist](../spec/checklist.md).
