import dotenv from "dotenv";
import { Pool } from "pg";
import { fileURLToPath } from "node:url";
import { runMigrations } from "./db/migrate.js";
import { JiraClient } from "./jira/client.js";
import { WidgetConfigStore } from "./config/widgetConfig.js";
import {
  EnvironmentProviderSecretStore,
  ProviderReadinessService,
} from "./providers/readiness.js";
import {
  AnthropicUsageAdapter,
  GitHubCopilotUsageAdapter,
  OpenAIUsageAdapter,
} from "./providers/adapters.js";
import { createProviderReadinessProbe } from "./providers/probe.js";
import { ProviderUsageService } from "./providers/usage.js";
import { loadHostIntegration } from "./auth/hostIntegration.js";
import { SprintObservationStore } from "./storage/sprintObservations.js";
import { createApp } from "./server.js";

dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const jiraClient = process.env.JIRA_BASE_URL
  ? new JiraClient(process.env.JIRA_BASE_URL)
  : undefined;
const widgetConfigStore = new WidgetConfigStore(pool);
const providerSecretStore = new EnvironmentProviderSecretStore();
const providerAdapters = [
  new GitHubCopilotUsageAdapter(process.env.GITHUB_ENTERPRISE_SLUG),
  new OpenAIUsageAdapter(),
  new AnthropicUsageAdapter(),
];
const providerReadinessService = new ProviderReadinessService(
  providerSecretStore,
  Object.fromEntries(
    providerAdapters.map((adapter) => [
      adapter.providerId,
      createProviderReadinessProbe(adapter),
    ]),
  ),
);
const providerUsageService = new ProviderUsageService(
  providerSecretStore,
  providerAdapters,
);

try {
  await runMigrations(pool);
  const host = await loadHostIntegration(process.env.DASHBOARD_HOST_MODULE);
  const sprintObservationStore = new SprintObservationStore(pool);
  await sprintObservationStore.expire();
  const retentionTimer = setInterval(() => {
    void sprintObservationStore
      .expire()
      .catch(() => console.warn("Sprint observation expiry failed"));
  }, 60 * 60_000);
  retentionTimer.unref();
  const app = createApp(pool, {
    resolveViewerContext: host?.resolveViewerContext,
    sprintObservationStore,
    requestLogger: (entry) => console.info("Dashboard request", entry),
    jiraClient,
    widgetConfigStore,
    providerReadinessService,
    providerUsageService,
  });
  await host?.registerInstallationRemoval?.((installationId) =>
    app.locals.purgeInstallationData(installationId),
  );
  app.listen(port, () => {
    console.log(`Dashboard API listening on port ${port}`);
  });
} catch (error) {
  await pool.end();
  console.error("Dashboard API startup failed", {
    errorName: error instanceof Error ? error.name : "UnknownError",
  });
  process.exitCode = 1;
}
