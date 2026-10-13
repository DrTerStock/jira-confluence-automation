import { useEffect, useState } from "react";
import { BurndownChart } from "./components/BurndownChart";
import { BlockerPanel } from "./components/BlockerPanel";
import { ProviderReadinessPanel } from "./components/ProviderReadinessPanel";
import { SourceStatus } from "./components/SourceStatus";
import { SprintPanel } from "./components/SprintPanel";
import { UsagePanel } from "./components/UsagePanel";
import type {
  ProviderReadiness,
  SprintReport,
  UsageReport,
} from "../../shared/types/dashboard";
import {
  applyDashboardRefresh,
  createDashboardRefreshState,
  refreshDashboard,
  type DashboardRefreshScope,
  dashboardStatus,
  markDashboardStale,
} from "./api/dashboardRefresh";

export default function App({
  sprintReport,
  usageReport,
  isAdmin = false,
  providerReadiness,
  refreshScope,
  sprintOptions,
  selectedSprintId,
  onSprintChange,
  boardLabel,
}: {
  sprintReport?: SprintReport;
  usageReport?: UsageReport;
  isAdmin?: boolean;
  providerReadiness?: ProviderReadiness[];
  refreshScope?: DashboardRefreshScope;
  sprintOptions?: { id: string; name: string; state?: string }[];
  selectedSprintId?: string;
  onSprintChange?: (id: string) => void;
  boardLabel?: string;
} = {}) {
  const [refreshState, setRefreshState] = useState(() =>
    createDashboardRefreshState(sprintReport, usageReport),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  async function handleRefresh() {
    if (!refreshScope || isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    try {
      const result = await refreshDashboard(refreshScope);
      setRefreshState((previous) =>
        markDashboardStale(applyDashboardRefresh(previous, result)),
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    if (!refreshScope) return;
    let cancelled = false;
    const controller = new AbortController();
    setIsRefreshing(true);
    void refreshDashboard(refreshScope, fetch, {
      bypassCache: false,
      signal: controller.signal,
    })
      .then((result) => {
        if (!cancelled)
          setRefreshState((previous) =>
            markDashboardStale(applyDashboardRefresh(previous, result)),
          );
      })
      .finally(() => {
        if (!cancelled) setIsRefreshing(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refreshScope]);

  useEffect(() => {
    const timer = setInterval(
      () => setRefreshState((previous) => markDashboardStale(previous)),
      60_000,
    );
    return () => clearInterval(timer);
  }, []);

  const jiraFailure = refreshState.failures.find(
    (failure) => failure.source === "jira",
  );
  const jiraOld =
    !!refreshState.sprintReport &&
    Date.now() - Date.parse(refreshState.sprintReport.source.retrievedAt) >=
      30 * 60_000;
  const jiraStatus = isRefreshing
    ? ("loading" as const)
    : jiraFailure && !refreshState.sprintReport
      ? [401, 403].includes(jiraFailure.status ?? 0)
        ? ("permission_denied" as const)
        : jiraFailure.status === 429
          ? ("rate_limited" as const)
          : ("failed" as const)
      : jiraFailure || jiraOld
        ? ("stale" as const)
        : refreshState.sprintReport?.source.status === "partial"
          ? ("partial" as const)
          : undefined;
  const providerProblems =
    refreshState.usageReport?.sources.filter(
      (source) => !["success", "empty"].includes(source.status),
    ) ?? [];
  const failedSourceIds = [
    ...new Set(refreshState.failures.map(({ source }) => source)),
  ];
  const failedSources = failedSourceIds.map((source) =>
    source === "jira" ? "Jira" : "provider usage",
  );
  const staleSourceTimes = failedSourceIds
    .map((source) => {
      const timestamp = refreshState.lastSuccessfulAtBySource[source];
      return timestamp
        ? `${source === "jira" ? "Jira" : "Provider usage"} last succeeded at ${timestamp}.`
        : undefined;
    })
    .filter((message): message is string => message !== undefined);
  const staleProviderMessages = (refreshState.usageReport?.sources ?? [])
    .filter(({ status }) => status === "stale")
    .map(
      ({ id, lastSuccessfulAt }) =>
        `${providerLabel(id)} last succeeded at ${lastSuccessfulAt ?? "an unknown time"}.`,
    );
  const correlationIds = [
    ...new Set(
      refreshState.failures
        .map(({ correlationId }) => correlationId)
        .filter((correlationId): correlationId is string => !!correlationId),
    ),
  ];
  const refreshStatus = isRefreshing
    ? "loading"
    : dashboardStatus(refreshState);
  const refreshMessage = isRefreshing
    ? "Refreshing dashboard sources."
    : refreshState.failures.length > 0
      ? [
          `Refresh failed for ${failedSources.join(" and ")}.`,
          refreshState.stale && staleSourceTimes.length > 0
            ? `Showing the retained data. ${staleSourceTimes.join(" ")}`
            : "No earlier successful data was replaced.",
          ...refreshState.failures.map(
            (failure) =>
              (failure.message ??
                (failure.status === 429
                  ? "Rate limited. Try again later."
                  : [401, 403].includes(failure.status ?? 0)
                    ? "Permission denied. Verify your access."
                    : "Try refreshing again.")) +
              (typeof failure.retryAfterSeconds === "number" &&
              Number.isFinite(failure.retryAfterSeconds) &&
              failure.retryAfterSeconds >= 0
                ? ` Retry after ${failure.retryAfterSeconds} seconds.`
                : ""),
          ),
          ...(correlationIds.length > 0
            ? [`Reference ${correlationIds.join(", ")}.`]
            : []),
        ].join(" ")
      : providerProblems.length > 0 && staleProviderMessages.length === 0
        ? `Incomplete provider reporting: ${providerProblems.map((source) => providerLabel(source.id)).join(", ")}. See each source below.`
        : staleProviderMessages.length > 0
          ? `Showing retained provider data. ${staleProviderMessages.join(" ")}`
          : refreshState.stale
            ? `Showing last successful dashboard data from ${refreshState.lastSuccessfulAt ?? "an unknown time"}.`
            : refreshState.lastSuccessfulAt
              ? `Last successful refresh: ${refreshState.lastSuccessfulAt}.`
              : "Configure a board and reporting sources to load dashboard data.";

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="eyebrow">Confluence project dashboard</p>
          <h1>Jira Sprint Dashboard</h1>
          {boardLabel && <p>{boardLabel}</p>}
          <p>
            Progress and organization AI usage, with source coverage made clear.
          </p>
        </div>
        <button
          aria-busy={isRefreshing}
          className="refresh-button"
          disabled={!refreshScope || isRefreshing}
          onClick={() => void handleRefresh()}
          type="button"
        >
          {isRefreshing
            ? "Refreshing..."
            : refreshScope
              ? "Refresh dashboard"
              : "Refresh unavailable"}
        </button>
      </header>

      <SourceStatus status={refreshStatus} message={refreshMessage} />

      <div className="dashboard__grid">
        <SprintPanel
          report={refreshState.sprintReport}
          statusOverride={jiraStatus}
          errorMessage={jiraFailure?.message}
          sprintOptions={sprintOptions}
          selectedSprintId={selectedSprintId}
          onSprintChange={onSprintChange}
        />
        <BlockerPanel
          blockers={refreshState.sprintReport?.blockers}
          statusOverride={jiraStatus}
        />
        <BurndownChart history={refreshState.sprintReport?.burndown} />
        <UsagePanel report={refreshState.usageReport} loading={isRefreshing} />
        {isAdmin && <ProviderReadinessPanel sources={providerReadiness} />}
      </div>

      <footer className="dashboard__footer">
        Source values are not shown as zero when their status is unknown.
      </footer>
    </main>
  );
}

function providerLabel(providerId: ProviderReadiness["providerId"]): string {
  switch (providerId) {
    case "github_copilot":
      return "GitHub Copilot";
    case "openai":
      return "OpenAI";
    case "anthropic":
      return "Anthropic";
  }
}
