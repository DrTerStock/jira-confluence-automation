import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { trustedViewerContextResolver } from "./authTestUtils.js";
import type { WidgetConfig } from "../../backend/src/config/widgetConfig.js";
import {
  ProviderUsageError,
  ProviderUsageService,
} from "../../backend/src/providers/usage.js";
import { createApp } from "../../backend/src/server.js";
import type { ProviderSecretStore } from "../../backend/src/providers/readiness.js";

const database = { query: async () => ({ rows: [] }) };
const config: WidgetConfig = {
  schemaVersion: 1,
  boardId: "12",
  enabledProviders: ["openai"],
  preferences: {},
};

describe("provider usage report route", () => {
  it("denies unauthenticated requests", async () => {
    const app = createApp(database);

    const response = await request(app).get(
      "/api/v1/usage/report?widgetId=widget-1&from=2026-10-12&to=2026-10-12",
    );

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("authentication_required");
    expect(response.body.error.correlationId).toBe(
      response.headers["x-correlation-id"],
    );
  });

  it("scopes saved configuration to trusted installation context", async () => {
    const get = vi.fn(async () => config);
    const secretStore: ProviderSecretStore = {
      getCredential: async () => "openai-secret",
    };
    const adapter = {
      providerId: "openai" as const,
      fetchUsage: vi.fn(async (_credential, period) => ({
        id: "openai" as const,
        status: "success" as const,
        requestedPeriod: period,
        actualPeriod: period,
        lastSuccessfulAt: "2026-10-13T12:00:00.000Z",
        metrics: [],
        unsupportedMetrics: [],
      })),
    };
    const service = new ProviderUsageService(secretStore, [adapter]);
    const app = createApp(database, {
      resolveViewerContext: trustedViewerContextResolver(),
      widgetConfigStore: { get },
      providerUsageService: service,
    });

    const response = await request(app).get(
      "/api/v1/usage/report?widgetId=widget-1&from=2026-10-12&to=2026-10-12&providers=openai",
    );

    expect(response.status).toBe(200);
    expect(response.headers["x-correlation-id"]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(response.body.requestedPeriod).toEqual({
      from: "2026-10-12",
      to: "2026-10-12",
    });
    expect(get).toHaveBeenCalledWith("trusted-installation", "widget-1");
    expect(JSON.stringify(response.body)).not.toContain("openai-secret");
  });

  it("caches complete reports within trusted widget scope and bypasses cache on refresh", async () => {
    const adapter = {
      providerId: "openai" as const,
      fetchUsage: vi.fn(async (_credential: string, period) => ({
        id: "openai" as const,
        status: "success" as const,
        requestedPeriod: period,
        actualPeriod: period,
        lastSuccessfulAt: "2026-10-13T12:00:00.000Z",
        metrics: [],
        unsupportedMetrics: [],
      })),
    };
    const service = new ProviderUsageService(
      { getCredential: async () => "openai-secret" },
      [adapter],
    );
    const app = createApp(database, {
      resolveViewerContext: trustedViewerContextResolver(),
      widgetConfigStore: { get: vi.fn(async () => config) },
      providerUsageService: service,
    });
    const path =
      "/api/v1/usage/report?widgetId=widget-1&from=2026-10-12&to=2026-10-12&providers=openai";

    const first = await request(app).get(path);
    const cached = await request(app).get(path);
    const refreshed = await request(app)
      .get(path)
      .set("Cache-Control", "no-cache");

    expect(first.status).toBe(200);
    expect(cached.status).toBe(200);
    expect(refreshed.status).toBe(200);
    expect(adapter.fetchUsage).toHaveBeenCalledTimes(2);
    expect(first.headers["cache-control"]).toBe("private, no-store");
  });

  it("denies widget IDs outside the trusted page context", async () => {
    const get = vi.fn(async () => config);
    const app = createApp(database, {
      resolveViewerContext: trustedViewerContextResolver(),
      widgetConfigStore: { get },
      providerUsageService: new ProviderUsageService(
        { getCredential: async () => "openai-secret" },
        [],
      ),
    });

    const response = await request(app).get(
      "/api/v1/usage/report?widgetId=another-widget&from=2026-10-12&to=2026-10-12",
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("widget_access_denied");
    expect(get).not.toHaveBeenCalled();
  });

  it("rejects disabled, invalid, and unconfigured provider selections", async () => {
    const get = vi.fn(async () => config);
    const secretStore: ProviderSecretStore = {
      getCredential: async () => undefined,
    };
    const adapter = {
      providerId: "openai" as const,
      fetchUsage: vi.fn(),
    };
    const service = new ProviderUsageService(secretStore, [adapter]);
    const app = createApp(database, {
      resolveViewerContext: trustedViewerContextResolver(),
      widgetConfigStore: { get },
      providerUsageService: service,
    });
    const route = "/api/v1/usage/report?widgetId=widget-1";

    const disabledProvider = await request(app).get(
      `${route}&from=2026-10-12&to=2026-10-12&providers=anthropic`,
    );
    const invalidPeriod = await request(app).get(
      `${route}&from=2026-02-30&to=2026-10-12&providers=openai`,
    );
    const unconfiguredProvider = await request(app).get(
      `${route}&from=2026-10-12&to=2026-10-12&providers=openai`,
    );

    expect(disabledProvider.status).toBe(403);
    expect(disabledProvider.body.error.code).toBe("provider_not_enabled");
    expect(invalidPeriod.status).toBe(400);
    expect(invalidPeriod.body.error.code).toBe("invalid_usage_report_request");
    expect(unconfiguredProvider.status).toBe(200);
    expect(unconfiguredProvider.body.sources[0].error.code).toBe(
      "provider_not_configured",
    );
    expect(adapter.fetchUsage).not.toHaveBeenCalled();
  });

  it("keeps provider permission failures explicit and secret-free", async () => {
    const service = new ProviderUsageService(
      { getCredential: async () => "server-side-secret" },
      [
        {
          providerId: "openai",
          fetchUsage: async () => {
            throw new ProviderUsageError(
              "permission_denied",
              "provider_permission_denied",
              "The provider denied access to usage reporting.",
              false,
            );
          },
        },
      ],
    );

    const report = await service.getReport(["openai"], {
      from: "2026-10-12",
      to: "2026-10-12",
    });

    expect(report.sources[0].status).toBe("permission_denied");
    expect(report.sources[0].error?.code).toBe("provider_permission_denied");
    expect(JSON.stringify(report)).not.toContain("server-side-secret");
  });
});
