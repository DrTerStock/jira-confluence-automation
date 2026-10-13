# Local prototype walkthrough — 2026-10-13

Open <http://127.0.0.1:5174> after `docker compose up -d postgres` and
`npm run dev:demo`. The demo starts its own backend on port 4100 and frontend
on port 5174. The normal backend/frontend also run on ports 3000/5173; without
an authenticated host module, the normal dashboard correctly denies access.

The yellow toolbar is a development fixture control. Jira, AI reporting and
viewer context are synthetic; widget configuration and dated count history
persist in real local PostgreSQL. No real upstream credentials are required.
Role/widget changes require **Apply context / reload**. Scenario changes take
effect on the next dashboard refresh. Stop/restart the demo to reset its isolated
tenant, including the initially unconfigured widget.

## Screen-by-screen user flow

| Step | Action and observed behavior | Specification match and screenshot |
| --- | --- | --- |
| 1. Access | Open normal port 5173 without host integration: “Sign in to access this dashboard” and “Permission denied”; no report data appears. | FR-006/022; [unverified access](../reports/walkthrough/01-unverified-access.png). |
| 2. New widget | In the demo choose `admin`, `new-widget`, `success`, then apply/reload. The page prompts an editor to configure; burndown history is unavailable. | Scenario 1, FR-002/011; [unconfigured widget](../reports/walkthrough/02-unconfigured.png). |
| 3. Configure | Click **Configure dashboard**. Select **Prototype team** (board 12); enable OpenAI, Anthropic and GitHub Copilot; enter `Blocked` as the explicit blocked status. Optionally enable story points with `customfield_10001`. Save. The form contains no credential fields. | FR-002/003/010/018; [editor form](../reports/walkthrough/03-editor-configuration.png). |
| 4. Current sprint | The active sprint, dates and board are identified. Of five fetched issues, three stories/tasks/bugs are in scope; one is done, two remain and one is blocked. Epic/sub-task records are excluded. Two of three issues are estimated, so the panel reports coverage instead of an invented full estimate. Status/type groups and Jira links appear. | FR-007/008/009/010; [configured dashboard](../reports/walkthrough/04-configured-dashboard.png). |
| 5. History | Initial loading creates no burndown observations. Click **Refresh dashboard**: a complete viewer-authorized count is saved with a timestamp and provenance. The chart and equivalent table display collected points only. Repeated refreshes can add observations. | FR-011/019/021; [manual observation](../reports/walkthrough/05-manual-history.png). |
| 6. Historical sprint | Select **Previous sprint (closed)**. The name/state and dates change, and history remains unavailable until this viewer manually collects that sprint's counts. Select the active sprint again to return. | FR-007; [historical sprint](../reports/walkthrough/06-historical-sprint.png). |
| 7. AI period and sources | Change **Usage reporting period**, then toggle a source under **Displayed AI sources**. Only selected configured sources appear. OpenAI's synthetic output value is **0 tokens**, a valid reported zero; compatible OpenAI/Anthropic output tokens total 42. Other metric definitions remain separate. Original source fields, units, periods and retrieval times are visible. | FR-012/013/014; [usage panels](../reports/walkthrough/04-configured-dashboard.png). |
| 8. Provider failure | Choose `partial` and refresh after success: OpenAI remains available; retained Anthropic values show stale warnings and a safe error. Reload in `partial` to check prominent overall partial status. | FR-004/005/019, SC-009; [retained failure](../reports/walkthrough/07-retained-provider-failure.png), [partial report](../reports/walkthrough/08-partial-report.png). |
| 9. Jira failure | Choose `jira-denied` and refresh: permission denial clears protected retained Jira issues. Return to success, refresh, then choose `jira-rate`: stale prior data remains with **Retry after 10 seconds**. | FR-004/006/019/022; [Jira denial](../reports/walkthrough/09-jira-denied.png), [rate limit](../reports/walkthrough/10-jira-rate-limit.png). |
| 10. Empty and old data | Choose `empty` and refresh: successful empty reports say **No data**, explicitly distinct from zero. Choose `stale` and refresh: already old source timestamps immediately produce stale labels. | FR-014/019/022; [empty usage](../reports/walkthrough/11-empty-usage.png), [old data](../reports/walkthrough/15-clock-stale.png). |
| 11. Viewer/editor/admin | Choose `viewer` and apply: no configuration or admin readiness controls; the API also rejects configuration writes with 403. An `editor` can configure/cancel, without the admin-only readiness panel. An `admin` sees safe readiness metadata and no secret values. | FR-002/006/018; [viewer](../reports/walkthrough/12-viewer.png), [administrator](../reports/walkthrough/04-configured-dashboard.png). |
| 12. Independent widgets and page denial | Choose `widget-2`: board 13 and only OpenAI appear. Choose role `denied`: page permission error appears without report data. | FR-003/006/021; [second widget](../reports/walkthrough/13-second-widget.png), [page denial](../reports/walkthrough/14-page-denied.png). |
| 13. Responsive and keyboard use | At 390px width panels stack without horizontal overflow. Native controls can receive focus; Enter opens/cancels configuration and refreshes; Space toggles a provider checkbox. Chart information has a table equivalent. | Accessibility/responsiveness requirements; [mobile](../reports/walkthrough/16-mobile.png). |
| 14. Bounded larger report | Choose `scale` and reload: five Jira pages provide 500 in-scope issues, with all three sources rendered. The local synthetic load became usable in **63 ms**, below the three-second target. | Performance MVP target; [500-issue fixture](../reports/walkthrough/15-scale-500.png). |

Jira links deliberately point to `jira.example.invalid`; they establish link
construction and will not open a real issue. Provider figures are fixture
values. Changing displayed provider checkboxes affects this view; persisted
provider enablement is edited in configuration. Initial loads may reuse scoped
provider cache; manual refresh bypasses it. Individual attribution, cost
estimates and scheduled source refresh are existing MVP exclusions.

## Recorded verification and limits

`npm run test:walkthrough` passed **21 checks**, with no uncaught JavaScript
errors, in installed Google Chrome using the repository's Playwright runner.
See [machine-readable results](../reports/walkthrough/results.json) and
[the runner](../scripts/demo/walkthrough.js). Desktop viewport was 1440×1000;
mobile viewport was 390×844. The load timing is one local fixture measurement,
with synthetic in-process upstream responses, not a live-network benchmark.

To reproduce, start the normal backend/frontend, freshly restart the demo so
`new-widget` is unconfigured, and run `npm run test:walkthrough`. Set
`CHROME_PATH` if installed Chrome is outside the runner's default path. Avoid
concurrent walkthroughs against the same demo instance. Stop the demo with
Ctrl+C to delete its own synthetic tenant; no other tenant is deleted.

Each checked screen matches the agreed local prototype scope. Friendly board
names and duplicate read-only usage date controls remain optional polish
N1/N2 in [checklist.md](./checklist.md). Confluence hosting/session verification,
real organization access, screen-reader auditing, live network performance and
production review remain P1–P4. Using mocks completes this requested local
walkthrough and establishes no live account or production readiness claim.
