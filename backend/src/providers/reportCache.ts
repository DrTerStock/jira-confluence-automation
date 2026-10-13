import type {
  ProviderId,
  ProviderUsageSource,
  ReportingPeriod,
  UsageReport,
} from "../../../shared/types/dashboard.js";

import { RequestWork } from "../requestWork.js";

export const REPORT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const PROVIDER_REPORT_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export interface CachedSourceMetadata {
  sourceId: ProviderId;
  requestedPeriod: ReportingPeriod;
  actualPeriod?: ReportingPeriod;
  retrievedAt: string;
  completeness: "complete" | "partial";
}

export interface CachedUsageReport {
  report: UsageReport;
  metadata: {
    installationId: string;
    widgetInstanceKey: string;
    requestedPeriod: ReportingPeriod;
    retrievedAt: string;
    completeness: "complete" | "partial";
    sources: CachedSourceMetadata[];
  };
  expiresAt: string;
}

interface CacheEntry extends CachedUsageReport {
  installationId: string;
  storedAt: number;
  expiresAtMs: number;
}

export class ProviderUsageReportCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly work = new RequestWork();
  private revision = 0;

  get configurationRevision(): number {
    return this.revision;
  }

  purgeWidget(installationId: string, widgetInstanceKey: string): void {
    this.revision += 1;
    for (const [key, entry] of this.entries) {
      if (
        entry.installationId === installationId &&
        entry.metadata.widgetInstanceKey === widgetInstanceKey
      )
        this.delete(key);
    }
  }

  run(
    key: string,
    installationId: string,
    retrieve: () => Promise<UsageReport>,
  ): Promise<UsageReport> {
    return this.work.run(key, installationId, retrieve);
  }

  private readonly removedInstallations = new Set<string>();

  isInstallationRemoved(installationId: string): boolean {
    return this.removedInstallations.has(installationId);
  }

  dispose(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.entries.clear();
  }

  constructor(
    private readonly now: () => number = Date.now,
    private readonly ttlMs = REPORT_CACHE_TTL_MS,
    private readonly maxEntries = 500,
  ) {}

  get(
    key: string,
    maxAgeMs = PROVIDER_REPORT_MAX_AGE_MS,
  ): CachedUsageReport | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    const currentTime = this.now();
    if (entry.expiresAtMs <= currentTime) {
      this.delete(key);
      return undefined;
    }
    if (currentTime - entry.storedAt > maxAgeMs) {
      return undefined;
    }

    this.entries.delete(key);
    this.entries.set(key, entry);
    return {
      report: structuredClone(entry.report),
      metadata: structuredClone(entry.metadata),
      expiresAt: entry.expiresAt,
    };
  }

  set(
    key: string,
    installationId: string,
    widgetInstanceKey: string,
    report: UsageReport,
    retrievedAt: string,
  ): void {
    if (this.isInstallationRemoved(installationId)) return;
    const storedAt = this.now();
    const expiresAtMs = storedAt + this.ttlMs;
    const sources = report.sources.map((source) =>
      cacheSourceMetadata(source, retrievedAt),
    );
    const completeness = sources.every(
      (source) => source.completeness === "complete",
    )
      ? "complete"
      : "partial";
    const entry: CacheEntry = {
      installationId,
      storedAt,
      expiresAtMs,
      expiresAt: new Date(expiresAtMs).toISOString(),
      report,
      metadata: {
        installationId,
        widgetInstanceKey,
        requestedPeriod: report.requestedPeriod,
        retrievedAt,
        completeness,
        sources,
      },
    };

    this.delete(key);
    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.delete(oldestKey);
    }
    this.entries.set(key, structuredClone(entry));
    const timer = setTimeout(() => this.delete(key), this.ttlMs);
    timer.unref();
    this.timers.set(key, timer);
  }

  delete(key: string): void {
    this.entries.delete(key);
    const timer = this.timers.get(key);
    if (timer) clearTimeout(timer);
    this.timers.delete(key);
  }

  purgeInstallation(installationId: string): void {
    this.removedInstallations.add(installationId);
    for (const [key, entry] of this.entries) {
      if (entry.installationId === installationId) {
        this.delete(key);
      }
    }
  }
}

export function isCacheableUsageReport(report: UsageReport): boolean {
  return (
    report.sources.length > 0 &&
    report.sources.every(
      ({ status }) => status === "success" || status === "empty",
    )
  );
}

function cacheSourceMetadata(
  source: ProviderUsageSource,
  retrievedAt: string,
): CachedSourceMetadata {
  const completeness =
    source.status === "success" || source.status === "empty"
      ? "complete"
      : "partial";
  return {
    sourceId: source.id,
    requestedPeriod: source.requestedPeriod,
    ...(source.actualPeriod && { actualPeriod: source.actualPeriod }),
    retrievedAt: source.lastSuccessfulAt ?? retrievedAt,
    completeness,
  };
}
