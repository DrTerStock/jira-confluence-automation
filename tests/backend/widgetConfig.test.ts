import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import {
  validateWidgetConfigInput,
  WidgetConfigStore,
} from "../../backend/src/config/widgetConfig.js";
import { runMigrations } from "../../backend/src/db/migrate.js";

describe("widget configuration validation", () => {
  it("normalizes omitted schema version and preferences to current defaults", () => {
    expect(
      validateWidgetConfigInput({
        boardId: "42",
        enabledProviders: ["openai"],
      }),
    ).toEqual({
      schemaVersion: 1,
      boardId: "42",
      enabledProviders: ["openai"],
      preferences: {},
    });
  });

  it("rejects secret-like and unknown configuration fields", () => {
    expect(() =>
      validateWidgetConfigInput({
        boardId: "42",
        enabledProviders: [],
        apiKey: "must-not-be-stored",
      }),
    ).toThrow("unsupported fields");
  });

  it("rejects duplicate or unsupported providers", () => {
    expect(() =>
      validateWidgetConfigInput({
        boardId: "42",
        enabledProviders: ["openai", "openai"],
      }),
    ).toThrow("must not contain duplicates");
    expect(() =>
      validateWidgetConfigInput({
        boardId: "42",
        enabledProviders: ["unknown"],
      }),
    ).toThrow("only supported provider identifiers");
  });

  it("rejects unsupported schema versions and preference fields", () => {
    expect(() =>
      validateWidgetConfigInput({
        schemaVersion: 2,
        boardId: "42",
        enabledProviders: [],
      }),
    ).toThrow("Unsupported widget configuration schema version");
    expect(() =>
      validateWidgetConfigInput({
        boardId: "42",
        enabledProviders: [],
        preferences: { apiToken: "must-not-be-stored" },
      }),
    ).toThrow("preferences contains unsupported fields");
  });

  it("validates explicit blocked Jira status mappings", () => {
    expect(
      validateWidgetConfigInput({
        boardId: "42",
        enabledProviders: [],
        preferences: { blockedStatusNames: ["Blocked", "Impediment"] },
      }).preferences.blockedStatusNames,
    ).toEqual(["Blocked", "Impediment"]);

    expect(() =>
      validateWidgetConfigInput({
        boardId: "42",
        enabledProviders: [],
        preferences: { blockedStatusNames: ["Blocked", "blocked"] },
      }),
    ).toThrow("must not contain duplicates");
    expect(() =>
      validateWidgetConfigInput({
        boardId: "42",
        enabledProviders: [],
        preferences: { blockedStatusNames: [" "] },
      }),
    ).toThrow("blockedStatusNames");
  });
});

describe("widget configuration persistence", () => {
  it.skipIf(!process.env.DATABASE_URL)(
    "runs migrations idempotently and scopes records by installation and widget",
    async () => {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      const installationId = randomUUID();
      const store = new WidgetConfigStore(pool);

      try {
        await runMigrations(pool);
        await runMigrations(pool);

        const first = await store.save(installationId, "macro:one", {
          boardId: "42",
          enabledProviders: ["openai"],
          preferences: {
            showStoryPoints: true,
            estimateFieldId: "customfield_10001",
            blockedStatusNames: ["Blocked"],
          },
        });
        const second = await store.save(installationId, "macro:two", {
          boardId: "84",
          enabledProviders: ["anthropic"],
        });

        expect(await store.get(installationId, "macro:one")).toEqual(first);
        expect(await store.get(installationId, "macro:two")).toEqual(second);
        expect(await store.get(randomUUID(), "macro:one")).toBeUndefined();

        const migrationRows = await pool.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM schema_migrations WHERE name = ANY($1)",
          [["001_widget_config.sql", "002_blocked_status_mapping.sql"]],
        );
        expect(migrationRows.rows[0]?.count).toBe("2");
        await store.deleteInstallation(installationId);
        expect(await store.get(installationId, "macro:one")).toBeUndefined();
        expect(await store.get(installationId, "macro:two")).toBeUndefined();
      } finally {
        await pool.query(
          "DELETE FROM installations WHERE installation_id = $1",
          [installationId],
        );
        await pool.end();
      }
    },
  );
});
