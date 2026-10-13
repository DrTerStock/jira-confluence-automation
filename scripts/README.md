# Weekly Jira status report automation

The GitHub Actions workflow generates `STATUS_REPORT_TEMPLATE.md` from the
most recently closed sprint on a Jira board, then commits the updated report.
It is scheduled for Wednesday at 12:00 a.m. Europe/Warsaw time and can also be
run with **Actions → Weekly Jira status report → Run workflow**.

## Configure GitHub

Add these repository secrets:

- `JIRA_BASE_URL`: Jira Cloud site URL, such as `https://example.atlassian.net`
- `JIRA_EMAIL`: email address associated with the Jira API token
- `JIRA_API_TOKEN`: Jira API token with permission to view the board and issues

Add these repository variables:

- `JIRA_BOARD_ID`: numeric ID of the Jira Scrum board
- `JIRA_EPIC_LINK_FIELD` (optional): this Jira site's Epic Link field ID;
  defaults to `customfield_10014`

The board ID has intentionally not been filled in. Until the required secrets
and `JIRA_BOARD_ID` variable are configured, generation fails with an explicit
configuration error and leaves the existing report unchanged.

The workflow runs at 22:00 and 23:00 UTC on Tuesdays and checks the local Warsaw
time, so only the invocation that falls at Wednesday midnight proceeds during
both standard and daylight-saving time.

## Report contents

- Completed issues: `Done` and `Closed`
- In-progress items: `Ready for Development`, `In Progress`, `Code Review`,
  `Ready for Test`, `In Test`, and `Ready for Demo`
- Blockers: issues in `Blocked`/`Impeded`, flagged issues, or issues with a
  Jira issue link whose relation says “blocked by”
- Next sprint goals: distinct epics linked to issues in the nearest future
  sprint

Set `JIRA_EPIC_LINK_FIELD` if the site's Epic Link field is not
`customfield_10014`. Jira team-managed projects can expose epic relationships
through the issue `parent` field, which the generator also reads.

The GitHub Actions `GITHUB_TOKEN` needs repository contents write permission
for the workflow to commit the generated report.

## Run locally

Set `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_BOARD_ID`, then run:

```sh
python3 scripts/generate_weekly_status.py
```

Use `--output /path/to/report.md` to choose a different output file.

Run the tests with:

```sh
python3 -m unittest discover -s tests
```
