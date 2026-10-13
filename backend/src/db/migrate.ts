import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

interface MigrationClient {
  query: (
    sql: string,
    values?: unknown[],
  ) => Promise<{ rows: Array<{ name: string }> }>;
  release: () => void;
}

interface MigrationPool {
  connect: () => Promise<MigrationClient>;
}

const migrationDirectory = fileURLToPath(
  new URL("../../migrations/", import.meta.url),
);

export async function runMigrations(pool: MigrationPool): Promise<void> {
  const client = await pool.connect();
  const lockId = 45190231;

  try {
    await client.query("SELECT pg_advisory_lock($1)", [lockId]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const migrationFiles = (await readdir(migrationDirectory))
      .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/.test(name))
      .sort();

    for (const name of migrationFiles) {
      const { rows } = await client.query(
        "SELECT name FROM schema_migrations WHERE name = $1",
        [name],
      );
      if (rows.length > 0) {
        continue;
      }

      const sql = await readFile(
        new URL(`../../migrations/${name}`, import.meta.url),
        "utf8",
      );

      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
          name,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [lockId]);
    client.release();
  }
}
