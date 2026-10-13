import type { Pool } from "pg";

export const CURRENT_WIDGET_CONFIG_VERSION = 1;
export const CONFIGURABLE_PROVIDERS = [
  "github_copilot",
  "openai",
  "anthropic",
] as const;

export type ConfigurableProvider = (typeof CONFIGURABLE_PROVIDERS)[number];

export interface WidgetPreferences {
  showStoryPoints?: boolean;
  estimateFieldId?: string;
  blockedStatusNames?: string[];
}

export interface WidgetConfig {
  schemaVersion: typeof CURRENT_WIDGET_CONFIG_VERSION;
  boardId: string;
  enabledProviders: ConfigurableProvider[];
  preferences: WidgetPreferences;
}

export interface WidgetConfigInput {
  boardId: string;
  enabledProviders: ConfigurableProvider[];
  preferences?: WidgetPreferences;
  schemaVersion?: number;
}

const widgetKeyPattern = /^[A-Za-z0-9._:-]{1,255}$/;
const identifierPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const preferenceKeys = new Set([
  "showStoryPoints",
  "estimateFieldId",
  "blockedStatusNames",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function validateWidgetConfigInput(input: unknown): WidgetConfig {
  if (!isRecord(input)) {
    throw new Error("Configuration must be an object");
  }

  const allowedKeys = new Set([
    "boardId",
    "enabledProviders",
    "preferences",
    "schemaVersion",
  ]);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) {
    throw new Error("Configuration contains unsupported fields");
  }

  if (
    input.schemaVersion !== undefined &&
    input.schemaVersion !== CURRENT_WIDGET_CONFIG_VERSION
  ) {
    throw new Error("Unsupported widget configuration schema version");
  }
  if (
    typeof input.boardId !== "string" ||
    !identifierPattern.test(input.boardId)
  ) {
    throw new Error("boardId must be a valid Jira board identifier");
  }
  if (
    !Array.isArray(input.enabledProviders) ||
    input.enabledProviders.some(
      (provider) =>
        typeof provider !== "string" ||
        !CONFIGURABLE_PROVIDERS.includes(provider as ConfigurableProvider),
    )
  ) {
    throw new Error(
      "enabledProviders must contain only supported provider identifiers",
    );
  }
  if (new Set(input.enabledProviders).size !== input.enabledProviders.length) {
    throw new Error("enabledProviders must not contain duplicates");
  }

  const preferences = input.preferences ?? {};
  if (
    !isRecord(preferences) ||
    Object.keys(preferences).some((key) => !preferenceKeys.has(key))
  ) {
    throw new Error("preferences contains unsupported fields");
  }
  if (
    preferences.showStoryPoints !== undefined &&
    typeof preferences.showStoryPoints !== "boolean"
  ) {
    throw new Error("showStoryPoints must be a boolean");
  }
  if (
    preferences.estimateFieldId !== undefined &&
    (typeof preferences.estimateFieldId !== "string" ||
      !identifierPattern.test(preferences.estimateFieldId))
  ) {
    throw new Error("estimateFieldId must be a valid field identifier");
  }
  if (
    preferences.blockedStatusNames !== undefined &&
    (!Array.isArray(preferences.blockedStatusNames) ||
      preferences.blockedStatusNames.length > 20 ||
      preferences.blockedStatusNames.some(
        (status) =>
          typeof status !== "string" ||
          status.trim() !== status ||
          status.length < 1 ||
          status.length > 100,
      ))
  ) {
    throw new Error(
      "blockedStatusNames must contain up to 20 non-empty Jira status names",
    );
  }
  if (
    Array.isArray(preferences.blockedStatusNames) &&
    new Set(
      preferences.blockedStatusNames.map((status) => status.toLowerCase()),
    ).size !== preferences.blockedStatusNames.length
  ) {
    throw new Error("blockedStatusNames must not contain duplicates");
  }

  return {
    boardId: input.boardId,
    enabledProviders: [...input.enabledProviders] as ConfigurableProvider[],
    preferences: { ...preferences } as WidgetPreferences,
    schemaVersion: CURRENT_WIDGET_CONFIG_VERSION,
  };
}

function validateScope(
  installationId: string,
  widgetInstanceKey: string,
): void {
  validateInstallationId(installationId);
  if (!widgetKeyPattern.test(widgetInstanceKey)) {
    throw new Error("widgetInstanceKey is invalid");
  }
}

function validateInstallationId(installationId: string): void {
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(installationId)) {
    throw new Error(
      "installationId must be provided from trusted platform context",
    );
  }
}

export class WidgetConfigStore {
  constructor(private readonly database: Pick<Pool, "query" | "connect">) {}

  async get(
    installationId: string,
    widgetInstanceKey: string,
  ): Promise<WidgetConfig | undefined> {
    validateScope(installationId, widgetInstanceKey);
    const result = await this.database.query<{
      schema_version: number;
      jira_board_id: string;
      enabled_providers: unknown;
      preferences: unknown;
    }>(
      `SELECT schema_version, jira_board_id, enabled_providers, preferences
       FROM widget_configs
       WHERE installation_id = $1 AND widget_instance_key = $2`,
      [installationId, widgetInstanceKey],
    );

    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    if (row.schema_version !== CURRENT_WIDGET_CONFIG_VERSION) {
      throw new Error("Stored widget configuration requires migration");
    }

    return validateWidgetConfigInput({
      boardId: row.jira_board_id,
      enabledProviders: row.enabled_providers,
      preferences: row.preferences,
      schemaVersion: row.schema_version,
    });
  }

  async save(
    installationId: string,
    widgetInstanceKey: string,
    input: unknown,
  ): Promise<WidgetConfig> {
    validateScope(installationId, widgetInstanceKey);
    const config = validateWidgetConfigInput(input);
    const client = await this.database.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO installations (installation_id)
         VALUES ($1)
         ON CONFLICT (installation_id) DO NOTHING`,
        [installationId],
      );
      await client.query(
        `INSERT INTO widget_configs (
           installation_id,
           widget_instance_key,
           schema_version,
           jira_board_id,
           enabled_providers,
           preferences,
           updated_at
         )
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, now())
         ON CONFLICT (installation_id, widget_instance_key)
         DO UPDATE SET
           schema_version = EXCLUDED.schema_version,
           jira_board_id = EXCLUDED.jira_board_id,
           enabled_providers = EXCLUDED.enabled_providers,
           preferences = EXCLUDED.preferences,
           updated_at = now()`,
        [
          installationId,
          widgetInstanceKey,
          config.schemaVersion,
          config.boardId,
          JSON.stringify(config.enabledProviders),
          JSON.stringify(config.preferences),
        ],
      );
      await client.query("COMMIT");
      return config;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteInstallation(installationId: string): Promise<void> {
    validateInstallationId(installationId);
    await this.database.query(
      "DELETE FROM installations WHERE installation_id = $1",
      [installationId],
    );
  }
}
