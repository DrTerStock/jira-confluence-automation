import type {
  ProviderId,
  ProviderUsageSource,
  ReportingPeriod,
  UsageMetric,
} from "../../../shared/types/dashboard.js";
import { isIP } from "node:net";
import { fetchWithSingleRateLimitRetry } from "../httpRetry.js";
import {
  dateRangeDays,
  ProviderUsageError,
  type ProviderUsageAdapter,
} from "./usage.js";

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;
type Delay = (milliseconds: number) => Promise<void>;

const JSON_HEADERS = { Accept: "application/json" };
const MAX_PROVIDER_PAGES = 32;
const MAX_REPORT_BYTES = 2_000_000;

interface AggregatedMetrics {
  inputTokens: bigint;
  outputTokens: bigint;
  modelRequests: bigint;
}

export class OpenAIUsageAdapter implements ProviderUsageAdapter {
  readonly providerId = "openai" satisfies ProviderId;

  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly now: () => Date = () => new Date(),
    private readonly delay?: Delay,
  ) {}

  async fetchUsage(
    credential: string,
    period: ReportingPeriod,
  ): Promise<ProviderUsageSource> {
    const query = new URLSearchParams({
      start_time: String(Date.parse(`${period.from}T00:00:00Z`) / 1000),
      end_time: String(Date.parse(`${period.to}T00:00:00Z`) / 1000 + 86_400),
      bucket_width: "1d",
      limit: String(daysBetween(period)),
    });
    const metrics: AggregatedMetrics = {
      inputTokens: 0n,
      outputTokens: 0n,
      modelRequests: 0n,
    };
    let page: string | undefined;
    let hasData = false;
    let hasMetricRows = false;
    let firstBucket = Number.POSITIVE_INFINITY;
    let lastBucketEnd = 0;
    const reportedDays = new Set<string>();
    let completePagination = true;

    for (let pageNumber = 0; pageNumber < MAX_PROVIDER_PAGES; pageNumber += 1) {
      if (page) {
        query.set("page", page);
      } else {
        query.delete("page");
      }
      const response = await requestJson(
        this.fetcher,
        `https://api.openai.com/v1/organization/usage/completions?${query}`,
        { ...JSON_HEADERS, Authorization: `Bearer ${credential}` },
        "OpenAI",
        this.delay,
      );
      const body = requireRecord(response, "OpenAI");
      if (!Array.isArray(body.data) || typeof body.has_more !== "boolean") {
        throw invalidProviderResponse("OpenAI");
      }

      for (const rawBucket of body.data) {
        if (!isRecord(rawBucket) || !Array.isArray(rawBucket.results)) {
          throw invalidProviderResponse("OpenAI");
        }
        const startTime = nonnegativeInteger(rawBucket.start_time);
        const endTime = nonnegativeInteger(rawBucket.end_time);
        if (
          startTime === undefined ||
          endTime === undefined ||
          endTime <= startTime
        ) {
          throw invalidProviderResponse("OpenAI");
        }
        hasData = true;
        firstBucket = Math.min(firstBucket, startTime);
        lastBucketEnd = Math.max(lastBucketEnd, endTime);
        reportedDays.add(new Date(startTime * 1000).toISOString().slice(0, 10));
        for (const rawResult of rawBucket.results) {
          if (!isRecord(rawResult)) {
            throw invalidProviderResponse("OpenAI");
          }
          if (rawResult.object !== "organization.usage.completions.result") {
            continue;
          }
          hasMetricRows = true;
          const inputTokens = nonnegativeInteger(rawResult.input_tokens);
          const outputTokens = nonnegativeInteger(rawResult.output_tokens);
          const modelRequests = nonnegativeInteger(
            rawResult.num_model_requests,
          );
          if (
            inputTokens === undefined ||
            outputTokens === undefined ||
            modelRequests === undefined
          ) {
            throw invalidProviderResponse("OpenAI");
          }
          metrics.inputTokens += BigInt(inputTokens);
          metrics.outputTokens += BigInt(outputTokens);
          metrics.modelRequests += BigInt(modelRequests);
        }
      }

      if (!body.has_more) {
        break;
      }
      if (typeof body.next_page !== "string" || !body.next_page) {
        throw invalidProviderResponse("OpenAI");
      }
      page = body.next_page;
      if (pageNumber === MAX_PROVIDER_PAGES - 1) {
        completePagination = false;
      }
    }

    const actualPeriod = hasData
      ? {
          from: new Date(firstBucket * 1000).toISOString().slice(0, 10),
          to: new Date((lastBucketEnd - 1) * 1000).toISOString().slice(0, 10),
        }
      : undefined;
    const metricsList: UsageMetric[] = hasMetricRows
      ? [
          metric("input_tokens", metrics.inputTokens, "tokens"),
          metric("output_tokens", metrics.outputTokens, "tokens"),
          metric("model_requests", metrics.modelRequests, "requests"),
        ]
      : [];
    const completeCoverage =
      actualPeriod?.from === period.from &&
      actualPeriod.to === period.to &&
      coversRequestedDays(reportedDays, period) &&
      completePagination;
    const status = completeCoverage
      ? "success"
      : hasMetricRows || hasData
        ? "partial"
        : "empty";

    return {
      id: this.providerId,
      status,
      requestedPeriod: period,
      ...(actualPeriod && { actualPeriod }),
      lastSuccessfulAt: this.now().toISOString(),
      metrics: metricsList,
      unsupportedMetrics:
        hasData && !hasMetricRows
          ? ["input_tokens", "output_tokens", "model_requests"]
          : [],
      ...(!completeCoverage &&
        hasData && {
          error: {
            code: "period_truncated",
            message:
              "OpenAI returned data for only part of the requested period.",
            retryable: false,
          },
        }),
    };
  }
}

