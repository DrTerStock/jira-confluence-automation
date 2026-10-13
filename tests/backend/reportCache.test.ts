import { describe, expect, it, vi } from "vitest";
import type {
  ProviderId,
  ReportingPeriod,
  UsageReport,
} from "../../shared/types/dashboard.js";
import {
  isCacheableUsageReport,
  PROVIDER_REPORT_MAX_AGE_MS,
  ProviderUsageReportCache,
  REPORT_CACHE_TTL_MS,
} from "../../backend/src/providers/reportCache.js";

const period: ReportingPeriod = {
  from: "2026-10-12",
  to: "2026-10-13",
};

function usageReport(status: "success" | "partial" = "success"): UsageReport {
  return {
    requestedPeriod: period,
    sources: [
      {
        id: "openai",
        status,
        requestedPeriod: period,
        actualPeriod: period,
        lastSuccessfulAt: "2026-10-13T12:00:00.000Z",
        metrics: [],
        unsupportedMetrics: [],
      },
    ],
    compatibleTotals: [],
  };
}

describe("provider usage report cache", () => {
  it("stores source, period, retrieval, completeness, and expiry metadata", () => {
    const now = Date.parse("2026-10-13T12:00:00.000Z");
    const cache = new ProviderUsageReportCache(() => now);

    cache.set(
      "key",
      "install-1",
      "widget-1",
      usageReport(),
      "2026-10-13T12:00:00.000Z",
    );

    expect(cache.get("key")).toEqual({
      report: usageReport(),
      metadata: {
        installationId: "install-1",
        widgetInstanceKey: "widget-1",
        requestedPeriod: period,
        retrievedAt: "2026-10-13T12:00:00.000Z",
        completeness: "complete",
        sources: [
          {
            sourceId: "openai" satisfies ProviderId,
            requestedPeriod: period,
            actualPeriod: period,
            retrievedAt: "2026-10-13T12:00:00.000Z",
            completeness: "complete",
          },
        ],
      },
      expiresAt: new Date(now + REPORT_CACHE_TTL_MS).toISOString(),
    });
  });

  it("stops serving reports after the freshness window and expires them at 24 hours", () => {
    let now = Date.parse("2026-10-13T12:00:00.000Z");
    const cache = new ProviderUsageReportCache(() => now);
    cache.set(
      "key",
      "install-1",
      "widget-1",
      usageReport(),
      new Date(now).toISOString(),
    );

    now += PROVIDER_REPORT_MAX_AGE_MS + 1;
    expect(cache.get("key")).toBeUndefined();

    now += REPORT_CACHE_TTL_MS;
    expect(cache.get("key")).toBeUndefined();
  });

  it("purges cached usage data for a removed installation only", () => {
    const cache = new ProviderUsageReportCache();
    cache.set(
      "first",
      "install-1",
      "widget-1",
      usageReport(),
      new Date().toISOString(),
    );
    cache.set(
      "second",
      "install-2",
      "widget-2",
      usageReport(),
      new Date().toISOString(),
    );

    cache.purgeInstallation("install-1");

    expect(cache.get("first")).toBeUndefined();
    expect(cache.get("second")).toBeDefined();
  });

  it("does not cache partial or failed provider results", () => {
    expect(isCacheableUsageReport(usageReport("success"))).toBe(true);
    expect(isCacheableUsageReport(usageReport("partial"))).toBe(false);
  });
  it("physically removes expired data without a read", () => {
    vi.useFakeTimers();
    try {
      const cache = new ProviderUsageReportCache(Date.now, 100);
      cache.set(
        "key",
        "install-1",
        "widget-1",
        usageReport(),
        new Date().toISOString(),
      );
      vi.advanceTimersByTime(100);
      // Rewind the clock to prove the entry was deleted rather than hidden by get().
      vi.setSystemTime(Date.now() - 100);
      expect(cache.get("key")).toBeUndefined();
      cache.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it("prevents a pending retrieval from repopulating a purged installation", () => {
    const cache = new ProviderUsageReportCache();
    cache.purgeInstallation("install-1");
    cache.set(
      "late",
      "install-1",
      "widget-1",
      usageReport(),
      new Date().toISOString(),
    );
    expect(cache.get("late")).toBeUndefined();
    expect(cache.isInstallationRemoved("install-1")).toBe(true);
  });

  it("keeps cached results isolated from caller mutations", () => {
    const cache = new ProviderUsageReportCache();
    const report = usageReport();
    cache.set("key", "install-1", "widget-1", report, new Date().toISOString());
    report.sources[0]!.status = "partial";
    cache.get("key")!.report.sources.length = 0;
    expect(cache.get("key")!.report.sources[0]!.status).toBe("success");
    cache.dispose();
  });
});
