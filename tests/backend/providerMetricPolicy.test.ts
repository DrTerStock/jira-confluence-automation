import { describe, expect, it } from "vitest";
import type {
  ProviderId,
  ProviderUsageSource,
  UsageMetric,
} from "../../shared/types/dashboard.js";
import { createUsageReport } from "../../backend/src/providers/metricPolicy.js";

const period = { from: "2026-10-12", to: "2026-10-12" };

function source(
  id: ProviderId,
  metrics: UsageMetric[],
  options: {
    status?: ProviderUsageSource["status"];
    actualPeriod?: ProviderUsageSource["actualPeriod"];
    unsupportedMetrics?: string[];
  } = {},
): ProviderUsageSource {
  return {
    id,
    status: options.status ?? "success",
    requestedPeriod: period,
    actualPeriod: options.actualPeriod ?? period,
    metrics,
    unsupportedMetrics: options.unsupportedMetrics ?? [],
  };
}

function metric(
  name: string,
  value: string,
  unit: string,
  currency: string | null = null,
): UsageMetric {
  return { name, value, unit, currency, kind: "reported" };
}

describe("provider metric policy", () => {
  it("keeps reported zeroes, rejects unallowlisted or mismatched metrics", () => {
    const report = createUsageReport(period, [
      source(
        "openai",
        [
          metric("output_tokens", "0", "tokens"),
          metric("input_tokens", "12", "tokens", "USD"),
          metric("private_provider_metric", "999", "tokens"),
        ],
        { unsupportedMetrics: ["model_requests"] },
      ),
    ]);

    expect(report.sources[0].metrics).toEqual([
      metric("output_tokens", "0", "tokens"),
    ]);
    expect(report.sources[0].unsupportedMetrics).toEqual(
      expect.arrayContaining([
        "input_tokens",
        "model_requests",
        "unrecognized_metric",
      ]),
    );
    expect(JSON.stringify(report)).not.toContain("private_provider_metric");
    expect(report.compatibleTotals).toEqual([]);
  });

  it("aggregates only compatible output-token definitions from complete sources", () => {
    const report = createUsageReport(period, [
      source("openai", [
        metric("input_tokens", "3", "tokens"),
        metric("output_tokens", "0", "tokens"),
        metric("model_requests", "1", "requests"),
      ]),
      source("anthropic", [
        metric("uncached_input_tokens", "5", "tokens"),
        metric("output_tokens", "11", "tokens"),
      ]),
      source("github_copilot", [
        metric("code_generation_activity_count", "7", "events"),
      ]),
    ]);

    expect(report.compatibleTotals).toEqual([
      {
        name: "output_tokens",
        value: "11",
        unit: "tokens",
        currency: null,
        kind: "reported",
        sourceIds: ["openai", "anthropic"],
      },
    ]);
  });

  it("does not aggregate partial or differently covered sources", () => {
    const partialReport = createUsageReport(period, [
      source("openai", [metric("output_tokens", "2", "tokens")], {
        status: "partial",
      }),
      source("anthropic", [metric("output_tokens", "3", "tokens")]),
    ]);
    const differentPeriodReport = createUsageReport(period, [
      source("openai", [metric("output_tokens", "2", "tokens")]),
      source("anthropic", [metric("output_tokens", "3", "tokens")], {
        actualPeriod: { from: "2026-10-11", to: "2026-10-12" },
      }),
    ]);

    expect(partialReport.compatibleTotals).toEqual([]);
    expect(differentPeriodReport.compatibleTotals).toEqual([]);
  });
});
