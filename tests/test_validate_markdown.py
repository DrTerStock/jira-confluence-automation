from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from scripts.validate_markdown import (
    collect_markdown_files,
    render_report,
    validate_content,
    validate_files,
)


class ValidateMarkdownTests(TestCase):
    def test_clean_markdown_passes(self):
        self.assertEqual(validate_content(b"# Title\n\nClean.\n"), ())

    def test_reports_bom_crlf_and_trailing_whitespace(self):
        findings = validate_content(b"\xef\xbb\xbf# Title  \r\n")

        self.assertEqual(
            [(finding.rule, finding.line) for finding in findings],
            [
                ("encoding", 1),
                ("line-endings", 1),
                ("trailing-whitespace", 1),
            ],
        )

    def test_reports_invalid_utf8_and_missing_final_newline(self):
        findings = validate_content(b"# Title\n\xff")

        self.assertEqual(
            [(finding.rule, finding.line) for finding in findings],
            [("encoding", 2)],
        )
        self.assertEqual(
            [(finding.rule, finding.line) for finding in validate_content(b"# Title")],
            [("final-newline", 1)],
        )

    def test_collects_markdown_and_excludes_report_and_generated_directories(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "guide.md").write_text("# Guide\n", encoding="utf-8")
            (root / ".github").mkdir()
            (root / ".github" / "rules.md").write_text("# Rules\n", encoding="utf-8")
            (root / ".git").mkdir()
            (root / ".git" / "ignored.md").write_text("# Ignored\n", encoding="utf-8")
            report = root / "reports" / "markdown-validation.md"
            report.parent.mkdir()
            report.write_text("# Previous report\n", encoding="utf-8")

            files = collect_markdown_files(root, report)
            results = validate_files(root, report)
            rendered = render_report(results, root)

            self.assertEqual(
                [path.relative_to(root).as_posix() for path in files],
                [".github/rules.md", "guide.md"],
            )
            self.assertIn("Files scanned: 2", rendered)
            self.assertIn("`.github/rules.md`", rendered)
            self.assertNotIn("markdown-validation.md", rendered)
