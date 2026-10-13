import type { BurndownHistory } from "../../../shared/types/dashboard";
import { SourceStatus } from "./SourceStatus";

const chartWidth = 640;
const chartHeight = 240;
const chartPadding = 32;
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/;

function observationDate(timestamp: string): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function parseObservationTimestamp(timestamp: string): number {
  if (!timestampPattern.test(timestamp)) {
    return Number.NaN;
  }
  const dateOnly = new Date(`${timestamp.slice(0, 10)}T00:00:00.000Z`);
  if (
    !Number.isFinite(dateOnly.getTime()) ||
    dateOnly.toISOString().slice(0, 10) !== timestamp.slice(0, 10)
  ) {
    return Number.NaN;
  }
  return Date.parse(timestamp);
}

function isObservation(
  value: unknown,
): value is BurndownHistory["observations"][number] {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "observedAt" in value &&
    typeof value.observedAt === "string" &&
    "remaining" in value &&
    typeof value.remaining === "number"
  );
}

export function BurndownChart({ history }: { history?: BurndownHistory }) {
  const rawObservations: unknown[] = Array.isArray(history?.observations)
    ? history.observations
    : [];
  const observations = rawObservations
    .filter(isObservation)
    .map((observation, index) => ({
      ...observation,
      timestamp: parseObservationTimestamp(observation.observedAt),
      index,
    }))
    .filter(
      (observation) =>
        Number.isFinite(observation.timestamp) &&
        Number.isFinite(observation.remaining) &&
        observation.remaining >= 0,
    )
    .sort(
      (left, right) =>
        left.timestamp - right.timestamp || left.index - right.index,
    );
  const hasProvenance =
    typeof history?.provenance === "string" &&
    Boolean(history.provenance.trim());
  const hasSupportedUnit =
    history?.unit === "issues" || history?.unit === "story_points";
  const hasSupportedSource =
    history?.source === "jira" || history?.source === "manual_snapshot";
  const isPartial = observations.length !== rawObservations.length;

  if (
    !history ||
    !hasProvenance ||
    !hasSupportedUnit ||
    !hasSupportedSource ||
    observations.length === 0
  ) {
    return (
      <section aria-labelledby="burndown-title" className="panel">
        <p className="eyebrow">Sprint history</p>
        <h2 id="burndown-title">Burndown</h2>
        <SourceStatus
          status="unavailable"
          message="Burndown history unavailable until dated observations with verified provenance are available."
          source="Jira"
        />
        <p className="panel__note">
          No historical points are shown until they can be verified against a
          source and timestamp.
        </p>
      </section>
    );
  }

  const firstObservation = observations[0];
  const lastObservation =
    observations[observations.length - 1] ?? firstObservation;
  const firstTimestamp = firstObservation.timestamp;
  const lastTimestamp = lastObservation.timestamp;
  const remainingValues = observations.map(({ remaining }) => remaining);
  const minimumRemaining = Math.min(...remainingValues);
  const maximumRemaining = Math.max(...remainingValues);
  const timeRange = lastTimestamp - firstTimestamp;
  const remainingRange = maximumRemaining - minimumRemaining;
  const chartPoints = observations.map((observation) => {
    const x =
      chartPadding +
      (timeRange === 0
        ? (chartWidth - chartPadding * 2) / 2
        : ((observation.timestamp - firstTimestamp) / timeRange) *
          (chartWidth - chartPadding * 2));
    const y =
      chartPadding +
      (remainingRange === 0
        ? (chartHeight - chartPadding * 2) / 2
        : ((maximumRemaining - observation.remaining) / remainingRange) *
          (chartHeight - chartPadding * 2));
    return { ...observation, x, y };
  });
  const coverage = `${observationDate(firstObservation.observedAt)} – ${observationDate(lastObservation.observedAt)}`;

  return (
    <section aria-labelledby="burndown-title" className="panel">
      <p className="eyebrow">Sprint history</p>
      <h2 id="burndown-title">Burndown</h2>
      <SourceStatus
        status={isPartial ? "partial" : "success"}
        message={
          isPartial
            ? `${observations.length} valid observations shown; invalid observations were excluded.`
            : `${observations.length} dated observations shown.`
        }
        source={history.source === "jira" ? "Jira" : "Manual refresh snapshot"}
      />
      <p className="panel__note">
        Coverage: {coverage}. Provenance: {history.provenance}. Unit:{" "}
        {history.unit === "issues"
          ? "issues remaining"
          : "story points remaining"}
        .
      </p>
      <p>
        Last observation:{" "}
        <time dateTime={lastObservation.observedAt}>
          {lastObservation.observedAt}
        </time>
      </p>
      <svg
        aria-label={`Burndown of ${history.unit} remaining from ${coverage}; ${history.provenance}`}
        className="burndown-chart"
        role="img"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      >
        <line
          className="burndown-chart__axis"
          x1={chartPadding}
          x2={chartPadding}
          y1={chartPadding}
          y2={chartHeight - chartPadding}
        />
        <line
          className="burndown-chart__axis"
          x1={chartPadding}
          x2={chartWidth - chartPadding}
          y1={chartHeight - chartPadding}
          y2={chartHeight - chartPadding}
        />
        {chartPoints.length > 1 && (
          <polyline
            className="burndown-chart__line"
            points={chartPoints.map(({ x, y }) => `${x},${y}`).join(" ")}
          />
        )}
        {chartPoints.map(({ observedAt, remaining, x, y }) => (
          <circle
            aria-label={`${observationDate(observedAt)}: ${remaining} ${history.unit} remaining`}
            className="burndown-chart__point"
            cx={x}
            cy={y}
            key={`${observedAt}-${remaining}`}
            r="5"
          />
        ))}
      </svg>
      <table className="burndown-observations">
        <caption>Verified burndown observations</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">
              Remaining ({history.unit === "issues" ? "issues" : "story points"}
              )
            </th>
          </tr>
        </thead>
        <tbody>
          {chartPoints.map(({ observedAt, remaining }) => (
            <tr key={`${observedAt}-${remaining}`}>
              <td>{observationDate(observedAt)}</td>
              <td>{remaining}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
