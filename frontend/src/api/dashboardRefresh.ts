import type {
  ProviderId,
  ProviderUsageSource,
  ReportingPeriod,
  SprintReport,
  UsageReport,
} from "../../../shared/types/dashboard";

export interface DashboardRefreshScope {
  widgetId: string;
  boardId: string;
  sprintId: string;
  usagePeriod: ReportingPeriod;
  includeUsage?: boolean;
  providers?: ProviderId[];
}

export interface DashboardRefreshFailure {
  source: "jira" | "provider_usage";
  status?: number;
  correlationId?: string;
  code?: string;
  message?: string;
  retryable?: boolean;
  retryAfterSeconds?: number;
}

export interface DashboardRefreshResult {
  sprintReport?: SprintReport;
  usageReport?: UsageReport;
  failures: DashboardRefreshFailure[];
}

export interface DashboardRefreshState extends DashboardRefreshResult {
  lastSuccessfulAt?: string;
  lastSuccessfulAtBySource: Partial<
    Record<DashboardRefreshFailure["source"], string>
  >;
  stale: boolean;
}

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;
type ReportResult<T> = { value: T } | { failure: DashboardRefreshFailure };

const correlationIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function refreshDashboard(
  scope: DashboardRefreshScope,
  fetcher: Fetcher = fetch,
  options: { bypassCache?: boolean; signal?: AbortSignal } = {},
): Promise<DashboardRefreshResult> {
  const sprintPath = [
    "/api/v1/widgets/",
    encodeURIComponent(scope.widgetId),
    "/jira/boards/",
    encodeURIComponent(scope.boardId),
    "/sprints/",
    encodeURIComponent(scope.sprintId),
    "/report",
  ].join("");
  const usageQuery = new URLSearchParams({
    widgetId: scope.widgetId,
    from: scope.usagePeriod.from,
    to: scope.usagePeriod.to,
  });
  scope.providers?.forEach((id) => usageQuery.append("providers[]", id));
  const [sprintResult, usageResult] = await Promise.all([
    requestReport(fetcher, "jira", sprintPath, isSprintReport, options),
    scope.includeUsage === false
      ? Promise.resolve(undefined)
      : requestReport(
          fetcher,
          "provider_usage",
          `/api/v1/usage/report?${usageQuery}`,
          isUsageReport,
          options,
        ),
  ]);

  const failures: DashboardRefreshFailure[] = [];
  if (isFailure(sprintResult)) {
    failures.push(sprintResult.failure);
  }
  if (usageResult && isFailure(usageResult)) {
    failures.push(usageResult.failure);
  }

  return {
    ...(isSuccess(sprintResult) && { sprintReport: sprintResult.value }),
    ...(usageResult &&
      isSuccess(usageResult) && { usageReport: usageResult.value }),
    failures,
  };
}

export function createDashboardRefreshState(
  sprintReport?: SprintReport,
  usageReport?: UsageReport,
): DashboardRefreshState {
  const lastSuccessfulAtBySource: DashboardRefreshState["lastSuccessfulAtBySource"] =
    {
      ...(sprintReport?.source.retrievedAt && {
        jira: sprintReport.source.retrievedAt,
      }),
      ...(latestUsageTimestamp(usageReport) && {
        provider_usage: latestUsageTimestamp(usageReport),
      }),
    };
  return {
    ...(sprintReport && { sprintReport }),
    ...(usageReport && { usageReport }),
    lastSuccessfulAt: latestTimestamp(Object.values(lastSuccessfulAtBySource)),
    lastSuccessfulAtBySource,
    failures: [],
    stale: false,
  };
}

