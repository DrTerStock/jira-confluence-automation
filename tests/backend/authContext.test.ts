import { afterEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../backend/src/server.js";

const database = { query: async () => ({ rows: [] }) };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("trusted viewer authentication", () => {
  it("denies access when the host has not configured an authentication adapter", async () => {
    const app = createApp(database);

    const response = await request(app)
      .get("/api/v1/usage/report?widgetId=widget-1")
      .set("X-User-Id", "attacker")
      .set("X-Installation-Id", "attacker-installation");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("authentication_required");
  });

  it("returns a safe forbidden response when the host denies page access", async () => {
    const app = createApp(database, {
      resolveViewerContext: () => ({ status: "forbidden" }),
    });

    const response = await request(app).get("/api/v1/jira/boards");

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("page_access_denied");
    expect(response.body.error.message).not.toContain("page-1");
  });

  it("does not expose authentication adapter failures in responses or logs", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = createApp(database, {
      resolveViewerContext: () => {
        throw new Error("sensitive authentication response");
      },
    });

    const response = await request(app).get("/api/v1/jira/boards");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("authentication_unavailable");
    expect(JSON.stringify(response.body)).not.toContain("sensitive");
    expect(JSON.stringify(log.mock.calls)).not.toContain("sensitive");
  });

  it("rejects malformed context returned by the trusted adapter", async () => {
    const app = createApp(database, {
      resolveViewerContext: () =>
        ({
          status: "authenticated",
          viewer: {} as never,
        }) as never,
    });

    const response = await request(app).get("/api/v1/jira/boards");

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe("authentication_unavailable");
  });
});
