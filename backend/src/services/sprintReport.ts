import type { JiraClient, JiraSprintIssue } from "../jira/client.js";
import { JiraApiError } from "../jira/client.js";
import type { SprintReport } from "../../../shared/types/dashboard.js";

const REPORT_ISSUE_LIMIT = 500;
const PAGE_SIZE = 100;
const INCLUDED_ISSUE_TYPES = new Set(["story", "task", "bug"]);

export class SprintBoardMismatchError extends Error {
  constructor() {
    super("The selected sprint does not belong to the requested board");
    this.name = "SprintBoardMismatchError";
  }
}

function isInScope(issue: JiraSprintIssue): boolean {
  return (
    !issue.isSubtask &&
    INCLUDED_ISSUE_TYPES.has(issue.issueType.trim().toLowerCase())
  );
}

function buildGroups(issues: JiraSprintIssue[]): SprintReport["groups"] {
  const statusCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();

  for (const issue of issues) {
    statusCounts.set(issue.status, (statusCounts.get(issue.status) ?? 0) + 1);
    typeCounts.set(issue.issueType, (typeCounts.get(issue.issueType) ?? 0) + 1);
  }

  return [
    ...[...statusCounts].map(([key, count]) => ({
      dimension: "status" as const,
      key,
      count,
    })),
    ...[...typeCounts].map(([key, count]) => ({
      dimension: "issue_type" as const,
      key,
      count,
    })),
  ];
}

