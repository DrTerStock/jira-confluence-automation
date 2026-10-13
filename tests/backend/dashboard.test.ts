import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../backend/src/server.js";

describe("backend foundation", () => {
  it("provides an application liveness endpoint", async () => {
    const response = await request(
      createApp({ query: async () => ({ rows: [] }) }),
    ).get("/healthz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("reports readiness when the database query succeeds", async () => {
    const response = await request(
      createApp({ query: async () => ({ rows: [{ value: 1 }] }) }),
    ).get("/readyz");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ready" });
  });

  it("reports database unavailability as not ready", async () => {
    const app = createApp({
      query: async () => {
        throw new Error("connection failed");
      },
    });

    const response = await request(app).get("/readyz");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      status: "not_ready",
      reason: "database_unavailable",
    });
  });

  it.skipIf(!process.env.DATABASE_URL)(
    "connects to PostgreSQL when a database URL is configured",
    async () => {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      try {
        const result = await pool.query("SELECT 1 AS value");
        expect(result.rows[0].value).toBe(1);
      } finally {
        await pool.end();
      }
    },
  );
});
