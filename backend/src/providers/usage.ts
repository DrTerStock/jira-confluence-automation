import type {
  ProviderId,
  ProviderUsageSource,
  ProviderUsageStatus,
  ReportingPeriod,
  UsageReport,
} from "../../../shared/types/dashboard.js";
import type { ProviderSecretStore } from "./readiness.js";
import { createUsageReport } from "./metricPolicy.js";

export const MAX_REPORTING_PERIOD_DAYS = 31;

export interface ProviderUsageAdapter {
  readonly providerId: ProviderId;
  fetchUsage(
    credential: string,
    period: ReportingPeriod,
  ): Promise<ProviderUsageSource>;
}

export class ProviderUsageError extends Error {
  constructor(
    readonly status: ProviderUsageStatus,
    readonly code: string,
    readonly userMessage: string,
    readonly retryable: boolean,
  ) {
    super(userMessage);
    this.name = "ProviderUsageError";
  }
}

export class ProviderUsageConfigurationError extends Error {
  constructor(readonly providerId: ProviderId) {
    super(`Provider ${providerId} is not configured for usage reporting`);
    this.name = "ProviderUsageConfigurationError";
  }
}

export class ProviderUsageService {
  private readonly adapters: Partial<Record<ProviderId, ProviderUsageAdapter>>;

  constructor(
    private readonly secretStore: ProviderSecretStore,
    adapters: ProviderUsageAdapter[],
  ) {
    this.adapters = Object.fromEntries(
      adapters.map((adapter) => [adapter.providerId, adapter]),
    );
  }

  async getReport(
    providerIds: ProviderId[],
    requestedPeriod: ReportingPeriod,
    installationId?: string,
  ): Promise<UsageReport> {
    const period = validateReportingPeriod(requestedPeriod);
    const uniqueIds = [...new Set(providerIds)];
    const sources = await Promise.all(
      uniqueIds.map(async (providerId) => {
        try {
          const adapter = this.adapters[providerId];
          const credential = await this.secretStore.getCredential(
            providerId,
            installationId,
          );
          if (!adapter || !credential) {
            return errorSource(
              providerId,
              period,
              new ProviderUsageError(
                "unavailable",
                "provider_not_configured",
                "This provider is not configured for this installation.",
                false,
              ),
            );
          }
          return await adapter.fetchUsage(credential, period);
        } catch (error) {
          return errorSource(
            providerId,
            period,
            error instanceof ProviderUsageError
              ? error
              : new ProviderUsageError(
                  "failed",
                  "provider_request_failed",
                  "The provider report could not be retrieved.",
                  true,
                ),
          );
        }
      }),
    );

    return createUsageReport(period, sources);
  }
}

export function validateReportingPeriod(value: unknown): ReportingPeriod {
  if (
    typeof value !== "object" ||
    value === null ||
    !("from" in value) ||
    !("to" in value) ||
    typeof value.from !== "string" ||
    typeof value.to !== "string" ||
    !isCalendarDate(value.from) ||
    !isCalendarDate(value.to)
  ) {
    throw new Error("Reporting period must use valid YYYY-MM-DD dates");
  }

  const fromTime = Date.parse(`${value.from}T00:00:00Z`);
  const toTime = Date.parse(`${value.to}T00:00:00Z`);
  const dayCount = (toTime - fromTime) / 86_400_000 + 1;
  if (dayCount < 1) {
    throw new Error("Reporting period end must not precede its start");
  }
  if (dayCount > MAX_REPORTING_PERIOD_DAYS) {
    throw new Error(
      `Reporting periods cannot exceed ${MAX_REPORTING_PERIOD_DAYS} days`,
    );
  }
  return { from: value.from, to: value.to };
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function errorSource(
  id: ProviderId,
  requestedPeriod: ReportingPeriod,
  error: ProviderUsageError,
): ProviderUsageSource {
  return {
    id,
    status: error.status,
    requestedPeriod,
    metrics: [],
    unsupportedMetrics: [],
    error: {
      code: error.code,
      message: error.userMessage,
      retryable: error.retryable,
    },
  };
}

export function dateRangeDays(period: ReportingPeriod): string[] {
  const dates: string[] = [];
  const end = Date.parse(`${period.to}T00:00:00Z`);
  for (
    let time = Date.parse(`${period.from}T00:00:00Z`);
    time <= end;
    time += 86_400_000
  ) {
    dates.push(new Date(time).toISOString().slice(0, 10));
  }
  return dates;
}
