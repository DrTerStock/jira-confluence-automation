import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../../backend/src/server.js";
import { JiraClient } from "../../backend/src/jira/client.js";
import { ProviderUsageService } from "../../backend/src/providers/usage.js";
import { refreshDashboard } from "../../frontend/src/api/dashboardRefresh.js";
import App from "../../frontend/src/App.js";
import { trustedViewerContextResolver } from "./authTestUtils.js";

const config = {
  schemaVersion: 1 as const,
  boardId: "12",
  enabledProviders: ["openai" as const],
  preferences: { blockedStatusNames: ["Blocked"] },
};
const database = { query: async () => ({ rows: [] }) };

describe("release candidate dashboard flow", () => {
  it("loads active and historical sprints, refreshes both sources, and renders provenance and successful zero", async () => {
    const jira = new JiraClient("https://jira.example.com", async (input) => {
      const url = new URL(input.toString());
      let body: unknown;
      if (url.pathname.endsWith("/sprint"))
        body = {
          values: [
            { id: 34, name: "Current sprint", state: "active" },
            { id: 33, name: "Previous sprint", state: "closed" },
          ],
          startAt: 0,
          maxResults: 50,
          isLast: true,
          total: 2,
        };
      else if (url.pathname.endsWith("/issue"))
        body = {
          issues: [
            {
              id: "1",
              key: "TEAM-1",
              fields: {
                summary: "Ship report",
                issuetype: { name: "Task", subtask: false },
                status: { name: "Done", statusCategory: { key: "done" } },
              },
            },
          ],
          startAt: 0,
          maxResults: 100,
          total: 1,
        };
      else
        body = {
          id: Number(url.pathname.split("/").at(-1)),
          name: "Selected sprint",
          state: "active",
          originBoardId: 12,
        };
      return new Response(JSON.stringify(body), { status: 200 });
    });
    const usage = new ProviderUsageService(
      { getCredential: async () => "server-secret" },
      [
        {
          providerId: "openai",
          fetchUsage: async (_credential, period) => ({
            id: "openai",
            status: "success",
            requestedPeriod: period,
            actualPeriod: period,
            lastSuccessfulAt: "2026-10-13T12:00:00Z",
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
          }),
        },
      ],
    );
    const app = createApp(database, {
      resolveViewerContext: trustedViewerContextResolver(),
      widgetConfigStore: { get: async () => config },
      jiraClient: jira,
      providerUsageService: usage,
    });
    const context = await request(app).get("/api/v1/dashboard/context");
    expect(context.body.config).toEqual(config);
    const sprints = await request(app).get("/api/v1/jira/boards/12/sprints");
    expect(
      sprints.body.values.map((sprint: { state: string }) => sprint.state),
    ).toEqual(["active", "closed"]);
    const fetcher = async (input: string | URL) => {
      const result = await request(app).get(input.toString());
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: result.headers,
      });
    };
    for (const sprintId of ["34", "33"]) {
      const result = await refreshDashboard(
        {
          widgetId: "widget-1",
          boardId: "12",
          sprintId,
          usagePeriod: { from: "2026-10-12", to: "2026-10-12" },
        },
        fetcher,
      );
      expect(result.failures).toEqual([]);
      expect(result.sprintReport?.progress.issueCount.completed).toBe(1);
      const markup = renderToStaticMarkup(createElement(App, result));
      expect(markup).toContain("Burndown history unavailable");
      expect(markup).toContain("Output tokens");
      expect(markup).toContain("0 tokens");
      expect(markup).toContain("Coverage: 2026-10-12 to 2026-10-12");
      expect(markup).not.toContain("server-secret");
      expect(markup).not.toContain("viewer-token");
    }
  });

  it("allows trusted editors and admins to save validated settings", async () => {
    const save = vi.fn(async () => config);
    const store = { get: async () => config, save };
    const viewerApp = createApp(database, {
      resolveViewerContext: trustedViewerContextResolver(),
      widgetConfigStore: store,
    });
    expect(
      (await request(viewerApp).put("/api/v1/dashboard/config").send(config))
        .status,
    ).toBe(403);
    const adminApp = createApp(database, {
      resolveViewerContext: trustedViewerContextResolver({ canEdit: true }),
      jiraClient: new JiraClient("https://jira.example.com", async () =>
        Response.json({ id: 12, name: "Team board", type: "scrum" }),
      ),
      providerReadinessService: {
        list: async () => [
          {
            providerId: "openai",
            status: "ready",
            diagnosticCode: "provider_access_verified",
            checkedAt: "2026-10-13T12:00:00Z",
          },
        ],
      },
      widgetConfigStore: store,
    });
    expect(
      (
        await request(adminApp)
          .put("/api/v1/dashboard/config")
          .send({ ...config, token: "secret" })
      ).status,
    ).toBe(400);
    expect(save).not.toHaveBeenCalled();
    expect(
      (await request(adminApp).put("/api/v1/dashboard/config").send(config))
        .status,
    ).toBe(200);
    expect(save).toHaveBeenCalledWith(
      "trusted-installation",
      "widget-1",
      config,
    );
  });
  it("purges tenant records and cache through the host lifecycle callback", async () => {
    const deleteInstallation = vi.fn(async () => undefined);
    const app = createApp(database, {
      resolveViewerContext: trustedViewerContextResolver({ isAdmin: true }),
      widgetConfigStore: { get: async () => config, deleteInstallation },
    });
    await app.locals.purgeInstallationData("trusted-installation");
    expect(deleteInstallation).toHaveBeenCalledWith("trusted-installation");
    expect((await request(app).get("/api/v1/dashboard/context")).status).toBe(
      403,
    );
    expect(
      (await request(app).put("/api/v1/dashboard/config").send(config)).status,
    ).toBe(403);
  });

  it("does not echo malformed bodies or secrets in errors", async () => {
    const app = createApp(database);
    const result = await request(app)
      .put("/api/v1/dashboard/config")
      .set("Content-Type", "application/json")
      .send('{"token":"sensitive-body"');
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe("invalid_request_body");
    expect(JSON.stringify(result.body)).not.toContain("sensitive-body");
    expect(result.body.error.correlationId).toBe(
      result.headers["x-correlation-id"],
    );
  });
});