export function applyDashboardRefresh(
  previous: DashboardRefreshState,
  result: DashboardRefreshResult,
): DashboardRefreshState {
  const usageReport =
    result.usageReport && previous.usageReport
      ? mergeUsageReport(previous.usageReport, result.usageReport)
      : result.usageReport;
  const providerUsageStale =
    usageReport?.sources.some(({ status }) => status === "stale") ?? false;
  const failures = result.failures;
  const failedSources = new Set(failures.map(({ source }) => source));
  const jiraDenied = failures.some(
    (failure) =>
      failure.source === "jira" && [401, 403].includes(failure.status ?? 0),
  );
  const usageDenied = failures.some(
    (failure) =>
      failure.source === "provider_usage" &&
      [401, 403].includes(failure.status ?? 0),
  );
  const stale =
    (!jiraDenied &&
      failedSources.has("jira") &&
      previous.sprintReport !== undefined) ||
    (!usageDenied &&
      failedSources.has("provider_usage") &&
      previous.usageReport !== undefined) ||
    providerUsageStale;
  const lastSuccessfulAtBySource = { ...previous.lastSuccessfulAtBySource };
  if (result.sprintReport?.source.retrievedAt)
    lastSuccessfulAtBySource.jira = result.sprintReport.source.retrievedAt;
  const usageTime = latestUsageTimestamp(usageReport);
  if (usageTime) lastSuccessfulAtBySource.provider_usage = usageTime;
  if (jiraDenied) delete lastSuccessfulAtBySource.jira;
  if (usageDenied) delete lastSuccessfulAtBySource.provider_usage;

  return {
    sprintReport: jiraDenied
      ? undefined
      : (result.sprintReport ?? previous.sprintReport),
    usageReport: usageDenied
      ? undefined
      : (usageReport ?? previous.usageReport),
    lastSuccessfulAt:
      latestTimestamp(Object.values(lastSuccessfulAtBySource)) ??
      (jiraDenied || usageDenied ? undefined : previous.lastSuccessfulAt),
    lastSuccessfulAtBySource,
    failures,
    stale,
  };
}

function mergeUsageReport(
  previous: UsageReport,
  refreshed: UsageReport,
): UsageReport {
  if (
    previous.requestedPeriod.from !== refreshed.requestedPeriod.from ||
    previous.requestedPeriod.to !== refreshed.requestedPeriod.to
  ) {
    return refreshed;
  }

  const previousSources = new Map(
    previous.sources.map((source) => [source.id, source]),
  );
  return {
    ...refreshed,
    sources: refreshed.sources.map((source) => {
      const previousSource = previousSources.get(source.id);
      if (
        !previousSource?.lastSuccessfulAt ||
        previousSource.metrics.length === 0 ||
        !["unavailable", "rate_limited", "failed"].includes(source.status)
      ) {
        return source;
      }
      return {
        ...previousSource,
        status: "stale",
        requestedPeriod: refreshed.requestedPeriod,
        error: source.error,
      };
    }),
  };
}

async function requestReport<T>(
  fetcher: Fetcher,
  source: DashboardRefreshFailure["source"],
  path: string,
  isReport: (value: unknown) => value is T,
  options: { bypassCache?: boolean; signal?: AbortSignal },
): Promise<ReportResult<T>> {
  let response: Response;
  try {
    response = await fetcher(path, {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        ...(options.bypassCache !== false && { "Cache-Control": "no-cache" }),
      },
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
    });
  } catch {
    return { failure: { source } };
  }

  const correlationId = readCorrelationId(response);
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return {
      failure: {
        source,
        status: response.status,
        ...(correlationId && { correlationId }),
      },
    };
  }

  if (!response.ok || !isReport(body)) {
    return {
      failure: {
        source,
        status: response.status,
        ...(correlationId && { correlationId }),
        ...(isRecord(body) &&
          isRecord(body.error) && {
            ...(typeof body.error.code === "string" &&
              /^[a-z0-9_]{1,100}$/.test(body.error.code) && {
                code: body.error.code,
              }),
            ...(typeof body.error.message === "string" &&
              body.error.message.length <= 512 && {
                message: body.error.message,
              }),
            ...(typeof body.error.retryable === "boolean" && {
              retryable: body.error.retryable,
            }),
            ...(typeof body.error.retryAfterSeconds === "number" &&
              Number.isFinite(body.error.retryAfterSeconds) && {
                retryAfterSeconds: body.error.retryAfterSeconds,
              }),
          }),
      },
    };
  }
  return { value: body };
}

function readCorrelationId(response: Response): string | undefined {
  const header = response.headers.get("x-correlation-id");
  if (header && correlationIdPattern.test(header)) {
    return header;
  }
  return undefined;
}

