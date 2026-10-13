from unittest import TestCase

from tools.aggregate_ai_usage import aggregate_usage
from tools.calculate_sprint_progress import summarize_sprint_progress


class SprintProgressTests(TestCase):
    def test_counts_issues_and_tracks_estimate_coverage(self):
        result = summarize_sprint_progress(
            [
                {
                    "key": "ENG-1",
                    "status": "Done",
                    "issue_type": "Story",
                    "estimate": "5.5",
                },
                {
                    "key": "ENG-2",
                    "status": "In Progress",
                    "issue_type": "Task",
                    "estimate": "3",
                },
                {
                    "key": "ENG-3",
                    "status": "Closed",
                    "issue_type": "Bug",
                    "estimate": "",
                },
                {
                    "key": "ENG-4",
                    "status": "To Do",
                    "issue_type": "Epic",
                    "estimate": "8",
                },
                {
                    "key": "ENG-5",
                    "status": "To Do",
                    "issue_type": "Sub-task",
                    "estimate": "2",
                },
            ],
            completed_statuses={"Done", "Closed"},
            estimate_column="estimate",
            estimate_unit="story points",
        )

        self.assertEqual(
            result["counts"],
            {"completed": 2, "remaining": 1, "included_total": 3, "excluded": 2},
        )
        self.assertEqual(
            result["estimates"],
            {
                "unit": "story points",
                "completed": {
                    "known_total": "5.5",
                    "estimated_issues": 1,
                    "unestimated_issues": 1,
                },
                "remaining": {
                    "known_total": "3",
                    "estimated_issues": 1,
                    "unestimated_issues": 0,
                },
            },
        )

    def test_rejects_duplicate_issue_keys(self):
        rows = [
            {"key": "ENG-1", "status": "Done", "issue_type": "Story"},
            {"key": "eng-1", "status": "To Do", "issue_type": "Story"},
        ]
        with self.assertRaisesRegex(ValueError, "duplicate issue key"):
            summarize_sprint_progress(rows, completed_statuses={"Done"})

    def test_rejects_estimate_without_a_unit(self):
        with self.assertRaisesRegex(ValueError, "--estimate-column and --estimate-unit"):
            summarize_sprint_progress(
                [], completed_statuses={"Done"}, estimate_column="points"
            )

    def test_all_missing_estimates_do_not_look_like_zero(self):
        result = summarize_sprint_progress(
            [{"key": "ENG-1", "status": "Done", "issue_type": "Story", "points": ""}],
            completed_statuses={"Done"},
            estimate_column="points",
            estimate_unit="story points",
        )

        self.assertIsNone(result["estimates"]["completed"]["known_total"])
        self.assertEqual(result["estimates"]["completed"]["unestimated_issues"], 1)


class AiUsageAggregationTests(TestCase):
    def test_aggregates_only_identical_metric_dimensions(self):
        common = {
            "source": "OpenAI",
            "metric": "cost",
            "metric_kind": "reported",
            "unit": "currency",
            "currency": "USD",
            "period_start": "2026-10-01",
            "period_end": "2026-10-07",
        }
        rows = [
            {**common, "amount": "0.10"},
            {**common, "amount": "0.20"},
            {**common, "currency": "EUR", "amount": "5"},
            {**common, "metric_kind": "estimated", "amount": "9"},
            {**common, "period_end": "2026-10-08", "amount": "2"},
        ]

        result = aggregate_usage(rows)

        self.assertEqual(result["input_rows"], 5)
        self.assertEqual(len(result["groups"]), 4)
        usd_reported = next(
            group
            for group in result["groups"]
            if group["currency"] == "USD" and group["metric_kind"] == "reported"
            and group["period_end"] == "2026-10-07"
        )
        self.assertEqual(usd_reported["amount"], "0.30")
        self.assertEqual(usd_reported["rows"], 2)

    def test_rejects_invalid_amount(self):
        row = {
            "source": "OpenAI",
            "metric": "cost",
            "metric_kind": "reported",
            "unit": "currency",
            "currency": "USD",
            "period_start": "2026-10-01",
            "period_end": "2026-10-07",
            "amount": "not-a-number",
        }
        with self.assertRaisesRegex(ValueError, "invalid amount"):
            aggregate_usage([row])


if __name__ == "__main__":
    import unittest

    unittest.main()
