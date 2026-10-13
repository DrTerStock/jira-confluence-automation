import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  applyDashboardRefresh,
  createDashboardRefreshState,
  dashboardStatus,
  markDashboardStale,
} from "../../frontend/src/api/dashboardRefresh";
import App from "../../frontend/src/App";
import type { SprintReport, UsageReport } from "../../shared/types/dashboard";

const period = { from: "2026-10-01", to: "2026-10-02" };
const report: UsageReport = {
  requestedPeriod: period,
  compatibleTotals: [],
  sources: [
    {
      id: "openai",
      status: "success",
      actualPeriod: period,
      requestedPeriod: period,
      lastSuccessfulAt: "2026-10-03T12:00:00Z",
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
};

describe("checklist state fixes", () => {
  it("marks blocker counts partial when Jira issue coverage is incomplete", () => {
    const sprintReport: SprintReport = {
      sprint: { id: "34", name: "Current", state: "active" },
      progress: {
        issueCount: { completed: 0, remaining: 1, unclassified: 0, total: 1 },
      },
      blockers: { status: "success", count: 1, issues: [] },
      issues: [],
      groups: [],
      coverage: {
        fetchedIssueCount: 1,
        includedIssueCount: 1,
        reportedIssueCount: 2,
        complete: false,
      },
      source: {
        id: "jira",
        status: "partial",
        retrievedAt: new Date().toISOString(),
        completeness: "partial",
      },
    };
    const markup = renderToStaticMarkup(createElement(App, { sprintReport }));
    expect(markup).toContain(
      "blocked issues in fetched data; Jira issue coverage is incomplete",
    );
    expect(markup.match(/Partial data/g)?.length).toBeGreaterThanOrEqual(3);
  });
  it("keeps original successful source timestamps rather than client refresh time", () => {
    const state = applyDashboardRefresh(createDashboardRefreshState(), {
      usageReport: report,
      failures: [],
    });
    expect(state.lastSuccessfulAtBySource.provider_usage).toBe(
      "2026-10-03T12:00:00Z",
    );
  });
  it("reports partial at the dashboard level while retaining a successful zero", () => {
    const partial: UsageReport = {
      ...report,
      sources: [
        ...report.sources,
        {
          id: "anthropic",
          status: "failed",
          requestedPeriod: period,
          metrics: [],
          unsupportedMetrics: [],
          error: {
            code: "provider_failed",
            message: "Provider failed safely",
            retryable: true,
          },
        },
      ],
    };
    expect(
      dashboardStatus(createDashboardRefreshState(undefined, partial)),
    ).toBe("partial");
    const markup = renderToStaticMarkup(
      createElement(App, { usageReport: partial }),
    );
    expect(markup).toContain("Partial data");
    expect(markup).toContain("0 tokens");
    expect(markup).toContain("Provider failed safely");
  });
  it("ages data without fetching or replacing source timestamps", () => {
    const state = markDashboardStale(
      createDashboardRefreshState(undefined, report),
      Date.parse("2026-10-03T18:00:00Z"),
    );
    expect(state.usageReport?.sources[0].status).toBe("stale");
    expect(state.usageReport?.sources[0].lastSuccessfulAt).toBe(
      "2026-10-03T12:00:00Z",
    );
    expect(dashboardStatus(state)).toBe("stale");
  });
  it("clears retained protected data when authorization is denied", () => {
    const state = applyDashboardRefresh(
      createDashboardRefreshState(undefined, report),
      {
        failures: [
          {
            source: "provider_usage",
            status: 403,
            message: "Permission denied",
          },
        ],
      },
    );
    expect(state.usageReport).toBeUndefined();
    expect(dashboardStatus(state)).toBe("permission_denied");
  });
});
