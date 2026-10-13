import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { trustedViewerContextResolver } from "./authTestUtils.js";
import {
  EnvironmentProviderSecretStore,
  ProviderReadinessProbeError,
  ProviderReadinessService,
} from "../../backend/src/providers/readiness.js";
import { createApp } from "../../backend/src/server.js";

const mockDatabase = { query: async () => ({ rows: [] }) };

describe("provider readiness service", () => {
  it("reports distinct statuses without exposing configured credentials", async () => {
    const secretStore = new EnvironmentProviderSecretStore({
      DASHBOARD_INSTALLATION_ID: "trusted-installation",
      GITHUB_COPILOT_TOKEN: "gh-secret",
      OPENAI_ADMIN_API_KEY: "openai-secret",
      ANTHROPIC_ADMIN_API_KEY: "anthropic-secret",
    });
    const service = new ProviderReadinessService(
      secretStore,
      {
        github_copilot: async (credential) => {
          expect(credential).toBe("gh-secret");
          throw new ProviderReadinessProbeError("permission_denied");
        },
        openai: async () => "unsupported_coverage",
        anthropic: async () => "transient_failure",
      },
      () => new Date("2026-10-13T12:00:00.000Z"),
    );

    const sources = await service.list("trusted-installation");

    expect(sources).toEqual([
      {
        providerId: "github_copilot",
        status: "permission_denied",
        diagnosticCode: "insufficient_permissions",
        checkedAt: "2026-10-13T12:00:00.000Z",
      },
      {
        providerId: "openai",
        status: "unsupported_coverage",
        diagnosticCode: "unsupported_reporting_coverage",
        checkedAt: "2026-10-13T12:00:00.000Z",
      },
      {
        providerId: "anthropic",
        status: "transient_failure",
        diagnosticCode: "provider_temporarily_unavailable",
        checkedAt: "2026-10-13T12:00:00.000Z",
      },
    ]);
    expect(JSON.stringify(sources)).not.toContain("secret");
  });

  it("distinguishes missing credentials from present but unverified credentials", async () => {
    const service = new ProviderReadinessService(
      new EnvironmentProviderSecretStore({
        DASHBOARD_INSTALLATION_ID: "trusted-installation",
        OPENAI_ADMIN_API_KEY: "private-key",
      }),
      {},
      () => new Date("2026-10-13T12:00:00.000Z"),
    );

    const sources = await service.list("trusted-installation");

    expect(
      sources.map(({ providerId, status, diagnosticCode }) => ({
        providerId,
        status,
        diagnosticCode,
      })),
    ).toEqual([
      {
        providerId: "github_copilot",
        status: "missing_credentials",
        diagnosticCode: "credentials_not_configured",
      },
      {
        providerId: "openai",
        status: "configured",
        diagnosticCode: "credentials_present_unverified",
      },
      {
        providerId: "anthropic",
        status: "missing_credentials",
        diagnosticCode: "credentials_not_configured",
      },
    ]);
    expect(JSON.stringify(sources)).not.toContain("private-key");
  });

  it("marks provider access ready only after a successful probe", async () => {
    const service = new ProviderReadinessService(
      new EnvironmentProviderSecretStore({
        DASHBOARD_INSTALLATION_ID: "trusted-installation",
        OPENAI_ADMIN_API_KEY: "private-key",
      }),
      { openai: async () => "ready" },
      () => new Date("2026-10-13T12:00:00.000Z"),
    );

    const sources = await service.list("trusted-installation");

    expect(sources.find(({ providerId }) => providerId === "openai")).toEqual({
      providerId: "openai",
      status: "ready",
      diagnosticCode: "provider_access_verified",
      checkedAt: "2026-10-13T12:00:00.000Z",
    });
  });
});

describe("provider readiness admin route", () => {
  it("denies anonymous and non-admin callers", async () => {
    const service = { list: vi.fn(async () => []) };
    const appWithoutAuth = createApp(mockDatabase, {
      providerReadinessService: service,
    });
    const appForViewer = createApp(mockDatabase, {
      resolveViewerContext: trustedViewerContextResolver(),
      providerReadinessService: service,
    });

    const anonymousResponse = await request(appWithoutAuth).get(
      "/api/v1/admin/sources",
    );
    const viewerResponse = await request(appForViewer).get(
      "/api/v1/admin/sources",
    );

    expect(anonymousResponse.status).toBe(401);
    expect(viewerResponse.status).toBe(403);
    expect(service.list).not.toHaveBeenCalled();
  });

  it("returns only safe readiness metadata to an administrator", async () => {
    const service = {
      list: vi.fn(async () => [
        {
          providerId: "openai" as const,
          status: "configured" as const,
          diagnosticCode: "credentials_present_unverified" as const,
          checkedAt: "2026-10-13T12:00:00.000Z",
        },
      ]),
    };
    const app = createApp(mockDatabase, {
      resolveViewerContext: trustedViewerContextResolver({ isAdmin: true }),
      providerReadinessService: service,
    });

    const response = await request(app).get("/api/v1/admin/sources");

    expect(response.status).toBe(200);
    expect(response.body.sources[0]).toMatchObject({
      providerId: "openai",
      status: "configured",
      diagnosticCode: "credentials_present_unverified",
    });
    expect(JSON.stringify(response.body)).not.toContain("secret");
    expect(JSON.stringify(response.body)).not.toContain("input");
  });
});