export async function getSprintReport(
  client: Pick<
    JiraClient,
    "getSprint" | "getBoardEstimationField" | "listSprintIssues"
  >,
  accessToken: string,
  boardId: string,
  sprintId: string,
  options: {
    estimateFieldId?: string;
    showStoryPoints?: boolean;
    blockedStatusNames?: string[];
  } = {},
): Promise<SprintReport> {
  const sprint = await client.getSprint(accessToken, sprintId);
  if (sprint.originBoardId !== boardId) {
    throw new SprintBoardMismatchError();
  }

  const estimateRequested =
    options.showStoryPoints === true &&
    options.estimateFieldId !== undefined &&
    /^customfield_[0-9]+$/.test(options.estimateFieldId);
  let estimateFieldId: string | undefined;
  let estimateUnavailableReason:
    | "board_configuration_permission_denied"
    | "board_field_mismatch"
    | "no_estimates" = "board_field_mismatch";
  if (estimateRequested) {
    try {
      const boardEstimateField = await client.getBoardEstimationField(
        accessToken,
        boardId,
      );
      if (boardEstimateField === options.estimateFieldId) {
        estimateFieldId = options.estimateFieldId;
      }
    } catch (error) {
      if (
        !(error instanceof JiraApiError) ||
        error.code !== "permission_denied"
      ) {
        throw error;
      }
      estimateUnavailableReason = "board_configuration_permission_denied";
    }
  }
  const retrievedIssues: JiraSprintIssue[] = [];
  let reportedIssueCount = 0;
  let complete = true;

  while (retrievedIssues.length < REPORT_ISSUE_LIMIT) {
    const page = await client.listSprintIssues(
      accessToken,
      sprintId,
      retrievedIssues.length,
      PAGE_SIZE,
      estimateFieldId,
    );
    reportedIssueCount = page.total;
    retrievedIssues.push(
      ...page.issues.slice(0, REPORT_ISSUE_LIMIT - retrievedIssues.length),
    );
    if (page.isLast) {
      break;
    }
    if (retrievedIssues.length >= REPORT_ISSUE_LIMIT) {
      complete = false;
      break;
    }
    if (page.issues.length === 0) {
      throw new Error(
        "Jira returned an empty page before the end of the sprint issue list",
      );
    }
  }
  if (reportedIssueCount > REPORT_ISSUE_LIMIT) {
    complete = false;
  }

  const issues = retrievedIssues.filter(isInScope);
  const blockedStatusNames = new Set(
    (options.blockedStatusNames ?? []).map((name) => name.trim().toLowerCase()),
  );
  const blockerIssues =
    blockedStatusNames.size === 0
      ? []
      : issues.filter(
          (issue) =>
            issue.statusCategory !== "done" &&
            blockedStatusNames.has(issue.status.trim().toLowerCase()),
        );
  let completed = 0;
  let remaining = 0;
  let unclassified = 0;
  let completedEstimate = 0;
  let remainingEstimate = 0;
  let unclassifiedEstimate = 0;
  let completedEstimatedIssueCount = 0;
  let remainingEstimatedIssueCount = 0;
  let unclassifiedEstimatedIssueCount = 0;
  let estimatedIssueCount = 0;

  for (const issue of issues) {
    if (issue.statusCategory === "done") {
      completed += 1;
      if (estimateFieldId && issue.estimate !== undefined) {
        completedEstimate += issue.estimate;
        completedEstimatedIssueCount += 1;
      }
    } else if (
      issue.statusCategory === "new" ||
      issue.statusCategory === "indeterminate"
    ) {
      remaining += 1;
      if (estimateFieldId && issue.estimate !== undefined) {
        remainingEstimate += issue.estimate;
        remainingEstimatedIssueCount += 1;
      }
    } else {
      unclassified += 1;
      if (estimateFieldId && issue.estimate !== undefined) {
        unclassifiedEstimate += issue.estimate;
        unclassifiedEstimatedIssueCount += 1;
      }
    }
    if (estimateFieldId && issue.estimate !== undefined) {
      estimatedIssueCount += 1;
    }
  }

  const totalIssueCount = issues.length;
  const report: SprintReport = {
    sprint: {
      id: sprint.id,
      name: sprint.name,
      state: sprint.state,
      ...(sprint.startDate && { startDate: sprint.startDate }),
      ...(sprint.endDate && { endDate: sprint.endDate }),
    },
    progress: {
      issueCount: {
        completed,
        remaining,
        unclassified,
        total: totalIssueCount,
      },
      ...(estimateRequested && {
        estimate: {
          unit: "story_points",
          completed: estimateFieldId
            ? completedEstimatedIssueCount > 0
              ? completedEstimate
              : null
            : null,
          remaining: estimateFieldId
            ? remainingEstimatedIssueCount > 0
              ? remainingEstimate
              : null
            : null,
          unclassified: estimateFieldId
            ? unclassifiedEstimatedIssueCount > 0
              ? unclassifiedEstimate
              : null
            : null,
          estimatedIssueCount,
          totalIssueCount,
          status:
            !estimateFieldId || estimatedIssueCount === 0
              ? "unavailable"
              : estimatedIssueCount === totalIssueCount
                ? "complete"
                : "partial",
          ...(!estimateFieldId && {
            unavailableReason: estimateUnavailableReason,
          }),
          ...(estimateFieldId &&
            estimatedIssueCount === 0 && {
              unavailableReason: "no_estimates" as const,
            }),
        },
      }),
    },
    blockers:
      blockedStatusNames.size > 0
        ? {
            status: "success",
            count: blockerIssues.length,
            issues: blockerIssues.map(
              ({
                id,
                key,
                summary,
                issueType,
                status,
                assignee,
                browseUrl,
              }) => ({
                id,
                key,
                summary,
                issueType,
                status,
                ...(assignee && { assignee }),
                browseUrl,
              }),
            ),
          }
        : { status: "unavailable", count: null, issues: [] },
    issues: issues.map(
      ({ id, key, summary, issueType, status, assignee, browseUrl }) => ({
        id,
        key,
        summary,
        issueType,
        status,
        ...(assignee && { assignee }),
        browseUrl,
      }),
    ),
    groups: buildGroups(issues),
    coverage: {
      fetchedIssueCount: retrievedIssues.length,
      includedIssueCount: issues.length,
      reportedIssueCount,
      complete,
    },
    source: {
      id: "jira",
      status: complete ? "success" : "partial",
      retrievedAt: new Date().toISOString(),
      completeness: complete ? "complete" : "partial",
    },
  };

  return report;
}