function isSprintReport(value: unknown): value is SprintReport {
  return (
    isRecord(value) &&
    isRecord(value.sprint) &&
    isRecord(value.progress) &&
    isRecord(value.blockers) &&
    Array.isArray(value.issues) &&
    Array.isArray(value.groups) &&
    isRecord(value.coverage) &&
    isRecord(value.source)
  );
}

function isUsageReport(value: unknown): value is UsageReport {
  return (
    isRecord(value) &&
    isRecord(value.requestedPeriod) &&
    Array.isArray(value.sources) &&
    Array.isArray(value.compatibleTotals) &&
    value.sources.every(isProviderUsageSource)
  );
}

function isProviderUsageSource(value: unknown): value is ProviderUsageSource {
  return (
    isRecord(value) &&
    isProviderId(value.id) &&
    typeof value.status === "string" &&
    isRecord(value.requestedPeriod) &&
    Array.isArray(value.metrics) &&
    Array.isArray(value.unsupportedMetrics)
  );
}

function isProviderId(value: unknown): value is ProviderId {
  return (
    value === "github_copilot" || value === "openai" || value === "anthropic"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSuccess<T>(result: ReportResult<T>): result is { value: T } {
  return "value" in result;
}

function isFailure<T>(
  result: ReportResult<T>,
): result is { failure: DashboardRefreshFailure } {
  return "failure" in result;
}

function latestUsageTimestamp(usageReport?: UsageReport): string | undefined {
  const timestamps = [
    ...(usageReport?.sources ?? []).map(
      ({ lastSuccessfulAt }) => lastSuccessfulAt,
    ),
  ].filter(
    (timestamp): timestamp is string =>
      timestamp !== undefined && Number.isFinite(Date.parse(timestamp)),
  );
  return latestTimestamp(timestamps);
}

function latestTimestamp(
  timestamps: (string | undefined)[],
): string | undefined {
  return timestamps
    .filter(
      (timestamp): timestamp is string =>
        timestamp !== undefined && Number.isFinite(Date.parse(timestamp)),
    )
    .sort()
    .at(-1);
}

export function dashboardStatus(
  state: DashboardRefreshState,
): import("../../../shared/types/dashboard").DashboardStatus {
  if (state.stale) return "stale";
  const statuses =
    state.usageReport?.sources.map((source) => source.status) ?? [];
  const incomplete =
    state.failures.length > 0 ||
    state.sprintReport?.source.status === "partial" ||
    statuses.some((status) => !["success", "empty"].includes(status));
  const usable =
    !!state.sprintReport ||
    statuses.some((status) => ["success", "empty", "partial"].includes(status));
  if (incomplete && usable) return "partial";
  if (
    state.failures.some((f) => [401, 403].includes(f.status ?? 0)) ||
    statuses.includes("permission_denied")
  )
    return "permission_denied";
  if (
    state.failures.some((f) => f.status === 429) ||
    statuses.includes("rate_limited")
  )
    return "rate_limited";
  if (state.failures.length || statuses.includes("failed")) return "failed";
  if (usable) return "success";
  return "unavailable";
}

export function markDashboardStale(
  state: DashboardRefreshState,
  now = Date.now(),
): DashboardRefreshState {
  const old = (timestamp: string | undefined, age: number) =>
    !!timestamp && now - Date.parse(timestamp) >= age;
  const jiraStale = old(state.sprintReport?.source.retrievedAt, 30 * 60_000);
  const sources = state.usageReport?.sources.map((source) =>
    old(source.lastSuccessfulAt, 6 * 60 * 60_000) &&
    ["success", "partial", "empty"].includes(source.status)
      ? { ...source, status: "stale" as const }
      : source,
  );
  const stale =
    state.stale ||
    jiraStale ||
    !!sources?.some((source) => source.status === "stale");
  return {
    ...state,
    stale,
    ...(state.usageReport &&
      sources && {
        usageReport: {
          ...state.usageReport,
          sources,
          compatibleTotals: stale ? [] : state.usageReport.compatibleTotals,
        },
      }),
  };
}
