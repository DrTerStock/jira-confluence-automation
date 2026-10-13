import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { JiraApiError, JiraClient } from "../../backend/src/jira/client.js";
import type { WidgetConfig } from "../../backend/src/config/widgetConfig.js";
import { createApp } from "../../backend/src/server.js";
import { trustedViewerContextResolver } from "./authTestUtils.js";

function pagedResponse<T>(values: T[]) {
  return new Response(
    JSON.stringify({
      values,
      startAt: 0,
      maxResults: 50,
      total: values.length,
      isLast: true,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

const mockDatabase = { query: async () => ({ rows: [] }) };

describe("Jira client", () => {
  it("lists boards using bounded pagination and viewer-scoped authorization", async () => {
    let requestedUrl: URL | undefined;
    let authorization: string | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      requestedUrl = new URL(input.toString());
      authorization =
        new Headers(init?.headers).get("Authorization") ?? undefined;
      return pagedResponse([
        {
          id: 42,
          name: "Platform",
          type: "scrum",
          location: { projectName: "Platform project", projectKey: "PLAT" },
        },
      ]);
    };
    const client = new JiraClient("https://jira.example.com/", fetcher);

    const page = await client.listBoards("viewer-token", 50, 25);

    expect(requestedUrl?.pathname).toBe("/rest/agile/1.0/board");
    expect(requestedUrl?.searchParams.get("startAt")).toBe("50");
    expect(requestedUrl?.searchParams.get("maxResults")).toBe("25");
    expect(authorization).toBe("Bearer viewer-token");
    expect(page.values[0]).toMatchObject({
      id: "42",
      name: "Platform",
      type: "scrum",
      location: { projectKey: "PLAT" },
    });
  });

  it("lists sprint metadata and marks active sprints", async () => {
    let requestedUrl: URL | undefined;
    const fetcher: typeof fetch = async (input) => {
      requestedUrl = new URL(input.toString());
      return pagedResponse([
        {
          id: 12,
          name: "Sprint 12",
          state: "active",
          startDate: "2026-10-01T00:00:00.000Z",
          endDate: "2026-10-15T00:00:00.000Z",
        },
      ]);
    };
    const client = new JiraClient("https://jira.example.com", fetcher);

    const page = await client.listSprints(
      "viewer-token",
      "42",
      0,
      20,
      "active",
    );

    expect(requestedUrl?.pathname).toBe("/rest/agile/1.0/board/42/sprint");
    expect(requestedUrl?.searchParams.get("state")).toBe("active");
    expect(page.values[0]).toMatchObject({
      id: "12",
      state: "active",
      active: true,
      startDate: "2026-10-01T00:00:00.000Z",
    });
  });

  it("retrieves sprint details and only parses the configured board estimate field", async () => {
    const requested: URL[] = [];
    const fetcher: typeof fetch = async (input) => {
      const url = new URL(input.toString());
      requested.push(url);
      if (url.pathname.endsWith("/configuration")) {
        return new Response(
          JSON.stringify({
            estimation: {
              type: "field",
              field: { fieldId: "customfield_10001" },
            },
          }),
          { status: 200 },
        );
      }
      if (url.pathname.endsWith("/sprint/12")) {
        return new Response(
          JSON.stringify({
            id: 12,
            name: "Sprint 12",
            state: "active",
            originBoardId: 42,
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          issues: [
            {
              id: 1,
              key: "PROJ-1",
              fields: {
                summary: "A story",
                issuetype: { name: "Story", subtask: false },
                status: {
                  name: "Done",
                  statusCategory: { key: "done" },
                },
                assignee: { displayName: "Viewer" },
                customfield_10001: 3,
              },
            },
          ],
          startAt: 0,
          maxResults: 100,
          total: 1,
        }),
        { status: 200 },
      );
    };
    const client = new JiraClient("https://jira.example.com", fetcher);

    const sprint = await client.getSprint("viewer-token", "12");
    const estimateField = await client.getBoardEstimationField(
      "viewer-token",
      "42",
    );
    const page = await client.listSprintIssues(
      "viewer-token",
      "12",
      0,
      100,
      estimateField,
    );

    expect(sprint).toMatchObject({
      id: "12",
      name: "Sprint 12",
      originBoardId: "42",
    });
    expect(estimateField).toBe("customfield_10001");
    expect(requested[2].searchParams.get("fields")).toContain(
      "customfield_10001",
    );
    expect(page.issues[0]).toMatchObject({
      key: "PROJ-1",
      statusCategory: "done",
      estimate: 3,
      browseUrl: "https://jira.example.com/browse/PROJ-1",
      assignee: "Viewer",
    });
  });

  it("rejects invalid pagination and arbitrary base URLs before making a request", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const client = new JiraClient("https://jira.example.com", fetcher);

    await expect(client.listBoards("viewer-token", 0, 101)).rejects.toThrow(
      "limit must be between 1 and 100",
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(() => new JiraClient("http://localhost:3000")).toThrow(
      "HTTPS origin",
    );
    expect(() => new JiraClient("https://jira.example.com/path")).toThrow(
      "without credentials or a path",
    );
  });

  it("maps permission and rate limit responses to safe errors", async () => {
    const forbidden = new JiraClient(
      "https://jira.example.com",
      async () => new Response(null, { status: 403 }),
    );
    const limitedFetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "0" },
        }),
    );
    const delay = vi.fn(async () => {});
    const limited = new JiraClient(
      "https://jira.example.com",
      limitedFetcher,
      delay,
    );

    await expect(forbidden.listBoards("viewer-token")).rejects.toMatchObject<
      Partial<JiraApiError>
    >({ code: "permission_denied" });
    await expect(limited.listBoards("viewer-token")).rejects.toMatchObject<
      Partial<JiraApiError>
    >({ code: "rate_limited", retryAfterSeconds: 0 });
    expect(limitedFetcher).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(0);
  });

  it("does not retry sooner than a server-requested delay", async () => {
    const limitedFetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 429,
          headers: { "Retry-After": "6" },
        }),
    );
    const delay = vi.fn(async () => {});
    const client = new JiraClient(
      "https://jira.example.com",
      limitedFetcher,
      delay,
    );

    await expect(client.listBoards("viewer-token")).rejects.toMatchObject<
      Partial<JiraApiError>
    >({ code: "rate_limited" });
    expect(limitedFetcher).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });
});

