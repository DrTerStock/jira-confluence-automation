import type {
  SprintReport,
  DashboardStatus,
} from "../../../shared/types/dashboard";
import { SourceStatus } from "./SourceStatus";

export function BlockerPanel({
  blockers,
  statusOverride,
}: {
  blockers?: SprintReport["blockers"];
  statusOverride?: DashboardStatus;
}) {
  const availableBlockers =
    blockers?.status === "success" ? blockers : undefined;

  return (
    <section aria-labelledby="blockers-title" className="panel">
      <p className="eyebrow">Delivery risks</p>
      <h2 id="blockers-title">Blockers</h2>
      <SourceStatus
        status={
          statusOverride ?? (availableBlockers ? "success" : "unavailable")
        }
        message={
          statusOverride === "stale"
            ? "Retained blocker data is stale; check the Jira retrieval time above."
            : statusOverride === "loading"
              ? "Refreshing blockers; earlier values remain visible."
              : statusOverride === "partial" && availableBlockers
                ? `Found ${availableBlockers.count} blocked issues in fetched data; Jira issue coverage is incomplete.`
                : availableBlockers
                  ? `Found ${availableBlockers.count} blocked issue${availableBlockers.count === 1 ? "" : "s"}.`
                  : "Blocked count is unavailable until project blocked statuses are configured."
        }
      />
      <dl className="metric-grid">
        <div className="metric">
          <dt>Blocked issues</dt>
          <dd>{availableBlockers ? availableBlockers.count : "Unavailable"}</dd>
        </div>
      </dl>
      {availableBlockers && availableBlockers.issues.length > 0 && (
        <ul aria-label="Blocked issues" className="issue-list">
          {availableBlockers.issues.map((issue) => (
            <li key={issue.id}>
              <a href={issue.browseUrl} rel="noreferrer" target="_blank">
                {issue.key}: {issue.summary}
              </a>
              <span>Status: {issue.status}</span>
              {issue.assignee && <span>Assignee: {issue.assignee}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
