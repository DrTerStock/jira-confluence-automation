import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import App from "../../frontend/src/App";
import { BlockerPanel } from "../../frontend/src/components/BlockerPanel";
import { BurndownChart } from "../../frontend/src/components/BurndownChart";
import { ProviderReadinessPanel } from "../../frontend/src/components/ProviderReadinessPanel";
import { SourceStatus } from "../../frontend/src/components/SourceStatus";
import { SprintPanel } from "../../frontend/src/components/SprintPanel";
import type {
  ProviderReadiness,
  SprintReport,
  UsageReport,
} from "../../shared/types/dashboard";

describe("dashboard shell", () => {
  it("renders the initial dashboard heading", () => {
    const markup = renderToStaticMarkup(createElement(App));

    expect(markup).toContain("<h1>Jira Sprint Dashboard</h1>");
    expect(markup).toContain('aria-labelledby="sprint-summary-title"');
    expect(markup).toContain('aria-labelledby="blockers-title"');
    expect(markup).toContain('aria-labelledby="burndown-title"');
    expect(markup).toContain('aria-labelledby="usage-title"');
    expect(markup).toContain("Burndown history unavailable");
    expect(markup).toContain("No reporting providers are configured");
  });

  it("enables manual refresh only when a dashboard scope is available", () => {
    const markup = renderToStaticMarkup(
      createElement(App, {
        refreshScope: {
          widgetId: "widget-1",
          boardId: "12",
          sprintId: "34",
          usagePeriod: { from: "2026-10-12", to: "2026-10-12" },
        },
      }),
    );

    expect(markup).toContain(
      '<button aria-busy="false" class="refresh-button" type="button">Refresh dashboard</button>',
    );
  });

  it("passes retained usage metrics to the AI usage panel", () => {
    const usageReport: UsageReport = {
      requestedPeriod: { from: "2026-10-12", to: "2026-10-12" },
      sources: [
        {
          id: "openai",
          status: "success",
          requestedPeriod: { from: "2026-10-12", to: "2026-10-12" },
          actualPeriod: { from: "2026-10-12", to: "2026-10-12" },
          metrics: [
            {
              name: "output_tokens",
              value: "0",
              unit: "tokens",
              currency: null,
              kind: "reported",
            },
          ],
          unsupportedMetrics: [],
        },
      ],
      compatibleTotals: [],
    };
    const markup = renderToStaticMarkup(createElement(App, { usageReport }));

    expect(markup).toContain("Output tokens");
    expect(markup).toContain("0 tokens");
  });

  it("renders explicit text for every source state without relying on color", () => {
    const states = [
      ["success", "Available"],
      ["loading", "Loading"],
      ["empty", "No data"],
      ["partial", "Partial data"],
      ["stale", "Stale data"],
      ["unavailable", "Unavailable"],
      ["permission_denied", "Permission denied"],
      ["rate_limited", "Rate limited"],
      ["failed", "Failed"],
    ] as const;

    for (const [status, label] of states) {
      const markup = renderToStaticMarkup(
        createElement(SourceStatus, { status, message: "State detail." }),
      );
      expect(markup).toContain(`<strong>${label}.</strong>`);
      expect(markup).toContain("State detail.");
    }
  });

  it("renders sprint details, progress, issues, and unestimated points without zero substitution", () => {
    const report: SprintReport = {
      sprint: {
        id: "12",
        name: "Sprint 12",
        state: "active",
        startDate: "2026-10-01T00:00:00.000Z",
        endDate: "2026-10-15T00:00:00.000Z",
      },
      progress: {
        issueCount: {
          completed: 1,
          remaining: 2,
          unclassified: 1,
          total: 4,
        },
        estimate: {
          unit: "story_points",
          completed: 5,
          remaining: null,
          unclassified: null,
          estimatedIssueCount: 1,
          totalIssueCount: 4,
          status: "partial",
        },
      },
      blockers: {
        status: "success",
        count: 1,
        issues: [
          {
            id: "2",
            key: "PROJ-2",
            summary: "Blocked work",
            issueType: "Task",
            status: "Blocked",
            assignee: "Alex",
            browseUrl: "https://jira.example.com/browse/PROJ-2",
          },
        ],
      },
      issues: [
        {
          id: "1",
          key: "PROJ-1",
          summary: "Report sprint progress",
          issueType: "Story",
          status: "Done",
          browseUrl: "https://jira.example.com/browse/PROJ-1",
        },
      ],
      groups: [],
      coverage: {
        fetchedIssueCount: 4,
        includedIssueCount: 4,
        reportedIssueCount: 4,
        complete: true,
      },
      source: {
        id: "jira",
        status: "success",
        retrievedAt: "2026-10-02T12:00:00.000Z",
        completeness: "complete",
      },
    };

    const markup = renderToStaticMarkup(createElement(SprintPanel, { report }));

    expect(markup).toContain("Sprint 12");
    expect(markup).toContain("Completed issues</dt><dd>1</dd>");
    expect(markup).toContain("Remaining issues</dt><dd>2</dd>");
    expect(markup).toContain("1 of 4 issues estimated");
    expect(markup).toContain("PROJ-1: Report sprint progress");
    expect(markup).not.toContain("remaining: 0");
  });

  it("shows blocker metadata only when blocker status data is available", () => {
    const markup = renderToStaticMarkup(
      createElement(BlockerPanel, {
        blockers: {
          status: "success",
          count: 1,
          issues: [
            {
              id: "2",
              key: "PROJ-2",
              summary: "Blocked work",
              issueType: "Task",
              status: "Blocked",
              assignee: "Alex",
              browseUrl: "https://jira.example.com/browse/PROJ-2",
            },
          ],
        },
      }),
    );
    const unavailableMarkup = renderToStaticMarkup(createElement(BlockerPanel));

    expect(markup).toContain("Blocked issues</dt><dd>1</dd>");
    expect(markup).toContain("PROJ-2: Blocked work");
    expect(markup).toContain("Status: Blocked");
    expect(markup).toContain("Assignee: Alex");
    expect(markup).toContain('href="https://jira.example.com/browse/PROJ-2"');
    expect(unavailableMarkup).toContain("Blocked count is unavailable");
    expect(unavailableMarkup).not.toContain("<dd>0</dd>");
  });

  it("passes sprint report data through to the dashboard panels", () => {
    const sprintReport: SprintReport = {
      sprint: { id: "12", name: "Sprint 12", state: "active" },
      progress: {
        issueCount: {
          completed: 0,
          remaining: 1,
          unclassified: 0,
          total: 1,
        },
      },
      blockers: { status: "success", count: 1, issues: [] },
      issues: [],
      groups: [],
      coverage: {
        fetchedIssueCount: 1,
        includedIssueCount: 1,
        reportedIssueCount: 1,
        complete: true,
      },
      source: {
        id: "jira",
        status: "success",
        retrievedAt: "2026-10-02T12:00:00.000Z",
        completeness: "complete",
      },
    };

    const markup = renderToStaticMarkup(createElement(App, { sprintReport }));

    expect(markup).toContain("Sprint 12");
    expect(markup).toContain("Blocked issues</dt><dd>1</dd>");
    expect(markup).toContain("Remaining issues</dt><dd>1</dd>");
    expect(markup).toContain("Burndown history unavailable");
  });

  it("plots only dated observations and labels source and coverage", () => {
    const markup = renderToStaticMarkup(
      createElement(BurndownChart, {
        history: {
          source: "manual_snapshot",
          unit: "issues",
          provenance: "Snapshots collected on manual refresh",
          observations: [
            { observedAt: "2026-10-03T12:00:00.000Z", remaining: 2 },
            { observedAt: "not-a-timestamp", remaining: 4 },
            { observedAt: "2026-02-30T12:00:00.000Z", remaining: 3 },
            { observedAt: "2026-10-01T12:00:00.000Z", remaining: 5 },
          ],
        },
      }),
    );

    expect(markup).toContain("<polyline");
    expect(markup).toContain("Manual refresh snapshot");
    expect(markup).toContain("2026-10-01 – 2026-10-03");
    expect(markup).toContain("Snapshots collected on manual refresh");
    expect(markup).toContain("2 valid observations shown");
    expect(markup).not.toContain("not-a-timestamp");
    expect(markup).toContain("2026-10-01");
    expect(markup).toContain("2026-10-03");
  });

  it("keeps burndown unavailable if all observations or provenance are invalid", () => {
    const markup = renderToStaticMarkup(
      createElement(BurndownChart, {
        history: {
          source: "jira",
          unit: "issues",
          provenance: " ",
          observations: [{ observedAt: "2026-10-03", remaining: -1 }],
        },
      }),
    );

    expect(markup).toContain("Burndown history unavailable");
    expect(markup).not.toContain("<svg");
  });

  it("shows safe provider readiness statuses without secret-entry fields", () => {
    const sources: ProviderReadiness[] = [
      {
        providerId: "github_copilot",
        status: "configured",
        diagnosticCode: "credentials_present_unverified",
        checkedAt: "2026-10-13T12:00:00.000Z",
      },
      {
        providerId: "openai",
        status: "missing_credentials",
        diagnosticCode: "credentials_not_configured",
        checkedAt: "2026-10-13T12:00:00.000Z",
      },
      {
        providerId: "anthropic",
        status: "permission_denied",
        diagnosticCode: "insufficient_permissions",
        checkedAt: "2026-10-13T12:00:00.000Z",
      },
    ];
    const markup = renderToStaticMarkup(
      createElement(ProviderReadinessPanel, { sources }),
    );

    expect(markup).toContain("Provider readiness");
    expect(markup).toContain(
      "Credentials configured; provider access not verified",
    );
    expect(markup).toContain("Credentials missing");
    expect(markup).toContain("Permission denied");
    expect(markup).not.toContain("<input");
    expect(markup).not.toContain("OPENAI_ADMIN_API_KEY");

    for (const [status, diagnosticCode, label] of [
      ["ready", "provider_access_verified", "Provider access verified"],
      [
        "unsupported_coverage",
        "unsupported_reporting_coverage",
        "Unsupported reporting coverage",
      ],
      [
        "transient_failure",
        "provider_temporarily_unavailable",
        "Temporarily unavailable",
      ],
    ] as const) {
      const statusMarkup = renderToStaticMarkup(
        createElement(ProviderReadinessPanel, {
          sources: [
            {
              providerId: "openai",
              status,
              diagnosticCode,
              checkedAt: "2026-10-13T12:00:00.000Z",
            },
          ],
        }),
      );
      expect(statusMarkup).toContain(label);
    }
  });

  it("renders provider readiness only for administrator views", () => {
    const providerReadiness: ProviderReadiness[] = [];
    const viewerMarkup = renderToStaticMarkup(
      createElement(App, { providerReadiness }),
    );
    const administratorMarkup = renderToStaticMarkup(
      createElement(App, { isAdmin: true, providerReadiness }),
    );

    expect(viewerMarkup).not.toContain("Provider readiness");
    expect(administratorMarkup).toContain("Provider readiness");
  });
});
