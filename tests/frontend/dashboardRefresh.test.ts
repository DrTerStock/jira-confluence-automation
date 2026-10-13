import { describe, expect, it, vi } from "vitest";
import {
  applyDashboardRefresh,
  createDashboardRefreshState,
  refreshDashboard,
} from "../../frontend/src/api/dashboardRefresh";
import type {
  ProviderUsageSource,
  UsageMetric,
  UsageReport,
} from "../../shared/types/dashboard";

const scope = {
  widgetId: "widget 1",
  boardId: "12",
  sprintId: "34",
  usagePeriod: { from: "2026-10-12", to: "2026-10-12" },
};

const usageReport: UsageReport = {
  requestedPeriod: scope.usagePeriod,
  sources: [],
  compatibleTotals: [],
};

describe("dashboard refresh", () => {
  it("requests Jira and provider data using same-origin credentials", async () => {
    const correlationId = "3a5b49cb-e559-4e4a-8732-817769bf5732";
    const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(init?.credentials).toBe("same-origin");
      expect(new Headers(init?.headers).get("Cache-Control")).toBe("no-cache");
      if (String(input).startsWith("/api/v1/widgets/")) {
        return new Response(null, {
          status: 503,
          headers: { "x-correlation-id": correlationId },
        });
      }
      return Response.json(usageReport);
    });

    const result = await refreshDashboard(scope, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0][0])).toContain(
      "/widgets/widget%201/jira/boards/12/sprints/34/report",
    );
    expect(String(fetcher.mock.calls[1][0])).toContain(
      "widgetId=widget+1&from=2026-10-12&to=2026-10-12",
    );
    expect(result.usageReport).toEqual(usageReport);
    expect(result.failures).toEqual([
      { source: "jira", status: 503, correlationId },
    ]);
  });

  it("preserves the last successful report and marks it stale on refresh failure", () => {
    const previous = createDashboardRefreshState(undefined, usageReport);
    previous.lastSuccessfulAt = "2026-10-13T12:00:00.000Z";

    const refreshed = applyDashboardRefresh(
      previous,
      {
        failures: [
          {
            source: "provider_usage",
            status: 502,
            correlationId: "3a5b49cb-e559-4e4a-8732-817769bf5732",
          },
        ],
      },
      () => new Date("2026-10-13T13:00:00.000Z"),
    );

    expect(refreshed.usageReport).toEqual(usageReport);
    expect(refreshed.lastSuccessfulAt).toBe("2026-10-13T12:00:00.000Z");
    expect(refreshed.stale).toBe(true);
    expect(refreshed.failures[0].correlationId).toBe(
      "3a5b49cb-e559-4e4a-8732-817769bf5732",
    );
  });

  it("retains successful provider metrics when another provider request fails", () => {
    const oldMetric: UsageMetric = {
      name: "output_tokens",
      value: "14",
      unit: "tokens",
      kind: "reported",
      currency: null,
    };
    const previousSource: ProviderUsageSource = {
      id: "openai",
      status: "success",
      requestedPeriod: scope.usagePeriod,
      actualPeriod: scope.usagePeriod,
      lastSuccessfulAt: "2026-10-13T12:00:00.000Z",
      metrics: [oldMetric],
      unsupportedMetrics: [],
    };
    const failedSource: ProviderUsageSource = {
      id: "openai",
      status: "rate_limited",
      requestedPeriod: scope.usagePeriod,
      metrics: [],
      unsupportedMetrics: [],
      error: {
        code: "provider_rate_limited",
        message: "The provider is rate limiting usage reporting.",
        retryable: true,
      },
    };
    const previousReport: UsageReport = {
      ...usageReport,
      sources: [previousSource],
    };
    const refreshedReport: UsageReport = {
      ...usageReport,
      sources: [failedSource],
    };

    const refreshed = applyDashboardRefresh(
      createDashboardRefreshState(undefined, previousReport),
      { usageReport: refreshedReport, failures: [] },
      () => new Date("2026-10-13T13:00:00.000Z"),
    );

    expect(refreshed.usageReport?.sources[0]).toMatchObject({
      status: "stale",
      lastSuccessfulAt: "2026-10-13T12:00:00.000Z",
      metrics: [oldMetric],
    });
    expect(refreshed.usageReport?.compatibleTotals).toEqual([]);
    expect(refreshed.stale).toBe(true);
    expect(refreshed.lastSuccessfulAtBySource.provider_usage).toBe(
      "2026-10-13T12:00:00.000Z",
    );
  });
});