export class AnthropicUsageAdapter implements ProviderUsageAdapter {
  readonly providerId = "anthropic" satisfies ProviderId;

  constructor(
    private readonly fetcher: Fetcher = fetch,
    private readonly now: () => Date = () => new Date(),
    private readonly delay?: Delay,
  ) {}

  async fetchUsage(
    credential: string,
    period: ReportingPeriod,
  ): Promise<ProviderUsageSource> {
    const query = new URLSearchParams({
      starting_at: `${period.from}T00:00:00Z`,
      ending_at: `${nextDate(period.to)}T00:00:00Z`,
      bucket_width: "1d",
      limit: "31",
    });
    const metrics = new Map<string, bigint>();
    const missingMetrics = new Set<string>();
    let page: string | undefined;
    let hasData = false;
    let firstBucket: string | undefined;
    let lastBucketEnd: string | undefined;
    const reportedDays = new Set<string>();
    let completePagination = true;

    for (let pageNumber = 0; pageNumber < MAX_PROVIDER_PAGES; pageNumber += 1) {
      if (page) {
        query.set("after_id", page);
      } else {
        query.delete("after_id");
      }
      const response = await requestJson(
        this.fetcher,
        `https://api.anthropic.com/v1/organizations/analytics/usage_report?beta=true&${query}`,
        {
          "anthropic-version": "2023-06-01",
          "x-api-key": credential,
        },
        "Anthropic",
        this.delay,
      );
      const body = requireRecord(response, "Anthropic");
      if (!Array.isArray(body.data) || typeof body.has_more !== "boolean") {
        throw invalidProviderResponse("Anthropic");
      }

      for (const rawBucket of body.data) {
        if (!isRecord(rawBucket) || !Array.isArray(rawBucket.results)) {
          throw invalidProviderResponse("Anthropic");
        }
        if (
          typeof rawBucket.starting_at !== "string" ||
          typeof rawBucket.ending_at !== "string" ||
          !Number.isFinite(Date.parse(rawBucket.starting_at)) ||
          !Number.isFinite(Date.parse(rawBucket.ending_at))
        ) {
          throw invalidProviderResponse("Anthropic");
        }
        hasData = true;
        const start = new Date(Date.parse(rawBucket.starting_at))
          .toISOString()
          .slice(0, 10);
        const end = new Date(Date.parse(rawBucket.ending_at))
          .toISOString()
          .slice(0, 10);
        reportedDays.add(start);
        firstBucket = firstBucket ? earlierDate(firstBucket, start) : start;
        lastBucketEnd = lastBucketEnd ? laterDate(lastBucketEnd, end) : end;
        for (const rawResult of rawBucket.results) {
          if (!isRecord(rawResult)) {
            throw invalidProviderResponse("Anthropic");
          }
          for (const name of [
            "uncached_input_tokens",
            "cache_read_input_tokens",
            "cache_creation.ephemeral_1h_input_tokens",
            "cache_creation.ephemeral_5m_input_tokens",
            "output_tokens",
          ]) {
            const value = nonnegativeInteger(rawResult[name]);
            if (value === undefined) {
              missingMetrics.add(name);
              continue;
            }
            metrics.set(name, (metrics.get(name) ?? 0n) + BigInt(value));
          }
        }
      }

      if (!body.has_more) {
        break;
      }
      if (typeof body.next_page !== "string" || !body.next_page) {
        throw invalidProviderResponse("Anthropic");
      }
      page = body.next_page;
      if (pageNumber === MAX_PROVIDER_PAGES - 1) {
        completePagination = false;
      }
    }

    for (const name of missingMetrics) metrics.delete(name);

    const actualPeriod =
      firstBucket && lastBucketEnd
        ? { from: firstBucket, to: previousDate(lastBucketEnd) }
        : undefined;
    const completeCoverage =
      actualPeriod?.from === period.from &&
      actualPeriod.to === period.to &&
      coversRequestedDays(reportedDays, period) &&
      completePagination &&
      missingMetrics.size === 0;
    const status = completeCoverage
      ? metrics.size > 0
        ? "success"
        : "empty"
      : hasData
        ? "partial"
        : "empty";

    return {
      id: this.providerId,
      status,
      requestedPeriod: period,
      ...(actualPeriod && { actualPeriod }),
      lastSuccessfulAt: this.now().toISOString(),
      metrics: [...metrics.entries()].map(([name, value]) =>
        metric(name, value, "tokens"),
      ),
      unsupportedMetrics: hasData
        ? [
            "uncached_input_tokens",
            "cache_read_input_tokens",
            "cache_creation.ephemeral_1h_input_tokens",
            "cache_creation.ephemeral_5m_input_tokens",
            "output_tokens",
          ].filter((name) => !metrics.has(name))
        : [],
      ...(!completeCoverage &&
        hasData && {
          error: {
            code: "metric_coverage_incomplete",
            message:
              "Anthropic returned data for only part of the requested period.",
            retryable: false,
          },
        }),
    };
  }
}

