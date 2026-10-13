from datetime import date
from unittest import TestCase
from unittest.mock import patch

from scripts.generate_weekly_status import (
    JiraAPIError,
    JiraClient,
    _is_blocked,
    _is_reportable_sprint_issue,
    _markdown_text,
    build_report,
    main,
)


class FakeJiraClient:
    board_id = "42"
    base_url = "https://example.atlassian.net"
    epic_link_field = "customfield_10014"

    def get_board(self):
        return {"name": "Engineering"}

    def list_sprints(self, state):
        if state == "closed":
            return [
                {
                    "id": 10,
                    "name": "Sprint 10",
                    "startDate": "2026-09-01T00:00:00.000Z",
                    "endDate": "2026-09-14T23:59:59.000Z",
                },
                {
                    "id": 11,
                    "name": "Sprint 11",
                    "startDate": "2026-09-15T00:00:00.000Z",
                    "endDate": "2026-09-28T23:59:59.000Z",
                },
            ]
        return [
            {
                "id": 12,
                "name": "Sprint 12",
                "startDate": "2026-09-29T00:00:00.000Z",
            }
        ]

    def list_sprint_issues(self, sprint_id):
        if sprint_id == 12:
            return [
                {
                    "key": "ENG-4",
                    "fields": {
                        "issuetype": {"name": "Story"},
                        "customfield_10014": "ENG-20",
                    },
                },
                {
                    "key": "ENG-20",
                    "fields": {
                        "summary": "Improve deployment readiness",
                        "issuetype": {"name": "Epic"},
                    },
                },
            ]
        return [
            {
                "key": "ENG-1",
                "fields": {
                    "summary": "Ship API | v2",
                    "status": {"name": "Done"},
                    "assignee": {"displayName": "Alex"},
                },
            },
            {
                "key": "ENG-2",
                "fields": {
                    "summary": "Review integration",
                    "status": {"name": "Code Review"},
                    "issuelinks": [
                        {
                            "type": {
                                "inward": "is blocked by",
                                "outward": "blocks",
                            },
                            "inwardIssue": {"key": "ENG-3"},
                        }
                    ],
                },
            },
            {
                "key": "ENG-3",
                "fields": {
                    "summary": "Test release",
                    "status": {"name": "Ready for Test"},
                    "flagged": [{"value": "Impediment"}],
                },
            },
            {
                "key": "ENG-5",
                "fields": {"summary": "Not included", "status": {"name": "To Do"}},
            },
        ]

    def get_issue_summary(self, issue_key):
        return {"ENG-20": "Improve deployment readiness"}[issue_key]


class GenerateWeeklyStatusTests(TestCase):
    def test_build_report_uses_latest_closed_sprint_and_next_sprint_epics(self):
        report = build_report(FakeJiraClient(), today=date(2026, 10, 7))

        self.assertIn("**Sprint:** Sprint 11", report)
        self.assertIn("## Completed Issues\n- [ENG-1]", report)
        self.assertIn("Ship API \\| v2", report)
        self.assertIn("## In-Progress Items\n- [ENG-2]", report)
        self.assertIn("## Blockers\n- [ENG-2]", report)
        self.assertIn("- [ENG-3]", report)
        self.assertIn("## Next Sprint Goals\n- [ENG-20]", report)
        self.assertNotIn("ENG-5", report)

    def test_issue_reporting_excludes_epics_and_subtasks(self):
        self.assertFalse(_is_reportable_sprint_issue({"fields": {"issuetype": {"name": "Epic"}}}))
        self.assertFalse(_is_reportable_sprint_issue({"fields": {"issuetype": {"name": "Sub-task"}}}))
        self.assertFalse(
            _is_reportable_sprint_issue({"fields": {"parent": {"key": "ENG-10"}}})
        )
        self.assertTrue(_is_reportable_sprint_issue({"fields": {"issuetype": {"name": "Story"}}}))

    def test_blocker_detection_handles_status_flag_and_blocked_link(self):
        self.assertTrue(
            _is_blocked({"fields": {"status": {"name": "Blocked"}}})
        )
        self.assertTrue(_is_blocked({"fields": {"flagged": [{"value": "Impediment"}]}}))
        self.assertTrue(
            _is_blocked(
                {
                    "fields": {
                        "issuelinks": [
                            {"type": {"inward": "is blocked by", "outward": "blocks"}}
                        ]
                    }
                }
            )
        )
        self.assertFalse(_is_blocked({"fields": {"status": {"name": "In Progress"}}}))

    def test_markdown_text_escapes_table_separator_and_collapses_newlines(self):
        self.assertEqual(_markdown_text("one | two\nthree"), "one \\| two three")

    def test_no_closed_sprint_is_an_explicit_error(self):
        client = FakeJiraClient()
        client.list_sprints = lambda state: []
        with self.assertRaisesRegex(JiraAPIError, "No closed sprint"):
            build_report(client)

    @patch.dict("os.environ", {}, clear=True)
    def test_main_fails_clearly_when_jira_configuration_is_missing(self):
        self.assertEqual(main([]), 1)


if __name__ == "__main__":
    import unittest

    unittest.main()
