import { useEffect, useMemo, useState } from "react";
import App from "./App";
import {
  ConfigurationPanel,
  type EditableConfig,
} from "./components/ConfigurationPanel";
import type {
  DashboardStatus,
  ProviderReadiness,
} from "../../shared/types/dashboard";
import { SourceStatus } from "./components/SourceStatus";

type Context = {
  widgetId: string;
  isAdmin: boolean;
  canEdit: boolean;
  config: EditableConfig | null;
};
type Sprint = { id: string; name: string; state: string };

class BootstrapError extends Error {
  constructor(
    readonly status: DashboardStatus,
    message: string,
  ) {
    super(message);
  }
}
async function requireResponse(response: Response): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({}));
  const safeMessage =
    typeof body.error?.message === "string"
      ? body.error.message.slice(0, 512)
      : "Dashboard data could not be loaded. Check access and configuration, then try again.";
  const status =
    response.status === 401 || response.status === 403
      ? "permission_denied"
      : response.status === 429
        ? "rate_limited"
        : response.status === 503
          ? "unavailable"
          : "failed";
  const reference = response.headers.get("X-Correlation-ID");
  const delay = body.error?.retryAfterSeconds;
  throw new BootstrapError(
    status,
    `${safeMessage}${Number.isFinite(delay) && delay > 0 ? ` Retry after ${delay} seconds.` : ""}${reference ? ` Reference ${reference.slice(0, 128)}.` : ""}`,
  );
}

export default function Dashboard() {
  const [editing, setEditing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selectedProviders, setSelectedProviders] = useState<
    EditableConfig["enabledProviders"]
  >([]);
  const [usagePeriod, setUsagePeriod] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return { from: today, to: today };
  });
  const [context, setContext] = useState<Context>();
  const [readiness, setReadiness] = useState<ProviderReadiness[]>();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("Loading dashboard configuration.");
  const [bootstrapStatus, setBootstrapStatus] =
    useState<DashboardStatus>("loading");
  useEffect(() => {
    const controller = new AbortController();
    setMessage("Loading dashboard configuration.");
    setBootstrapStatus("loading");
    setSelected("");
    setSprints([]);
    async function load() {
      const init = {
        credentials: "same-origin" as const,
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(30_000),
        ]),
      };
      const response = await fetch("/api/v1/dashboard/context", init);
      await requireResponse(response);
      const result: Context = await response.json();
      setContext(result);
      setSelectedProviders(result.config?.enabledProviders ?? []);
      if (result.isAdmin) {
        void fetch("/api/v1/admin/sources", init)
          .then(async (readinessResponse) => {
            if (readinessResponse.ok && !controller.signal.aborted)
              setReadiness((await readinessResponse.json()).sources);
          })
          .catch(() => {
            /* The readiness panel keeps its unavailable state. */
          });
      }
      if (!result.config) {
        setBootstrapStatus("unavailable");
        setMessage(
          "A page editor must configure a Jira board and reporting sources.",
        );
        return;
      }
      const values: Sprint[] = [];
      let truncated = false;
      // Bound retrieval; preserve active and historical choices from each page.
      for (let startAt = 0; startAt < 500; startAt += 50) {
        const pageResponse = await fetch(
          `/api/v1/jira/boards/${encodeURIComponent(result.config.boardId)}/sprints?startAt=${startAt}&limit=50`,
          init,
        );
        await requireResponse(pageResponse);
        const page = await pageResponse.json();
        values.push(...page.values);
        if (startAt === 450 && !page.isLast) truncated = true;
        if (page.isLast || page.values.length < 50) break;
      }
      setSprints(values);
      setSelected(
        (values.find(({ state }) => state === "active") ?? values[0])?.id ?? "",
      );
      setBootstrapStatus(
        truncated ? "partial" : values.length ? "success" : "empty",
      );
      setMessage(
        truncated
          ? "Showing the first 500 sprints. More sprint history is available in Jira."
          : values.length
            ? ""
            : "No sprints are available for this board.",
      );
    }
    void load().catch((error) => {
      if (!controller.signal.aborted) {
        setBootstrapStatus(
          error instanceof BootstrapError ? error.status : "failed",
        );
        setMessage(
          error instanceof BootstrapError
            ? error.message
            : "Dashboard access or data is unavailable. Check configuration and permissions, then try again.",
        );
        setSelected("");
        setSprints([]);
        if (
          error instanceof BootstrapError &&
          error.status === "permission_denied"
        )
          setContext(undefined);
      }
    });
    return () => controller.abort();
  }, [revision]);
  const refreshScope = useMemo(
    () =>
      context?.config && selected
        ? {
            widgetId: context.widgetId,
            boardId: context.config.boardId,
            sprintId: selected,
            usagePeriod,
            includeUsage: selectedProviders.length > 0,
            providers: selectedProviders,
          }
        : undefined,
    [context, selected, usagePeriod, selectedProviders],
  );
  return (
    <>
      {message && <SourceStatus status={bootstrapStatus} message={message} />}
      {context?.canEdit && (
        <button type="button" onClick={() => setEditing(true)}>
          Configure dashboard
        </button>
      )}
      {editing && context?.canEdit && (
        <ConfigurationPanel
          config={context.config}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setRevision((value) => value + 1);
          }}
        />
      )}
      {!!context?.config?.enabledProviders.length && (
        <fieldset>
          <legend>Displayed AI sources</legend>
          {context.config.enabledProviders.map((id) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={selectedProviders.includes(id)}
                onChange={(event) =>
                  setSelectedProviders((previous) =>
                    event.target.checked
                      ? [...previous, id]
                      : previous.filter((value) => value !== id),
                  )
                }
              />
              {id}
            </label>
          ))}
        </fieldset>
      )}
      {context?.config && (
        <fieldset className="date-range">
          <legend>Usage reporting period</legend>
          <label>
            From
            <input
              type="date"
              value={usagePeriod.from}
              max={usagePeriod.to}
              onChange={(event) => {
                if (event.target.value)
                  setUsagePeriod((period) => ({
                    ...period,
                    from: event.target.value,
                  }));
              }}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={usagePeriod.to}
              min={usagePeriod.from}
              onChange={(event) => {
                if (event.target.value)
                  setUsagePeriod((period) => ({
                    ...period,
                    to: event.target.value,
                  }));
              }}
            />
          </label>
        </fieldset>
      )}
      <App
        key={`${context?.widgetId}:${selected}:${usagePeriod.from}:${usagePeriod.to}:${selectedProviders.join(",")}`}
        boardLabel={
          context?.config ? `Board ${context.config.boardId}` : undefined
        }
        isAdmin={context?.isAdmin}
        providerReadiness={readiness}
        sprintOptions={sprints}
        selectedSprintId={selected}
        onSprintChange={setSelected}
        refreshScope={refreshScope}
      />
    </>
  );
}
