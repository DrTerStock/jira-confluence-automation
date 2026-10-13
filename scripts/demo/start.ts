import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { createServer } from "vite";
import { createApp } from "../../backend/src/server.js";
import { runMigrations } from "../../backend/src/db/migrate.js";
import { WidgetConfigStore } from "../../backend/src/config/widgetConfig.js";
import { SprintObservationStore } from "../../backend/src/storage/sprintObservations.js";
import { JiraClient } from "../../backend/src/jira/client.js";
import { PROVIDER_IDS } from "../../backend/src/providers/readiness.js";
import {
  ProviderUsageService,
  ProviderUsageError,
  type ProviderUsageAdapter,
} from "../../backend/src/providers/usage.js";

// Deliberately separate from production startup. No real upstream calls or secrets.
if (process.env.NODE_ENV === "production")
  throw new Error("Mock demo cannot run in production");
dotenv.config({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });
const connectionString =
  process.env.DATABASE_URL ??
  "postgresql://dashboard:dashboard@127.0.0.1:5432/dashboard";
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(connectionString).hostname,
  )
)
  throw new Error("Mock demo requires a local PostgreSQL database");
const pool = new Pool({ connectionString });
const configs = new WidgetConfigStore(pool);
const installationId = `mock-walkthrough-${randomUUID()}`;
const initialConfig = {
  boardId: "12",
  enabledProviders: PROVIDER_IDS,
  preferences: { blockedStatusNames: ["Blocked"] },
};
await runMigrations(pool);
await configs.save(installationId, "widget-1", initialConfig);
await configs.save(installationId, "widget-2", {
  ...initialConfig,
  boardId: "13",
  enabledProviders: ["openai"],
});
let scenario = "success";
const roles = new Set(["admin", "editor", "viewer", "denied"]);
const scenarios = new Set([
  "success",
  "partial",
  "jira-denied",
  "jira-rate",
  "empty",
  "stale",
  "scale",
]);
function cookieValue(cookie: string, name: string) {
  return cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
const boards = [
  { id: 12, name: "Prototype team", type: "scrum" },
  { id: 13, name: "Independent team", type: "scrum" },
];
const sprints = (boardId: number) => [
  {
    id: boardId === 12 ? 34 : 44,
    name: "Current sprint",
    state: "active",
    originBoardId: boardId,
    startDate: "2026-10-12T09:00:00Z",
    endDate: "2026-10-26T17:00:00Z",
  },
  {
    id: boardId === 12 ? 33 : 43,
    name: "Previous sprint",
    state: "closed",
    originBoardId: boardId,
    startDate: "2026-09-28T09:00:00Z",
    endDate: "2026-10-09T17:00:00Z",
  },
];
function issue(
  id: number,
  type: string,
  status: string,
  category: string,
  estimate?: number,
) {
  return {
    id: String(id),
    key: `DEMO-${id}`,
    fields: {
      summary: `Synthetic ${type.toLowerCase()} ${id}`,
      issuetype: { name: type, subtask: type === "Sub-task" },
      status: { name: status, statusCategory: { key: category } },
      assignee: { displayName: "Demo teammate" },
      ...(estimate !== undefined && { customfield_10001: estimate }),
    },
  };
}
const jira = new JiraClient("https://jira.example.invalid", async (input) => {
  const url = new URL(String(input));
  const path = url.pathname;
  if (scenario === "jira-denied" && path.includes("/sprint/"))
    return new Response(null, { status: 403 });
  if (scenario === "jira-rate" && path.includes("/sprint/"))
    return new Response(null, {
      status: 429,
      headers: { "Retry-After": "10" },
    });
  if (path.endsWith("/configuration"))
    return Response.json({
      estimation: { field: { fieldId: "customfield_10001" } },
    });
  if (path.endsWith("/issue")) {
    const all =
      scenario === "scale"
        ? Array.from({ length: 500 }, (_, i) =>
            issue(
              i + 1,
              ["Story", "Task", "Bug"][i % 3],
              i % 2 ? "In Progress" : "Done",
              i % 2 ? "indeterminate" : "done",
              2,
            ),
          )
        : [
            issue(1, "Story", "Done", "done", 5),
            issue(2, "Task", "Blocked", "indeterminate", 3),
            issue(3, "Bug", "To Do", "new"),
            issue(4, "Epic", "Done", "done", 20),
            issue(5, "Sub-task", "Done", "done", 1),
          ];
    const startAt = Number(url.searchParams.get("startAt"));
    const maxResults = Number(url.searchParams.get("maxResults"));
    return Response.json({
      issues: all.slice(startAt, startAt + maxResults),
      startAt,
      maxResults,
      total: all.length,
    });
  }
  if (/\/board\/\d+\/sprint$/.test(path)) {
    const boardId = Number(path.split("/").at(-2));
    return Response.json({
      values: sprints(boardId),
      startAt: 0,
      maxResults: 50,
      total: 2,
      isLast: true,
    });
  }
  if (/\/sprint\/\d+$/.test(path)) {
    const sprintId = Number(path.split("/").at(-1));
    const boardId = sprintId >= 40 ? 13 : 12;
    return Response.json(
      sprints(boardId).find((sprint) => sprint.id === sprintId),
    );
  }
  if (path.endsWith("/board"))
    return Response.json({
      values: boards,
      startAt: 0,
      maxResults: 50,
      total: 2,
      isLast: true,
    });
  const board = boards.find(({ id }) => String(id) === path.split("/").at(-1));
  return board ? Response.json(board) : new Response(null, { status: 404 });
});
const adapters: ProviderUsageAdapter[] = PROVIDER_IDS.map((providerId) => ({
  providerId,
  fetchUsage: async (_credential, period) => {
    if (providerId === "anthropic" && scenario === "partial")
      throw new ProviderUsageError(
        "failed",
        "demo_provider_failure",
        "Synthetic Anthropic failure; other providers remain available.",
        true,
      );
    const names =
      providerId === "github_copilot"
        ? [
            "user_initiated_interaction_count",
            "code_generation_activity_count",
            "code_acceptance_activity_count",
          ]
        : providerId === "openai"
          ? ["input_tokens", "output_tokens", "model_requests"]
          : [
              "uncached_input_tokens",
              "cache_read_input_tokens",
              "cache_creation.ephemeral_1h_input_tokens",
              "cache_creation.ephemeral_5m_input_tokens",
              "output_tokens",
            ];
    return {
      id: providerId,
      status: scenario === "empty" ? "empty" : "success",
      requestedPeriod: period,
      actualPeriod: period,
      lastSuccessfulAt: new Date(
        Date.now() - (scenario === "stale" ? 7 * 60 * 60_000 : 0),
      ).toISOString(),
      metrics:
        scenario === "empty"
          ? []
          : names.map((name) => ({
              name,
              value:
                providerId === "openai" && name === "output_tokens"
                  ? "0"
                  : "42",
              unit:
                providerId === "github_copilot"
                  ? "events"
                  : name === "model_requests"
                    ? "requests"
                    : "tokens",
              currency: null,
              kind: "reported",
            })),
      unsupportedMetrics: [],
    };
  },
}));
const app = createApp(pool, {
  resolveViewerContext: (request) => {
    const cookie = request.headers.cookie ?? "";
    const roleValue = cookieValue(cookie, "demo_role") ?? "admin";
    const role = roles.has(roleValue) ? roleValue : "viewer";
    const selectedScenario = cookieValue(cookie, "demo_scenario") ?? "success";
    scenario = scenarios.has(selectedScenario) ? selectedScenario : "success";
    if (role === "denied") return { status: "forbidden" };
    const widget = cookieValue(cookie, "demo_widget");
    return {
      status: "authenticated",
      viewer: {
        installationId,
        userId: `mock-${role}`,
        pageId: "mock-page",
        widgetInstanceKey:
          widget === "widget-2"
            ? "widget-2"
            : widget === "new-widget"
              ? "new-widget"
              : "widget-1",
        isAdmin: role === "admin",
        canEdit: role === "editor",
        jiraAccessToken: "synthetic-viewer-token",
      },
    };
  },
  widgetConfigStore: configs,
  jiraClient: jira,
  sprintObservationStore: new SprintObservationStore(pool),
  providerUsageService: new ProviderUsageService(
    { getCredential: async () => "synthetic-provider-token" },
    adapters,
  ),
  providerReadinessService: {
    list: async () =>
      PROVIDER_IDS.map((providerId) => ({
        providerId,
        status: "ready",
        diagnosticCode: "provider_access_verified",
        checkedAt: new Date().toISOString(),
      })),
  },
});
const api = app.listen(4100, "127.0.0.1");
const toolbar = `<aside style="padding:12px;background:#fff4d6;color:#181818;border:2px solid #b97800"><strong>Mock demo — all Jira/provider data are synthetic; PostgreSQL persistence is real.</strong><fieldset id="demo-controls"><legend>Walkthrough controls (demo only)</legend><label>Demo role <select id="demo-role"><option>admin</option><option>editor</option><option>viewer</option><option>denied</option></select></label> <label>Demo widget <select id="demo-widget"><option>widget-1</option><option>widget-2</option><option>new-widget</option></select></label> <label>Demo scenario <select id="demo-scenario">${[...scenarios].map((value) => `<option>${value}</option>`).join("")}</select></label> <button id="demo-apply">Apply context / reload</button><p>Scenario changes apply on the next dashboard refresh. Reload after role/widget changes.</p></fieldset></aside><script type="module">for (const key of ['role','widget','scenario']) { const control=document.getElementById('demo-'+key); control.value=document.cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith('demo_'+key+'='))?.split('=')[1] ?? (key==='role'?'admin':key==='widget'?'widget-1':'success'); control.addEventListener('change',()=>{document.cookie='demo_'+key+'='+control.value+'; Path=/; SameSite=Strict';}); } document.getElementById('demo-apply').addEventListener('click',()=>location.reload());</script>`;
const frontend = await createServer({
  root: fileURLToPath(new URL("../../frontend", import.meta.url)),
  cacheDir: fileURLToPath(
    new URL("../../frontend/node_modules/.vite-demo", import.meta.url),
  ),
  configFile: fileURLToPath(
    new URL("../../frontend/vite.config.ts", import.meta.url),
  ),
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: { "/api": "http://127.0.0.1:4100" },
  },
  plugins: [
    {
      name: "explicit-mock-banner",
      transformIndexHtml: (html) =>
        html.replace('<div id="root">', toolbar + '<div id="root">'),
    },
  ],
});
await frontend.listen();
console.log(
  "Mock walkthrough: http://127.0.0.1:5174 (API: 4100). No live integrations are verified.",
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await frontend.close();
  await new Promise<void>((resolve) => api.close(() => resolve()));
  await configs.deleteInstallation(installationId);
  await pool.end();
  process.exit(0);
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
