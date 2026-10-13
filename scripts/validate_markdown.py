#!/usr/bin/env python3
"""Check repository Markdown files for consistent source formatting."""

from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path


EXCLUDED_DIRECTORIES = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "__pycache__",
    "build",
    "dist",
}
DEFAULT_REPORT = Path("reports/markdown-validation.md")


@dataclass(frozen=True)
class Finding:
    rule: str
    line: int | None
    message: str


@dataclass(frozen=True)
class FileResult:
    path: Path
    findings: tuple[Finding, ...]


def validate_content(content: bytes) -> tuple[Finding, ...]:
    findings: list[Finding] = []
    if content.startswith(b"\xef\xbb\xbf"):
        findings.append(Finding("encoding", 1, "Remove the UTF-8 byte-order mark."))

    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError as exc:
        findings.append(
            Finding(
                "encoding",
                content[: exc.start].count(b"\n") + 1,
                "File is not valid UTF-8.",
            )
        )
        return tuple(findings)

    lines = text.splitlines(keepends=True)
    for line_number, line in enumerate(lines, start=1):
        if "\r" in line:
            findings.append(
                Finding("line-endings", line_number, "Use LF line endings.")
            )
        line_content = line.rstrip("\r\n")
        if line_content.endswith((" ", "\t")):
            findings.append(
                Finding("trailing-whitespace", line_number, "Remove trailing whitespace.")
            )

    if content and not content.endswith(b"\n"):
        findings.append(
            Finding("final-newline", len(lines), "Add a final newline.")
        )

    return tuple(findings)


def collect_markdown_files(root: Path, report_path: Path) -> list[Path]:
    report = report_path.resolve()
    files = []
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() != ".md":
            continue
        if any(part in EXCLUDED_DIRECTORIES for part in path.relative_to(root).parts):
            continue
        if path.resolve() == report:
            continue
        files.append(path)
    return sorted(files, key=lambda path: path.relative_to(root).as_posix().casefold())


def validate_files(root: Path, report_path: Path) -> list[FileResult]:
    return [
        FileResult(path, validate_content(path.read_bytes()))
        for path in collect_markdown_files(root, report_path)
    ]


def render_report(results: list[FileResult], root: Path) -> str:
    files_with_findings = sum(bool(result.findings) for result in results)
    finding_count = sum(len(result.findings) for result in results)
    lines = [
        "# Markdown Validation Results",
        "",
        f"- Files scanned: {len(results)}",
        f"- Files passing: {len(results) - files_with_findings}",
        f"- Files needing attention: {files_with_findings}",
        f"- Total findings: {finding_count}",
        "",
        "| File | Status | Findings |",
        "| --- | --- | --- |",
    ]
    for result in results:
        relative_path = result.path.relative_to(root).as_posix()
        if result.findings:
            details = "<br>".join(
                f"Line {finding.line}: {finding.rule} - {finding.message}"
                if finding.line is not None
                else f"{finding.rule} - {finding.message}"
                for finding in result.findings
            )
            status = "Needs attention"
        else:
            details = "None"
            status = "Pass"
        lines.append(f"| `{relative_path}` | {status} | {details} |")
    lines.append("")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--root",
        type=Path,
        default=Path(__file__).resolve().parents[1],
        help="Project root to scan (default: this script's project root).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Report path (default: <project root>/reports/markdown-validation.md).",
    )
    args = parser.parse_args(argv)

    root = args.root.resolve()
    report_path = args.output or root / DEFAULT_REPORT
    if not report_path.is_absolute():
        report_path = root / report_path

    try:
        results = validate_files(root, report_path)
        report = render_report(results, root)
        report_path.parent.mkdir(parents=True, exist_ok=True)
        with report_path.open("w", encoding="utf-8", newline="\n") as output_file:
            output_file.write(report)
    except OSError as exc:
        print(f"Markdown validation failed: {exc}", file=sys.stderr)
        return 2

    print(
        f"Scanned {len(results)} Markdown files; "
        f"{sum(bool(result.findings) for result in results)} need attention. "
        f"Report: {report_path}"
    )
    return int(any(result.findings for result in results))


if __name__ == "__main__":
    raise SystemExit(main())