export class GitHubCopilotUsageAdapter implements ProviderUsageAdapter {
  readonly providerId = "github_copilot" satisfies ProviderId;
  private readonly enterpriseSlug: string | undefined;

  constructor(
    enterpriseSlug: string | undefined,
    private readonly fetcher: Fetcher = fetch,
    private readonly now: () => Date = () => new Date(),
    private readonly delay?: Delay,
  ) {
    this.enterpriseSlug = enterpriseSlug?.trim() || undefined;
    if (
      this.enterpriseSlug !== undefined &&
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/.test(
        this.enterpriseSlug,
      )
    ) {
      throw new Error("GitHub enterprise slug is invalid");
    }
  }

  async fetchUsage(
    credential: string,
    period: ReportingPeriod,
  ): Promise<ProviderUsageSource> {
    if (!this.enterpriseSlug) {
      throw new ProviderUsageError(
        "unavailable",
        "provider_configuration_missing",
        "GitHub Copilot enterprise reporting is not configured.",
        false,
      );
    }

    const totals = new Map<string, bigint>();
    const missingDays: string[] = [];
    let reports = 0;
    const missingMetrics = new Set<string>();
    for (const day of dateRangeDays(period)) {
      let report: Record<string, unknown>;
      try {
        report = await this.getDayReport(credential, day);
      } catch (error) {
        if (
          error instanceof ProviderUsageError &&
          error.status === "unavailable"
        ) {
          missingDays.push(day);
          continue;
        }
        throw error;
      }
      reports += 1;
      for (const name of [
        "user_initiated_interaction_count",
        "code_generation_activity_count",
        "code_acceptance_activity_count",
      ]) {
        const value = report[name];
        if (value === undefined) missingMetrics.add(name);
        if (typeof value === "bigint") {
          totals.set(name, (totals.get(name) ?? 0n) + value);
        }
      }
    }

    if (reports === 0) {
      return {
        id: this.providerId,
        status: "unavailable",
        requestedPeriod: period,
        metrics: [],
        unsupportedMetrics: [
          "user_initiated_interaction_count",
          "code_generation_activity_count",
          "code_acceptance_activity_count",
        ],
        error: {
          code: "provider_unsupported_coverage",
          message:
            "GitHub Copilot has no aggregated report for the requested period.",
          retryable: false,
        },
      };
    }

    for (const name of missingMetrics) totals.delete(name);
    const actualPeriod = {
      from: missingDays.includes(period.from)
        ? dateRangeDays(period).find((day) => !missingDays.includes(day))!
        : period.from,
      to: [...dateRangeDays(period)]
        .reverse()
        .find((day) => !missingDays.includes(day))!,
    };
    const periodCovered =
      missingDays.length === 0 &&
      actualPeriod.from === period.from &&
      actualPeriod.to === period.to;
    const completeCoverage =
      periodCovered && missingMetrics.size === 0 && totals.size > 0;

    return {
      id: this.providerId,
      status:
        totals.size === 0
          ? periodCovered
            ? missingMetrics.size
              ? "partial"
              : "empty"
            : "partial"
          : completeCoverage
            ? "success"
            : "partial",
      requestedPeriod: period,
      actualPeriod,
      lastSuccessfulAt: this.now().toISOString(),
      metrics: [...totals.entries()].map(([name, value]) =>
        metric(name, value, "events"),
      ),
      unsupportedMetrics: [
        "user_initiated_interaction_count",
        "code_generation_activity_count",
        "code_acceptance_activity_count",
      ].filter((name) => !totals.has(name)),
      ...((!periodCovered || missingMetrics.size > 0) && {
        error: {
          code: "period_truncated",
          message:
            "GitHub Copilot returned aggregated data for only part of the requested period.",
          retryable: false,
        },
      }),
    };
  }

