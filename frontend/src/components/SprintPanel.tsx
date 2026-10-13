import { SourceStatus } from "./SourceStatus";
import type {
  SprintReport,
  DashboardStatus,
} from "../../../shared/types/dashboard";

function formatSprintDate(date?: string): string | undefined {
  if (!date) {
    return undefined;
  }
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? undefined
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        parsed,
      );
}

function formatEstimate(report?: SprintReport): string {
  const estimate = report?.progress.estimate;
  if (!estimate) {
    return "Not configured";
  }
  if (estimate.status === "unavailable") {
    if (estimate.unavailableReason === "board_field_mismatch") {
      return "Not configured for this board";
    }
    if (
      estimate.unavailableReason === "board_configuration_permission_denied"
    ) {
      return "Story points unavailable (board configuration access denied)";
    }
    return "Not estimated";
  }
  if (estimate.status === "partial") {
    return `${estimate.estimatedIssueCount} of ${estimate.totalIssueCount} issues estimated`;
  }
  const completed = estimate.completed ?? "Not estimated";
  const remaining = estimate.remaining ?? "Not estimated";
  const unclassified = estimate.unclassified ?? "Not estimated";
  return `Completed: ${completed}; remaining: ${remaining}; unclassified: ${unclassified}`;
}

export function SprintPanel({
  report,
  sprintOptions,
  selectedSprintId,
  onSprintChange,
  statusOverride,
  errorMessage,
}: {
  report?: SprintReport;
  sprintOptions?: { id: string; name: string; state?: string }[];
  selectedSprintId?: string;
  onSprintChange?: (id: string) => void;
  statusOverride?: DashboardStatus;
  errorMessage?: string;
}) {
  const startDate = formatSprintDate(report?.sprint.startDate);
  const endDate = formatSprintDate(report?.sprint.endDate);
  const dateRange =
    startDate && endDate
      ? `${startDate} – ${endDate}`
      : (startDate ?? endDate ?? "Dates unavailable");

  return (
    <section aria-labelledby="sprint-summary-title" className="panel">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">Jira sprint</p>
          <h2 id="sprint-summary-title">Sprint summary</h2>
          {report && (
            <>
              <p>
                {report.sprint.name} — {report.sprint.state}
              </p>
              <p>
                Last successful Jira retrieval:{" "}
                <time dateTime={report.source.retrievedAt}>
                  {report.source.retrievedAt}
                </time>
              </p>
              <p className="sprint-date-range">{dateRange}</p>
            </>
          )}
        </div>
        <label className="sprint-select">
          <span className="visually-hidden">Select a sprint</span>
          <select
            aria-label="Select a sprint"
            disabled={!sprintOptions?.length || !onSprintChange}
            value={selectedSprintId ?? ""}
            onChange={(event) => onSprintChange?.(event.target.value)}
          >
            {!sprintOptions?.length && (
              <option value="">Sprints load after a board is configured</option>
            )}
            {sprintOptions?.map((sprint) => (
              <option key={sprint.id} value={sprint.id}>
                {sprint.name}
                {sprint.state ? ` (${sprint.state})` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <SourceStatus
        status={
          statusOverride ??
          (report
            ? report.coverage.complete
              ? report.progress.issueCount.total === 0
                ? "empty"
                : "success"
              : "partial"
            : "unavailable")
        }
        message={
          errorMessage ??
          (statusOverride === "loading"
            ? "Refreshing Jira; earlier values remain visible."
            : statusOverride === "stale"
              ? "Jira data is stale. Last successful retrieval is shown above."
              : report
                ? `${report.coverage.includedIssueCount} in-scope issues from ${report.coverage.fetchedIssueCount} fetched of ${report.coverage.reportedIssueCount} total sprint issues.`
                : "Choose a configured board to load sprint progress.")
        }
        source="Jira"
      />
      <dl className="metric-grid">
        <div className="metric">
          <dt>Completed issues</dt>
          <dd>{report?.progress.issueCount.completed ?? "—"}</dd>
        </div>
        <div className="metric">
          <dt>Remaining issues</dt>
          <dd>{report?.progress.issueCount.remaining ?? "—"}</dd>
        </div>
        <div className="metric">
          <dt>Story points</dt>
          <dd>{formatEstimate(report)}</dd>
        </div>
      </dl>
      {report && report.progress.issueCount.unclassified > 0 && (
        <p>
          {report.progress.issueCount.unclassified} issues have unclassified
          completion status.
        </p>
      )}
      {report && report.groups.length > 0 && (
        <section aria-label="Work breakdown">
          <h3>Work breakdown</h3>
          <table>
            <caption>Issues by status and issue type</caption>
            <thead>
              <tr>
                <th scope="col">Group</th>
                <th scope="col">Value</th>
                <th scope="col">Issues</th>
              </tr>
            </thead>
            <tbody>
              {report.groups.map((group) => (
                <tr key={`${group.dimension}:${group.key}`}>
                  <th scope="row">
                    {group.dimension === "status" ? "Status" : "Issue type"}
                  </th>
                  <td>{group.key}</td>
                  <td>{group.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {report && report.issues.length > 0 && (
        <ul aria-label="Sprint issues" className="sprint-issue-list">
          {report.issues.map((issue) => (
            <li key={issue.id}>
              <a href={issue.browseUrl} rel="noreferrer" target="_blank">
                {issue.key}: {issue.summary}
              </a>
              <span>{issue.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
