import type {
  CompatibleUsageTotal,
  ProviderId,
  ProviderUsageSource,
  ProviderUsageStatus,
  UsageMetric,
  UsageReport,
} from "../../../shared/types/dashboard";
import { SourceStatus } from "./SourceStatus";

const providerNames: Record<ProviderId, string> = {
  github_copilot: "GitHub Copilot",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

const metricNames: Record<string, string> = {
  user_initiated_interaction_count: "User-initiated interactions",
  code_generation_activity_count: "Code generation activity",
  code_acceptance_activity_count: "Code acceptance activity",
  input_tokens: "Input tokens",
  uncached_input_tokens: "Uncached input tokens",
  cache_read_input_tokens: "Cache-read input tokens",
  "cache_creation.ephemeral_1h_input_tokens":
    "One-hour cache creation input tokens",
  "cache_creation.ephemeral_5m_input_tokens":
    "Five-minute cache creation input tokens",
  output_tokens: "Output tokens",
  model_requests: "Model requests",
};

export function UsagePanel({
  report,
  loading = false,
}: {
  report?: UsageReport;
  loading?: boolean;
}) {
  const period = report?.requestedPeriod;

  return (
    <section aria-labelledby="usage-title" className="panel">
      <p className="eyebrow">Organization usage</p>
      <h2 id="usage-title">AI usage</h2>
      <p className="panel__note">
        Individual attribution, identity matching and AI cost estimates are
        outside this prototype’s scope.
      </p>
      <fieldset className="date-range" disabled>
        <legend>Reporting period</legend>
        <label>
          From
          <input
            aria-label="Usage start date"
            type="date"
            value={period?.from ?? ""}
            readOnly
          />
        </label>
        <label>
          To
          <input
            aria-label="Usage end date"
            type="date"
            value={period?.to ?? ""}
            readOnly
          />
        </label>
      </fieldset>

      {!report ? (
        <SourceStatus
          status={loading ? "loading" : "unavailable"}
          message={
            loading
              ? "Provider usage is refreshing."
              : "No reporting providers are configured. Values are not assumed to be zero."
          }
        />
      ) : report.sources.length === 0 ? (
        <SourceStatus
          status="unavailable"
          message="No reporting providers are enabled for this dashboard."
        />
      ) : (
        <>
          {loading && (
            <SourceStatus
              status="loading"
              message="Refreshing provider usage; current reports remain visible."
            />
          )}
          {report.compatibleTotals.length > 0 && (
            <section
              aria-label="Compatible team totals"
              className="usage-totals"
            >
              <h3>Compatible team totals</h3>
              <MetricList
                metrics={report.compatibleTotals}
                sourceIds={report.compatibleTotals.map(
                  ({ sourceIds }) => sourceIds,
                )}
              />
            </section>
          )}
          <ul aria-label="Provider usage reports" className="usage-sources">
            {report.sources.map((source) => (
              <ProviderUsageSummary key={source.id} source={source} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function ProviderUsageSummary({ source }: { source: ProviderUsageSource }) {
  const providerName = providerNames[source.id];

  return (
    <li className="usage-source">
      <h3>{providerName}</h3>
      <SourceStatus
        source={providerName}
        status={source.status}
        message={statusMessage(source.status, source.error?.message)}
      />
      {source.lastSuccessfulAt && (
        <p className="usage-source__freshness">
          <time dateTime={source.lastSuccessfulAt}>
            Last successful report: {source.lastSuccessfulAt}
          </time>
        </p>
      )}
      {source.actualPeriod && (
        <p className="usage-source__coverage">
          Coverage: {source.actualPeriod.from} to {source.actualPeriod.to}
        </p>
      )}
      {source.metrics.length > 0 && (
        <MetricList
          metrics={source.metrics}
          definitions={source.metricDefinitions}
        />
      )}
      {source.unsupportedMetrics.length > 0 && (
        <p className="usage-source__unsupported">
          <strong>Unsupported metrics:</strong>{" "}
          {source.unsupportedMetrics.map(metricName).join(", ")}
        </p>
      )}
    </li>
  );
}

function MetricList({
  metrics,
  sourceIds,
  definitions,
}: {
  metrics: UsageMetric[];
  sourceIds?: ProviderId[][];
  definitions?: ProviderUsageSource["metricDefinitions"];
}) {
  return (
    <dl className="usage-metrics">
      {metrics.map((metric, index) => (
        <div className="metric" key={`${metric.name}-${index}`}>
          <dt>{metricName(metric.name)}</dt>
          <dd>
            {formatMetric(metric)}
            <small>
              {metric.kind === "reported" ? "Reported" : "Estimated"}
            </small>
            {definitions?.[metric.name] && (
              <small>
                {definitions[metric.name].description} Source field:{" "}
                {definitions[metric.name].providerName}.
              </small>
            )}
            {sourceIds?.[index] && sourceIds[index].length > 1 && (
              <small>
                Across{" "}
                {sourceIds[index]
                  .map((providerId) => providerNames[providerId])
                  .join(" and ")}
              </small>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatMetric(metric: UsageMetric | CompatibleUsageTotal): string {
  if (!/^\d+$/.test(metric.value)) {
    return "Value unavailable";
  }
  const value = BigInt(metric.value).toLocaleString();
  return metric.currency
    ? `${metric.currency} ${value}`
    : `${value} ${metric.unit}`;
}

function metricName(name: string): string {
  return metricNames[name] ?? "Unrecognized metric";
}

function statusMessage(
  status: ProviderUsageStatus,
  errorMessage?: string,
): string {
  if (errorMessage) {
    return errorMessage;
  }
  switch (status) {
    case "success":
      return "Reported metrics are available for the requested period.";
    case "partial":
      return "Some metrics or reporting days are unavailable.";
    case "empty":
      return "No usage was reported. This is not a zero-valued report.";
    case "stale":
      return "The latest refresh failed; showing the last successful data.";
    case "unavailable":
      return "This provider cannot report the requested data.";
    case "permission_denied":
      return "The provider denied access to usage reporting.";
    case "rate_limited":
      return "The provider is rate limiting usage reporting.";
    case "failed":
      return "The provider usage report failed.";
  }
}
