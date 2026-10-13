import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  ProviderUsageSource,
  UsageReport,
} from "../../shared/types/dashboard";
import { UsagePanel } from "../../frontend/src/components/UsagePanel";

const period = { from: "2026-10-12", to: "2026-10-12" };

function usageSource(
  source: Partial<ProviderUsageSource> &
    Pick<ProviderUsageSource, "id" | "status">,
): ProviderUsageSource {
  return {
    requestedPeriod: period,
    metrics: [],
    unsupportedMetrics: [],
    ...source,
  };
}

function report(sources: ProviderUsageSource[]): UsageReport {
  return {
    requestedPeriod: period,
    sources,
    compatibleTotals: [],
  };
}

describe("AI usage panel", () => {
  it("shows compatible totals separately and retains reported zero metrics", () => {
    const markup = renderToStaticMarkup(
      createElement(UsagePanel, {
        report: {
          ...report([
            usageSource({
              id: "openai",
              status: "success",
              actualPeriod: period,
              metrics: [
                {
                  name: "output_tokens",
                  value: "0",
                  unit: "tokens",
                  currency: null,
                  kind: "reported",
                },
              ],
            }),
            usageSource({
              id: "anthropic",
              status: "success",
              actualPeriod: period,
              metrics: [
                {
                  name: "output_tokens",
                  value: "8",
                  unit: "tokens",
                  currency: null,
                  kind: "reported",
                },
              ],
            }),
          ]),
          compatibleTotals: [
            {
              name: "output_tokens",
              value: "8",
              unit: "tokens",
              currency: null,
              kind: "reported",
              sourceIds: ["openai", "anthropic"],
            },
          ],
        },
      }),
    );

    expect(markup).toContain("Compatible team totals");
    expect(markup).toContain("Across OpenAI and Anthropic");
    expect(markup).toContain("0 tokens");
    expect(markup).toContain("8 tokens");
    expect(markup).toContain("Coverage: 2026-10-12 to 2026-10-12");
  });

  it("labels partial, stale, and failed source states distinctly", () => {
    const markup = renderToStaticMarkup(
      createElement(UsagePanel, {
        report: report([
          usageSource({
            id: "openai",
            status: "partial",
            metrics: [
              {
                name: "model_requests",
                value: "2",
                unit: "requests",
                currency: null,
                kind: "reported",
              },
            ],
            unsupportedMetrics: ["input_tokens", "unrecognized_metric"],
          }),
          usageSource({
            id: "anthropic",
            status: "stale",
            actualPeriod: period,
            lastSuccessfulAt: "2026-10-13T12:00:00.000Z",
            metrics: [
              {
                name: "output_tokens",
                value: "4",
                unit: "tokens",
                currency: null,
                kind: "reported",
              },
            ],
          }),
          usageSource({
            id: "github_copilot",
            status: "failed",
            error: {
              code: "provider_request_failed",
              message: "The provider report failed safely.",
              retryable: true,
            },
          }),
        ]),
      }),
    );

    expect(markup).toContain("Partial data.");
    expect(markup).toContain("Stale data.");
    expect(markup).toContain("Failed.");
    expect(markup).toContain("Input tokens");
    expect(markup).toContain("Unrecognized metric");
    expect(markup).toContain("2 requests");
    expect(markup).toContain("4 tokens");
    expect(markup).toContain(
      "Last successful report: 2026-10-13T12:00:00.000Z",
    );
  });

  it("keeps an empty provider response distinct from a reported zero", () => {
    const markup = renderToStaticMarkup(
      createElement(UsagePanel, {
        report: report([
          usageSource({ id: "github_copilot", status: "empty" }),
        ]),
      }),
    );

    expect(markup).toContain("No usage was reported.");
    expect(markup).not.toContain("0 events");
  });

  it("shows loading and unavailable states without implying zero usage", () => {
    const loading = renderToStaticMarkup(
      createElement(UsagePanel, { loading: true }),
    );
    const unavailable = renderToStaticMarkup(createElement(UsagePanel));

    expect(loading).toContain("Loading.");
    expect(loading).toContain("Provider usage is refreshing.");
    expect(unavailable).toContain("Unavailable.");
    expect(unavailable).toContain("Values are not assumed to be zero.");
  });
});
