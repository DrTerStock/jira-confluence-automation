import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { createApp } from "../../backend/src/server.js";
import { trustedViewerContextResolver } from "./authTestUtils.js";
import { JiraClient } from "../../backend/src/jira/client.js";
import { ProviderUsageService } from "../../backend/src/providers/usage.js";
import {
  EnvironmentProviderSecretStore,
  ProviderReadinessService,
} from "../../backend/src/providers/readiness.js";
import { AnthropicUsageAdapter } from "../../backend/src/providers/adapters.js";
import {
  RequestWork,
  RequestCapacityError,
} from "../../backend/src/requestWork.js";
import { loadHostIntegration } from "../../backend/src/auth/hostIntegration.js";
import { SprintObservationStore } from "../../backend/src/storage/sprintObservations.js";
import { WidgetConfigStore } from "../../backend/src/config/widgetConfig.js";
import { runMigrations } from "../../backend/src/db/migrate.js";
import { createUsageReport } from "../../backend/src/providers/metricPolicy.js";
import { ProviderUsageReportCache } from "../../backend/src/providers/reportCache.js";
import { getSprintReport } from "../../backend/src/services/sprintReport.js";
import { createProviderReadinessProbe } from "../../backend/src/providers/probe.js";

const period = { from: "2026-10-01", to: "2026-10-02" };
const config = {
  schemaVersion: 1 as const,
  boardId: "12",
  enabledProviders: [],
  preferences: {},
};
const database = { query: async () => ({ rows: [] }) };