  private async getDayReport(
    credential: string,
    day: string,
  ): Promise<Record<string, bigint>> {
    const enterprise = encodeURIComponent(this.enterpriseSlug!);
    const url = new URL(
      `https://api.github.com/enterprises/${enterprise}/copilot/metrics/reports/enterprise-1-day`,
    );
    url.searchParams.set("day", day);
    const response = await request(
      this.fetcher,
      url,
      {
        ...JSON_HEADERS,
        Authorization: `Bearer ${credential}`,
        "X-GitHub-Api-Version": "2026-03-10",
      },
      "follow",
      this.delay,
    );
    const body = await parseJsonResponse(response, "GitHub Copilot");
    if (
      !isRecord(body) ||
      body.report_day !== day ||
      !Array.isArray(body.download_links) ||
      body.download_links.length === 0 ||
      body.download_links.some((link) => typeof link !== "string")
    ) {
      throw invalidProviderResponse("GitHub Copilot");
    }

    const daily: Record<string, bigint> = {};
    const incomplete = new Set<string>();
    for (const link of body.download_links) {
      const text = await fetchReportFile(
        this.fetcher,
        link as string,
        this.delay,
      );
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) {
          continue;
        }
        let record: unknown;
        try {
          record = JSON.parse(line);
        } catch {
          throw invalidProviderResponse("GitHub Copilot");
        }
        if (!isRecord(record) || record.day !== day) {
          throw invalidProviderResponse("GitHub Copilot");
        }
        for (const name of [
          "user_initiated_interaction_count",
          "code_generation_activity_count",
          "code_acceptance_activity_count",
        ]) {
          const value = nonnegativeInteger(record[name]);
          if (value === undefined) incomplete.add(name);
          if (value !== undefined) {
            daily[name] = (daily[name] ?? 0n) + BigInt(value);
          }
        }
      }
    }
    for (const name of incomplete) delete daily[name];
    return daily;
  }
}

