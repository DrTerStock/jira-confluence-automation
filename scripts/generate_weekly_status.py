#!/usr/bin/env python3
"""Generate a Markdown status report from the most recently closed Jira sprint."""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo


COMPLETED_STATUSES = {"done", "closed"}
IN_PROGRESS_STATUSES = {
    "ready for development",
    "in progress",
    "code review",
    "ready for test",
    "in test",
    "ready for demo",
}
PAGE_SIZE = 100
TIMEOUT_SECONDS = 30


class JiraAPIError(RuntimeError):
    """Raised when Jira configuration or an API request is invalid."""


class JiraClient:
    def __init__(
        self,
        base_url: str,
        email: str,
        api_token: str,
        board_id: str,
        epic_link_field: str = "customfield_10014",
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.board_id = board_id
        self.epic_link_field = epic_link_field
        credentials = base64.b64encode(f"{email}:{api_token}".encode()).decode()
        self.headers = {
            "Accept": "application/json",
            "Authorization": f"Basic {credentials}",
        }

    def _get(self, path: str, params: dict[str, str] | None = None) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        if params:
            url = f"{url}?{urlencode(params)}"
        request = Request(url, headers=self.headers)
        try:
            with urlopen(request, timeout=TIMEOUT_SECONDS) as response:
                result = json.load(response)
        except HTTPError as exc:
            raise JiraAPIError(
                f"Jira returned HTTP {exc.code} for {path}. Check the Jira URL, "
                "credentials, board access, and API permissions."
            ) from exc
        except URLError as exc:
            raise JiraAPIError(f"Could not connect to Jira for {path}: {exc.reason}") from exc
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            raise JiraAPIError(f"Jira returned invalid JSON for {path}.") from exc

        if not isinstance(result, dict):
            raise JiraAPIError(f"Jira returned an unexpected response for {path}.")
        return result

    def get_board(self) -> dict[str, Any]:
        return self._get(f"/rest/agile/1.0/board/{self.board_id}")

    def list_sprints(self, state: str) -> list[dict[str, Any]]:
        start_at = 0
        sprints: list[dict[str, Any]] = []
        while True:
            page = self._get(
                f"/rest/agile/1.0/board/{self.board_id}/sprint",
                {"state": state, "startAt": str(start_at), "maxResults": str(PAGE_SIZE)},
            )
            values = page.get("values", [])
            if not isinstance(values, list):
                raise JiraAPIError("Jira returned an invalid sprint list.")
            sprints.extend(item for item in values if isinstance(item, dict))
            start_at += len(values)
            if not values or start_at >= page.get("total", len(sprints)):
                return sprints

    def list_sprint_issues(self, sprint_id: int) -> list[dict[str, Any]]:
        start_at = 0
        issues: list[dict[str, Any]] = []
        fields = [
            "summary",
            "status",
            "assignee",
            "issuelinks",
            "issuetype",
            "parent",
            "flagged",
            self.epic_link_field,
        ]
        while True:
            page = self._get(
                f"/rest/agile/1.0/sprint/{sprint_id}/issue",
                {
                    "startAt": str(start_at),
                    "maxResults": str(PAGE_SIZE),
                    "fields": ",".join(fields),
                },
            )
            values = page.get("issues", [])
            if not isinstance(values, list):
                raise JiraAPIError("Jira returned an invalid sprint issue list.")
            issues.extend(item for item in values if isinstance(item, dict))
            start_at += len(values)
            if not values or start_at >= page.get("total", len(issues)):
                return issues

    def get_issue_summary(self, issue_key: str) -> str:
        result = self._get(
            f"/rest/api/3/issue/{issue_key}",
            {"fields": "summary"},
        )
        fields = result.get("fields", {})
        return str(fields.get("summary") or issue_key)


def _status(issue: dict[str, Any]) -> str:
    fields = issue.get("fields", {})
    status = fields.get("status", {})
    if not isinstance(status, dict):
        return ""
    return str(status.get("name", "")).strip().casefold()


def _issue_key(issue: dict[str, Any]) -> str:
    return str(issue.get("key", "UNKNOWN"))


def _issue_fields(issue: dict[str, Any]) -> dict[str, Any]:
    fields = issue.get("fields", {})
    return fields if isinstance(fields, dict) else {}


def _issue_type_name(issue: dict[str, Any]) -> str:
    fields = _issue_fields(issue)
    issue_type = fields.get("issuetype", {})
    if isinstance(issue_type, dict):
        return str(issue_type.get("name", "")).strip().casefold()
    return ""


def _is_reportable_sprint_issue(issue: dict[str, Any]) -> bool:
    if _issue_type_name(issue) in {"epic", "sub-task", "subtask"}:
        return False
    fields = _issue_fields(issue)
    parent = fields.get("parent")
    if isinstance(parent, dict) and parent.get("key"):
        return False
    return True


def _is_blocked(issue: dict[str, Any]) -> bool:
    fields = _issue_fields(issue)
    if _status(issue) in {"blocked", "impeded"}:
        return True

    flagged = fields.get("flagged")
    if flagged not in (None, False, "", [], {}):
        return True

    links = fields.get("issuelinks", [])
    if not isinstance(links, list):
        return False
    for link in links:
        if not isinstance(link, dict):
            continue
        link_type = link.get("type", {})
        if not isinstance(link_type, dict):
            continue
        if "blocked by" in str(link_type.get("inward", "")).casefold():
            return True
        if "blocked by" in str(link_type.get("outward", "")).casefold():
            return True
    return False


def _markdown_text(value: Any) -> str:
    return " ".join(str(value or "").replace("|", "\\|").split())


def _issue_link(issue: dict[str, Any], base_url: str) -> str:
    key = _issue_key(issue)
    summary = _markdown_text(_issue_fields(issue).get("summary")) or "(no summary)"
    status = _markdown_text(_issue_fields(issue).get("status", {}).get("name", ""))
    assignee = _issue_fields(issue).get("assignee")
    owner = ""
    if isinstance(assignee, dict):
        owner = _markdown_text(assignee.get("displayName"))
    parts = [f"[{key}]({base_url.rstrip('/')}/browse/{key}) {summary}"]
    if status:
        parts.append(status)
    if owner:
        parts.append(owner)
    return " — ".join(parts)


def _epic_keys(issues: list[dict[str, Any]], epic_link_field: str) -> set[str]:
    keys: set[str] = set()
    for issue in issues:
        fields = _issue_fields(issue)
        issue_type = fields.get("issuetype", {})
        if isinstance(issue_type, dict) and str(issue_type.get("name", "")).casefold() == "epic":
            keys.add(_issue_key(issue))
        parent = fields.get("parent")
        if isinstance(parent, dict) and parent.get("key"):
            keys.add(str(parent["key"]))
        epic_link = fields.get(epic_link_field)
        if isinstance(epic_link, str) and epic_link.strip():
            keys.add(epic_link.strip())
        elif isinstance(epic_link, dict) and epic_link.get("key"):
            keys.add(str(epic_link["key"]))
    return keys


def build_report(client: JiraClient, today: date | None = None) -> str:
    board = client.get_board()
    board_name = _markdown_text(board.get("name")) or client.board_id
    closed_sprints = client.list_sprints("closed")
    if not closed_sprints:
        raise JiraAPIError("No closed sprint was found on the configured Jira board.")
    latest_sprint = max(
        closed_sprints,
        key=lambda sprint: str(sprint.get("endDate", "")),
    )
    sprint_id = latest_sprint.get("id")
    if sprint_id is None:
        raise JiraAPIError("The most recently closed sprint is missing its Jira ID.")

    issues = [
        issue
        for issue in client.list_sprint_issues(int(sprint_id))
        if _is_reportable_sprint_issue(issue)
    ]
    completed = [issue for issue in issues if _status(issue) in COMPLETED_STATUSES]
    in_progress = [issue for issue in issues if _status(issue) in IN_PROGRESS_STATUSES]
    blockers = [issue for issue in issues if _is_blocked(issue)]

    future_sprints = client.list_sprints("future")
    next_sprint = min(
        future_sprints,
        key=lambda sprint: str(sprint.get("startDate", "9999")),
        default=None,
    )
    goals: list[str] = []
    if next_sprint and next_sprint.get("id") is not None:
        next_issues = client.list_sprint_issues(int(next_sprint["id"]))
        epic_keys = _epic_keys(next_issues, client.epic_link_field)
        goals = [
            f"[{key}]({client.base_url}/browse/{key}) "
            f"{_markdown_text(client.get_issue_summary(key))}"
            for key in sorted(epic_keys)
        ]

    start_date = str(latest_sprint.get("startDate", ""))[:10] or "unknown"
    end_date = str(latest_sprint.get("endDate", ""))[:10] or "unknown"
    report_date = today or datetime.now(ZoneInfo("Europe/Warsaw")).date()
    lines = [
        "# Weekly Engineering Status Report",
        f"- **Jira board:** {board_name}",
        f"- **Sprint:** {_markdown_text(latest_sprint.get('name'))} "
        f"({start_date}–{end_date})",
        f"- **Generated:** {report_date.isoformat()}",
        "",
        "## Completed Issues",
    ]
    lines.extend(f"- {_issue_link(issue, client.base_url)}" for issue in completed)
    if not completed:
        lines.append("- None")
    lines.extend(["", "## In-Progress Items"])
    lines.extend(f"- {_issue_link(issue, client.base_url)}" for issue in in_progress)
    if not in_progress:
        lines.append("- None")
    lines.extend(["", "## Blockers"])
    lines.extend(f"- {_issue_link(issue, client.base_url)}" for issue in blockers)
    if not blockers:
        lines.append("- None")
    lines.extend(["", "## Next Sprint Goals"])
    if next_sprint is None:
        lines.append("- No upcoming sprint is configured on this Jira board.")
    elif goals:
        lines.extend(f"- {goal}" for goal in goals)
    else:
        lines.append(
            f"- No Epic-linked issues found in "
            f"{_markdown_text(next_sprint.get('name')) or 'the upcoming sprint'}."
        )
    return "\n".join(lines) + "\n"


def _required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise JiraAPIError(
            f"Required environment variable {name} is not set. "
            "Configure the Jira board and credentials before running the report."
        )
    return value


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "STATUS_REPORT_TEMPLATE.md",
        help="Markdown file to replace (default: STATUS_REPORT_TEMPLATE.md in repository root).",
    )
    args = parser.parse_args(argv)
    try:
        base_url = _required_environment("JIRA_BASE_URL").rstrip("/")
        client = JiraClient(
            base_url=base_url,
            email=_required_environment("JIRA_EMAIL"),
            api_token=_required_environment("JIRA_API_TOKEN"),
            board_id=_required_environment("JIRA_BOARD_ID"),
            epic_link_field=os.environ.get(
                "JIRA_EPIC_LINK_FIELD", "customfield_10014"
            ).strip()
            or "customfield_10014",
        )
        report = build_report(client)
        args.output.write_text(report, encoding="utf-8")
    except (JiraAPIError, OSError, ValueError) as exc:
        print(f"Weekly status report failed: {exc}", file=sys.stderr)
        return 1
    print(f"Wrote weekly status report to {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