describe("checklist gap regression coverage", () => {
  it("allows supported metrics from a partial provider while rejecting wholly unsupported coverage", async () => {
    const probe = createProviderReadinessProbe({
      providerId: "anthropic",
      fetchUsage: async (_credential, requestedPeriod) => ({
        id: "anthropic",
        status: "partial",
        requestedPeriod,
        actualPeriod: requestedPeriod,
        metrics: [
          {
            name: "output_tokens",
            value: "0",
            unit: "tokens",
            kind: "reported",
            currency: null,
          },
        ],
        unsupportedMetrics: ["cache_read_input_tokens"],
      }),
    });
    expect(await probe("fixture-token")).toBe("ready");
    const unsupported = createProviderReadinessProbe({
      providerId: "anthropic",
      fetchUsage: async (_credential, requestedPeriod) => ({
        id: "anthropic",
        status: "partial",
        requestedPeriod,
        metrics: [],
        unsupportedMetrics: ["output_tokens"],
      }),
    });
    await expect(unsupported("fixture-token")).rejects.toMatchObject({
      status: "unsupported_coverage",
    });
  });
  it("isolates unexpected readiness failures and preserves available choices", async () => {
    const service = new ProviderReadinessService(
      { getCredential: async () => "fixture-token" },
      {
        openai: async () => "ready",
        anthropic: async () => {
          throw new Error("private upstream body");
        },
      },
    );
    const sources = await service.list("tenant");
    expect(
      sources.find(({ providerId }) => providerId === "openai")?.status,
    ).toBe("ready");
    expect(
      sources.find(({ providerId }) => providerId === "anthropic")?.status,
    ).toBe("transient_failure");
    expect(JSON.stringify(sources)).not.toContain("private upstream body");
  });
  it("preserves original provider field names and explains normalized metrics", () => {
    const report = createUsageReport(period, [
      {
        id: "openai",
        status: "success",
        requestedPeriod: period,
        actualPeriod: period,
        unsupportedMetrics: [],
        metrics: [
          {
            name: "model_requests",
            value: "2",
            unit: "requests",
            kind: "reported",
            currency: null,
          },
        ],
      },
    ]);
    expect(report.sources[0].metricDefinitions?.model_requests).toMatchObject({
      providerName: "num_model_requests",
      description: expect.stringContaining("model requests"),
    });
  });
  it("purges widget usage on configuration change without affecting other widgets", () => {
    const cache = new ProviderUsageReportCache();
    const report = {
      requestedPeriod: period,
      sources: [],
      compatibleTotals: [],
    };
    cache.set("one", "tenant", "widget-1", report, new Date().toISOString());
    cache.set("two", "tenant", "widget-2", report, new Date().toISOString());
    const revision = cache.configurationRevision;
    cache.purgeWidget("tenant", "widget-1");
    expect(cache.get("one")).toBeUndefined();
    expect(cache.get("two")).toBeDefined();
    expect(cache.configurationRevision).toBeGreaterThan(revision);
    cache.dispose();
  });

  it("isolates missing credentials and unexpected exceptions from successful providers", async () => {
    const service = new ProviderUsageService(
      {
        getCredential: async (id) =>
          id === "anthropic" ? undefined : "fixture-credential",
      },
      [
        {
          providerId: "openai",
          fetchUsage: async () => ({
            id: "openai",
            status: "success",
            requestedPeriod: period,
            actualPeriod: period,
            lastSuccessfulAt: "2026-10-03T12:00:00Z",
            metrics: [
              {
                name: "output_tokens",
                value: "0",
                unit: "tokens",
                kind: "reported",
                currency: null,
              },
            ],
            unsupportedMetrics: [],
          }),
        },
        {
          providerId: "github_copilot",
          fetchUsage: async () => {
            throw new Error("sensitive upstream payload");
          },
        },
      ],
    );
    const report = await service.getReport(
      ["openai", "anthropic", "github_copilot"],
      period,
      "tenant-a",
    );
    expect(report.sources.map((source) => source.status)).toEqual([
      "success",
      "unavailable",
      "failed",
    ]);
    expect(report.sources[0].metrics[0].value).toBe("0");
    expect(JSON.stringify(report)).not.toContain("sensitive upstream payload");
  });

  it("does not produce a complete Anthropic total when a daily field is missing", async () => {
    const adapter = new AnthropicUsageAdapter(async () =>
      Response.json({
        has_more: false,
        data: [
          {
            starting_at: "2026-10-01T00:00:00Z",
            ending_at: "2026-10-02T00:00:00Z",
            results: [{ output_tokens: 10 }],
          },
          {
            starting_at: "2026-10-02T00:00:00Z",
            ending_at: "2026-10-03T00:00:00Z",
            results: [{}],
          },
        ],
      }),
    );
    const result = await adapter.fetchUsage("fixture-credential", period);
    expect(result.status).toBe("partial");
    expect(
      result.metrics.find((metric) => metric.name === "output_tokens"),
    ).toBeUndefined();
    expect(result.unsupportedMetrics).toContain("output_tokens");
  });

  it("binds environment credentials to the approved installation", async () => {
    const secrets = new EnvironmentProviderSecretStore({
      DASHBOARD_INSTALLATION_ID: "tenant-a",
      OPENAI_ADMIN_API_KEY: "fixture-private-key",
    });
    expect(await secrets.getCredential("openai", "tenant-a")).toBe(
      "fixture-private-key",
    );
    expect(await secrets.getCredential("openai", "tenant-b")).toBeUndefined();
    expect(await secrets.getCredential("openai")).toBeUndefined();
  });

  it("rejects inaccessible boards and unavailable sources before saving settings", async () => {
    const save = vi.fn(async () => config);
    const denied = createApp(database, {
      resolveViewerContext: trustedViewerContextResolver({ canEdit: true }),
      widgetConfigStore: { get: async () => config, save },
      jiraClient: new JiraClient(
        "https://jira.example.com",
        async () => new Response(null, { status: 403 }),
      ),
    });
    const result = await request(denied)
      .put("/api/v1/dashboard/config")
      .send(config);
    expect(result.status).toBe(403);
    expect(result.body.error).toMatchObject({
      code: "board_access_failed",
      retryable: false,
    });
    expect(result.body.error.correlationId).toBe(
      result.headers["x-correlation-id"],
    );
    const unavailable = createApp(database, {
      resolveViewerContext: trustedViewerContextResolver({ canEdit: true }),
      widgetConfigStore: { get: async () => config, save },
      jiraClient: new JiraClient("https://jira.example.com", async () =>
        Response.json({ id: 12, name: "Team", type: "scrum" }),
      ),
      providerReadinessService: { list: async () => [] },
    });
    expect(
      (
        await request(unavailable)
          .put("/api/v1/dashboard/config")
          .send({ ...config, enabledProviders: ["openai"] })
      ).status,
    ).toBe(422);
    expect(save).not.toHaveBeenCalled();
  });

  it("logs duration, operation and safe category without identifiers or request bodies", async () => {
    const logger = vi.fn();
    const app = createApp(database, { requestLogger: logger });
    await request(app).get("/api/v1/dashboard/context?token=private-value");
    expect(logger).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "/api/v1/dashboard/context",
        durationMs: expect.any(Number),
        correlationId: expect.any(String),
        errorCategory: "http_401",
      }),
    );
    expect(JSON.stringify(logger.mock.calls)).not.toContain("private-value");
  });

  it("deduplicates concurrent work and rejects excess tenant concurrency", async () => {
    const work = new RequestWork();
    let finish!: (value: string) => void;
    const retrieve = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const first = work.run("shared", "tenant", retrieve);
    const second = work.run("shared", "tenant", retrieve);
    const others = [1, 2, 3].map((id) =>
      work.run(String(id), "tenant", () => first),
    );
    await expect(
      work.run("excess", "tenant", async () => "x"),
    ).rejects.toBeInstanceOf(RequestCapacityError);
    await Promise.resolve();
    finish("report");
    expect(await Promise.all([first, second, ...others])).toEqual(
      Array(5).fill("report"),
    );
    expect(retrieve).toHaveBeenCalledTimes(1);
    expect(await work.run("fresh", "tenant", async () => "new report")).toBe(
      "new report",
    );
  });

  it("loads only deployment-controlled local host adapters and remains fail-closed", async () => {
    expect(await loadHostIntegration(undefined)).toBeUndefined();
    await expect(
      loadHostIntegration("https://untrusted.example/adapter.js"),
    ).rejects.toThrow("absolute local");
    await expect(
      loadHostIntegration("/tmp/adapter.js", async () => ({})),
    ).rejects.toThrow("resolveViewerContext");
    const resolver = trustedViewerContextResolver({ canEdit: true });
    expect(
      (
        await loadHostIntegration("/tmp/adapter.js", async () => ({
          resolveViewerContext: resolver,
        }))
      )?.resolveViewerContext,
    ).toBe(resolver);
  });

  it.skipIf(!process.env.DATABASE_URL)(
    "keeps only viewer-scoped manual observations, expires old history and cascades tenant purge",
    async () => {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const installationId = randomUUID();
      const configs = new WidgetConfigStore(pool);
      const observations = new SprintObservationStore(pool);
      try {
        await runMigrations(pool);
        await configs.save(installationId, "widget", config);
        const scope = {
          installationId,
          widgetInstanceKey: "widget",
          viewerId: "viewer",
          boardId: "12",
          sprintId: "34",
        };
        expect(await observations.history(scope)).toBeUndefined();
        const report = await getSprintReport(
          {
            getSprint: async () => ({
              id: "34",
              name: "Sprint",
              state: "active",
              active: true,
              originBoardId: "12",
            }),
            getBoardEstimationField: async () => undefined,
            listSprintIssues: async () => ({
              issues: [],
              total: 0,
              startAt: 0,
              maxResults: 100,
              isLast: true,
            }),
          },
          "fixture-token",
          "12",
          "34",
        );
        expect(
          (await observations.history(scope, report))?.observations,
        ).toHaveLength(1);
        expect(
          await observations.history({ ...scope, viewerId: "other" }),
        ).toBeUndefined();
        await pool.query(
          "UPDATE sprint_observations SET observed_at = now() - interval '31 days' WHERE installation_id = $1",
          [installationId],
        );
        expect(await observations.history(scope)).toBeUndefined();
        await observations.history(scope, report);
        await configs.deleteInstallation(installationId);
        expect(await observations.history(scope)).toBeUndefined();
      } finally {
        await configs.deleteInstallation(installationId);
        await pool.end();
      }
    },
  );
});