describe("Jira HTTP routes", () => {
  it("denies requests unless trusted viewer authentication supplies Jira context", async () => {
    const client = new JiraClient("https://jira.example.com");

    const response = await request(
      createApp(mockDatabase, { jiraClient: client }),
    ).get("/api/v1/jira/boards");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("authentication_required");
  });

  it("does not allow caller-supplied identity or Jira tokens", async () => {
    const app = createApp(mockDatabase, {
      jiraClient: new JiraClient("https://jira.example.com"),
    });

    const response = await request(app)
      .get("/api/v1/jira/boards")
      .set("X-User-Id", "attacker")
      .set("X-Installation-Id", "another-installation")
      .set("X-Jira-Access-Token", "attacker-token");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("authentication_required");
    expect(JSON.stringify(response.body)).not.toContain("attacker-token");
  });

  it("requires a viewer-scoped Jira access token", async () => {
    const app = createApp(mockDatabase, {
      jiraClient: new JiraClient("https://jira.example.com"),
      resolveViewerContext: trustedViewerContextResolver({
        jiraAccessToken: undefined,
      }),
    });

    const response = await request(app).get("/api/v1/jira/boards");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("jira_access_required");
  });

  it("returns boards for the authenticated viewer", async () => {
    const client = new JiraClient("https://jira.example.com", async () =>
      pagedResponse([{ id: 42, name: "Platform", type: "scrum" }]),
    );
    const app = createApp(mockDatabase, {
      jiraClient: client,
      resolveViewerContext: trustedViewerContextResolver(),
    });

    const response = await request(app).get(
      "/api/v1/jira/boards?startAt=0&limit=10",
    );

    expect(response.status).toBe(200);
    expect(response.body.values[0]).toMatchObject({
      id: "42",
      name: "Platform",
    });
  });

  it("validates sprint filters and pagination", async () => {
    const app = createApp(mockDatabase, {
      jiraClient: new JiraClient("https://jira.example.com"),
      resolveViewerContext: trustedViewerContextResolver(),
    });

    const invalidLimit = await request(app).get(
      "/api/v1/jira/boards?limit=1000",
    );
    const invalidState = await request(app).get(
      "/api/v1/jira/boards/42/sprints?state=unknown",
    );

    expect(invalidLimit.status).toBe(400);
    expect(invalidState.status).toBe(400);
  });

  it("returns a safe permission error when Jira denies board access", async () => {
    const app = createApp(mockDatabase, {
      jiraClient: new JiraClient(
        "https://jira.example.com",
        async () => new Response(null, { status: 403 }),
      ),
      resolveViewerContext: trustedViewerContextResolver(),
    });

    const response = await request(app).get("/api/v1/jira/boards");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("jira_permission_denied");
    expect(response.body.error.message).not.toContain("viewer-token");
  });

  it("returns a configured sprint report only within the authenticated installation", async () => {
    const client = new JiraClient("https://jira.example.com", async (input) => {
      const url = new URL(input.toString());
      if (url.pathname.endsWith("/sprint/12")) {
        return new Response(
          JSON.stringify({
            id: 12,
            name: "Sprint 12",
            state: "active",
            originBoardId: 42,
          }),
          { status: 200 },
        );
      }
      if (url.pathname.endsWith("/configuration")) {
        return new Response(JSON.stringify({ estimation: {} }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({
          issues: [
            {
              id: 1,
              key: "PROJ-1",
              fields: {
                summary: "A story",
                issuetype: { name: "Story", subtask: false },
                status: {
                  name: "Done",
                  statusCategory: { key: "done" },
                },
              },
            },
          ],
          startAt: 0,
          maxResults: 100,
          total: 1,
        }),
        { status: 200 },
      );
    });
    const config: WidgetConfig = {
      schemaVersion: 1,
      boardId: "42",
      enabledProviders: [],
      preferences: {
        showStoryPoints: true,
        estimateFieldId: "customfield_10001",
        blockedStatusNames: ["In Progress"],
      },
    };
    const app = createApp(mockDatabase, {
      jiraClient: client,
      resolveViewerContext: trustedViewerContextResolver({
        installationId: "install-1",
      }),
      widgetConfigStore: {
        get: vi.fn(async (installationId, widgetInstanceKey) => {
          expect(installationId).toBe("install-1");
          expect(widgetInstanceKey).toBe("widget-1");
          return config;
        }),
      },
    });

    const response = await request(app).get(
      "/api/v1/widgets/widget-1/jira/boards/42/sprints/12/report",
    );

    expect(response.status).toBe(200);
    expect(response.body.sprint.name).toBe("Sprint 12");
    expect(response.body.progress.issueCount).toEqual({
      completed: 1,
      remaining: 0,
      unclassified: 0,
      total: 1,
    });
    expect(response.body.progress.estimate).toMatchObject({
      status: "unavailable",
      unavailableReason: "board_field_mismatch",
    });
    expect(response.body.issues[0].browseUrl).toBe(
      "https://jira.example.com/browse/PROJ-1",
    );
    expect(response.body.blockers).toEqual({
      status: "success",
      count: 0,
      issues: [],
    });
  });

  it("denies widget IDs outside the trusted page context before reading config", async () => {
    const get = vi.fn();
    const app = createApp(mockDatabase, {
      jiraClient: new JiraClient("https://jira.example.com"),
      resolveViewerContext: trustedViewerContextResolver({
        widgetInstanceKey: "other-widget",
      }),
      widgetConfigStore: { get },
    });

    const response = await request(app).get(
      "/api/v1/widgets/widget-1/jira/boards/42/sprints/12/report",
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("widget_access_denied");
    expect(get).not.toHaveBeenCalled();
  });
});