async function fetchReportFile(
  fetcher: Fetcher,
  rawUrl: string,
  delay?: Delay,
): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw invalidProviderResponse("GitHub Copilot");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port !== "" && url.port !== "443") ||
    url.hash ||
    isLocalHostname(url.hostname)
  ) {
    throw invalidProviderResponse("GitHub Copilot");
  }
  const response = await request(fetcher, url, {}, "error", delay);
  if (!response.ok) {
    throw providerErrorForResponse(response, "GitHub Copilot");
  }
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REPORT_BYTES) {
    throw invalidProviderResponse("GitHub Copilot");
  }
  return readBoundedText(response, MAX_REPORT_BYTES);
}

async function readBoundedText(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  if (!response.body) {
    return "";
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw invalidProviderResponse("GitHub Copilot");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(result);
}

async function requestJson(
  fetcher: Fetcher,
  url: string | URL,
  headers: HeadersInit,
  providerName: string,
  delay?: Delay,
): Promise<unknown> {
  const response = await request(fetcher, url, headers, "follow", delay);
  return parseJsonResponse(response, providerName);
}

async function parseJsonResponse(
  response: Response,
  providerName: string,
): Promise<unknown> {
  if (!response.ok) {
    throw providerErrorForResponse(response, providerName);
  }
  try {
    return await response.json();
  } catch {
    throw invalidProviderResponse(providerName);
  }
}

async function request(
  fetcher: Fetcher,
  url: string | URL,
  headers: HeadersInit,
  redirect: RequestRedirect = "follow",
  delay?: Delay,
): Promise<Response> {
  try {
    return await fetchWithSingleRateLimitRetry(
      fetcher,
      url,
      { headers, redirect, signal: AbortSignal.timeout(15_000) },
      isProviderRateLimited,
      delay,
    );
  } catch {
    throw new ProviderUsageError(
      "failed",
      "provider_temporarily_unavailable",
      "The provider could not be reached.",
      true,
    );
  }
}

function providerErrorForResponse(
  response: Response,
  providerName: string,
): ProviderUsageError {
  const status = response.status;
  if (isProviderRateLimited(response)) {
    return new ProviderUsageError(
      "rate_limited",
      "provider_rate_limited",
      `${providerName} is rate limiting usage reporting.`,
      true,
    );
  }
  if (status === 401 || status === 403) {
    return new ProviderUsageError(
      "permission_denied",
      "provider_permission_denied",
      `${providerName} denied access to usage reporting.`,
      false,
    );
  }
  if (status === 404) {
    return new ProviderUsageError(
      "unavailable",
      "provider_unsupported_coverage",
      `${providerName} does not support this reporting period.`,
      false,
    );
  }
  if (status === 400) {
    return new ProviderUsageError(
      "unavailable",
      "provider_unsupported_coverage",
      `${providerName} does not support this reporting period.`,
      false,
    );
  }
  return new ProviderUsageError(
    "failed",
    "provider_request_failed",
    `${providerName} could not complete the usage report.`,
    status >= 500,
  );
}

function isProviderRateLimited(response: Response): boolean {
  return (
    response.status === 429 ||
    (response.status === 403 &&
      (response.headers.has("retry-after") ||
        response.headers.get("x-ratelimit-remaining") === "0"))
  );
}

function invalidProviderResponse(providerName: string): ProviderUsageError {
  return new ProviderUsageError(
    "failed",
    "invalid_provider_response",
    `${providerName} returned an invalid usage response.`,
    false,
  );
}

function requireRecord(
  value: unknown,
  providerName: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw invalidProviderResponse(providerName);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonnegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

function metric(name: string, value: bigint, unit: string): UsageMetric {
  return {
    name,
    value: value.toString(),
    unit,
    kind: "reported",
    currency: null,
  };
}

function daysBetween(period: ReportingPeriod): number {
  return dateRangeDays(period).length;
}

function coversRequestedDays(
  reportedDays: Set<string>,
  period: ReportingPeriod,
): boolean {
  return dateRangeDays(period).every((day) => reportedDays.has(day));
}

function nextDate(value: string): string {
  return new Date(Date.parse(`${value}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function previousDate(value: string): string {
  return new Date(Date.parse(`${value}T00:00:00Z`) - 86_400_000)
    .toISOString()
    .slice(0, 10);
}

function earlierDate(left: string, right: string): string {
  return left < right ? left : right;
}

function laterDate(left: string, right: string): string {
  return left > right ? left : right;
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  return (
    isIP(normalized) !== 0 ||
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}
