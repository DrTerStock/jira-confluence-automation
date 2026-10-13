import { describe, expect, it, vi } from "vitest";
import type { ProviderSecretStore } from "../../backend/src/providers/readiness.js";
import {
  AnthropicUsageAdapter,
  GitHubCopilotUsageAdapter,
  OpenAIUsageAdapter,
} from "../../backend/src/providers/adapters.js";
import {
  ProviderUsageService,
  validateReportingPeriod,
} from "../../backend/src/providers/usage.js";
import { createProviderReadinessProbe } from "../../backend/src/providers/probe.js";
import { ProviderReadinessProbeError } from "../../backend/src/providers/readiness.js";

const period = { from: "2026-10-12", to: "2026-10-12" };

describe("provider usage adapters", () => {
  it("normalizes OpenAI organization token usage and preserves reported zeroes", async () => {
    const startTime = Date.parse(`${period.from}T00:00:00Z`) / 1000;
    const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(input);
      expect(url.origin).toBe("https://api.openai.com");
      expect(url.pathname).toBe("/v1/organization/usage/completions");
      expect(url.searchParams.get("start_time")).toBe(String(startTime));
      expect(url.searchParams.get("end_time")).toBe(String(startTime + 86_400));
      expect(url.searchParams.get("bucket_width")).toBe("1d");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        "Bearer openai-secret",
      );
      return Response.json({
        object: "page",
        has_more: false,
        next_page: null,
        data: [
          {
            object: "bucket",
            start_time: startTime,
            end_time: startTime + 86_400,
            results: [
              {
                object: "organization.usage.completions.result",
                input_tokens: 0,
                output_tokens: 14,
                num_model_requests: 2,
              },
            ],
          },
        ],
      });
    });
    const adapter = new OpenAIUsageAdapter(
      fetcher,
      () => new Date("2026-10-13T12:00:00.000Z"),
    );

    const result = await adapter.fetchUsage("openai-secret", period);

    expect(result).toMatchObject({
      id: "openai",
      status: "success",
      requestedPeriod: period,
      actualPeriod: period,
      lastSuccessfulAt: "2026-10-13T12:00:00.000Z",
      metrics: [
        {
          name: "input_tokens",
          value: "0",
          unit: "tokens",
          kind: "reported",
          currency: null,
        },
        { name: "output_tokens", value: "14", unit: "tokens" },
        { name: "model_requests", value: "2", unit: "requests" },
      ],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("retries an OpenAI rate limit once without retrying indefinitely", async () => {
    const fetcher = vi
      .fn(async () => Response.json({ has_more: false, data: [] }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "retry-after": "0" },
        }),
      );
    const delay = vi.fn(async () => {});
    const adapter = new OpenAIUsageAdapter(
      fetcher,
      () => new Date("2026-10-13T12:00:00.000Z"),
      delay,
    );

    const result = await adapter.fetchUsage("openai-secret", period);

    expect(result.status).toBe("empty");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(0);
  });

  it("normalizes Anthropic organization token buckets without requesting identity dimensions", async () => {
    const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(input);
      expect(url.origin).toBe("https://api.anthropic.com");
      expect(url.pathname).toBe("/v1/organizations/analytics/usage_report");
      expect(url.searchParams.get("starting_at")).toBe("2026-10-12T00:00:00Z");
      expect(url.searchParams.get("ending_at")).toBe("2026-10-13T00:00:00Z");
      expect(url.searchParams.get("group_by")).toBeNull();
      expect(new Headers(init?.headers).get("x-api-key")).toBe(
        "anthropic-secret",
      );
      return Response.json({
        has_more: false,
        next_page: null,
        data: [
          {
            starting_at: "2026-10-12T00:00:00Z",
            ending_at: "2026-10-13T00:00:00Z",
            results: [
              {
                uncached_input_tokens: 7,
                cache_read_input_tokens: 0,
                "cache_creation.ephemeral_5m_input_tokens": 3,
                output_tokens: 5,
              },
            ],
          },
        ],
      });
    });
    const adapter = new AnthropicUsageAdapter(
      fetcher,
      () => new Date("2026-10-13T12:00:00.000Z"),
    );

    const result = await adapter.fetchUsage("anthropic-secret", period);

    expect(result.status).toBe("partial");
    expect(result.actualPeriod).toEqual(period);
    expect(result.metrics).toEqual([
      {
        name: "uncached_input_tokens",
        value: "7",
        unit: "tokens",
        kind: "reported",
        currency: null,
      },
      {
        name: "cache_read_input_tokens",
        value: "0",
        unit: "tokens",
        kind: "reported",
        currency: null,
      },
      {
        name: "cache_creation.ephemeral_5m_input_tokens",
        value: "3",
        unit: "tokens",
        kind: "reported",
        currency: null,
      },
      {
        name: "output_tokens",
        value: "5",
        unit: "tokens",
        kind: "reported",
        currency: null,
      },
    ]);
  });

  it("marks OpenAI reports partial when a requested daily bucket is missing", async () => {
    const days = ["2026-10-12", "2026-10-14"];
    const fetcher = async () => {
      const data = days.map((day) => {
        const start = Date.parse(`${day}T00:00:00Z`) / 1000;
        return {
          start_time: start,
          end_time: start + 86_400,
          results: [],
        };
      });
      return Response.json({ has_more: false, data });
    };
    const adapter = new OpenAIUsageAdapter(fetcher);

    const result = await adapter.fetchUsage("openai-secret", {
      from: "2026-10-12",
      to: "2026-10-14",
    });

    expect(result.status).toBe("partial");
    expect(result.actualPeriod).toEqual({
      from: "2026-10-12",
      to: "2026-10-14",
    });
    expect(result.error?.code).toBe("period_truncated");
    expect(result.metrics).toEqual([]);
  });

  it("aggregates GitHub Copilot daily team reports without fetching user reports", async () => {
    const requestedDays = ["2026-10-12", "2026-10-13"];
    const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = new URL(input);
      if (url.hostname === "api.github.com") {
        expect(url.pathname).toBe(
          "/enterprises/example-enterprise/copilot/metrics/reports/enterprise-1-day",
        );
        expect(new Headers(init?.headers).get("authorization")).toBe(
          "Bearer github-secret",
        );
        expect(url.searchParams.get("day")).toBe(requestedDays.shift());
        return Response.json({
          report_day: url.searchParams.get("day"),
          download_links: [
            `https://reports.example.net/${url.searchParams.get("day")}.ndjson`,
          ],
        });
      }

      expect(url.hostname).toBe("reports.example.net");
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      const day = url.pathname.slice(1, 11);
      const value = day === "2026-10-12" ? 2 : 4;
      return new Response(
        `${JSON.stringify({
          day,
          user_initiated_interaction_count: value,
          code_generation_activity_count: value + 1,
          code_acceptance_activity_count: 1,
        })}\n`,
      );
    });
    const adapter = new GitHubCopilotUsageAdapter(
      "example-enterprise",
      fetcher,
      () => new Date("2026-10-14T12:00:00.000Z"),
    );

    const result = await adapter.fetchUsage("github-secret", {
      from: "2026-10-12",
      to: "2026-10-13",
    });

    expect(result.status).toBe("success");
    expect(result.actualPeriod).toEqual({
      from: "2026-10-12",
      to: "2026-10-13",
    });
    expect(result.metrics.map(({ name, value }) => [name, value])).toEqual([
      ["user_initiated_interaction_count", "6"],
      ["code_generation_activity_count", "8"],
      ["code_acceptance_activity_count", "2"],
    ]);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });

  it("maps provider authorization and unsupported coverage failures to safe states", async () => {
    const deniedFetcher = async () => new Response(null, { status: 403 });
    const deniedAdapter = new OpenAIUsageAdapter(deniedFetcher);
    expect(() => new GitHubCopilotUsageAdapter("")).not.toThrow();
    const missingEnterpriseAdapter = new GitHubCopilotUsageAdapter(
      undefined,
      deniedFetcher,
    );
    const service = new ProviderUsageService(
      { getCredential: async () => "private-provider-secret" },
      [deniedAdapter, missingEnterpriseAdapter],
    );

    const report = await service.getReport(
      ["openai", "github_copilot"],
      period,
    );

    expect(report.sources.map(({ status }) => status)).toEqual([
      "permission_denied",
      "unavailable",
    ]);
    expect(JSON.stringify(report)).not.toContain("private-");
  });

  it("verifies provider readiness through bounded read-only probes", async () => {
    const now = () => new Date("2026-10-13T12:00:00.000Z");
    const availableAdapter = {
      providerId: "openai" as const,
      fetchUsage: vi.fn(async (_credential, requestedPeriod) => ({
        id: "openai" as const,
        status: "empty" as const,
        requestedPeriod,
        lastSuccessfulAt: "2026-10-13T12:00:00.000Z",
        metrics: [],
        unsupportedMetrics: [],
      })),
    };
    const probe = createProviderReadinessProbe(availableAdapter, now);

    await expect(probe("server-secret")).resolves.toBe("ready");
    expect(availableAdapter.fetchUsage).toHaveBeenCalledWith("server-secret", {
      from: "2026-10-12",
      to: "2026-10-12",
    });

    const deniedProbe = createProviderReadinessProbe(
      new OpenAIUsageAdapter(async () => new Response(null, { status: 403 })),
      now,
    );
    const unsupportedProbe = createProviderReadinessProbe(
      new GitHubCopilotUsageAdapter(undefined),
      now,
    );
    await expect(deniedProbe("server-secret")).rejects.toMatchObject({
      status: "permission_denied",
    } satisfies Partial<ProviderReadinessProbeError>);
    await expect(unsupportedProbe("server-secret")).rejects.toMatchObject({
      status: "unsupported_coverage",
    } satisfies Partial<ProviderReadinessProbeError>);
  });
});

describe("provider usage service", () => {
  it("returns unavailable for a provider without credentials without making calls", async () => {
    const secretStore: ProviderSecretStore = {
      getCredential: async () => undefined,
    };
    const adapter = {
      providerId: "openai" as const,
      fetchUsage: vi.fn(),
    };
    const service = new ProviderUsageService(secretStore, [adapter]);

    expect(
      (await service.getReport(["openai"], period)).sources[0],
    ).toMatchObject({
      id: "openai",
      status: "unavailable",
      metrics: [],
      error: { code: "provider_not_configured" },
    });
    expect(adapter.fetchUsage).not.toHaveBeenCalled();
  });

  it("validates calendar periods and caps reports at 31 days", () => {
    expect(validateReportingPeriod(period)).toEqual(period);
    expect(() =>
      validateReportingPeriod({ from: "2026-02-30", to: "2026-03-01" }),
    ).toThrow("valid YYYY-MM-DD");
    expect(() =>
      validateReportingPeriod({ from: "2026-10-01", to: "2026-11-01" }),
    ).toThrow("cannot exceed 31 days");
    expect(() =>
      validateReportingPeriod({ from: "2026-10-14", to: "2026-10-13" }),
    ).toThrow("must not precede");
  });
});
