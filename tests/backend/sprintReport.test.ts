import { describe, expect, it, vi } from "vitest";
import {
  type JiraSprintDetails,
  type JiraSprintIssue,
} from "../../backend/src/jira/client.js";
import { getSprintReport } from "../../backend/src/services/sprintReport.js";

const sprint: JiraSprintDetails = {
  id: "12",
  name: "Sprint 12",
  state: "active",
  startDate: "2026-10-01T00:00:00.000Z",
  endDate: "2026-10-15T00:00:00.000Z",
  active: true,
  originBoardId: "42",
};

function issue(
  overrides: Partial<JiraSprintIssue> &
    Pick<JiraSprintIssue, "id" | "key" | "issueType">,
): JiraSprintIssue {
  return {
    id: overrides.id,
    key: overrides.key,
    summary: `${overrides.key} summary`,
    issueType: overrides.issueType,
    isSubtask: false,
    status: "To Do",
    browseUrl: `https://jira.example.com/browse/${overrides.key}`,
    ...overrides,
  };
}

describe("sprint report", () => {
  it("filters to stories, tasks, and bugs and calculates honest progress", async () => {
    const issues = [
      issue({
        id: "1",
        key: "PROJ-1",
        issueType: "Story",
        status: "Done",
        statusCategory: "done",
        estimate: 5,
      }),
      issue({
        id: "2",
        key: "PROJ-2",
        issueType: "Task",
        status: "In Progress",
        statusCategory: "indeterminate",
      }),
      issue({
        id: "3",
        key: "PROJ-3",
        issueType: "Bug",
        status: "Custom",
        estimate: 2,
      }),
      issue({
        id: "4",
        key: "PROJ-4",
        issueType: "Epic",
        statusCategory: "done",
      }),
      issue({
        id: "5",
        key: "PROJ-5",
        issueType: "Task",
        isSubtask: true,
        statusCategory: "done",
      }),
    ];
    const client = {
      getSprint: vi.fn(async () => sprint),
      getBoardEstimationField: vi.fn(async () => "customfield_10001"),
      listSprintIssues: vi.fn(async () => ({
        issues,
        startAt: 0,
        maxResults: 100,
        total: issues.length,
        isLast: true,
      })),
    };

    const report = await getSprintReport(client, "viewer-token", "42", "12", {
      showStoryPoints: true,
      estimateFieldId: "customfield_10001",
      blockedStatusNames: ["in progress", "Done"],
    });

    expect(client.listSprintIssues).toHaveBeenCalledWith(
      "viewer-token",
      "12",
      0,
      100,
      "customfield_10001",
    );
    expect(client.getBoardEstimationField).toHaveBeenCalledWith(
      "viewer-token",
      "42",
    );
    expect(report.sprint).toMatchObject({
      id: "12",
      name: "Sprint 12",
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    });
    expect(report.progress.issueCount).toEqual({
      completed: 1,
      remaining: 1,
      unclassified: 1,
      total: 3,
    });
    expect(report.progress.estimate).toEqual({
      unit: "story_points",
      completed: 5,
      remaining: null,
      unclassified: 2,
      estimatedIssueCount: 2,
      totalIssueCount: 3,
      status: "partial",
    });
    expect(report.issues.map(({ key }) => key)).toEqual([
      "PROJ-1",
      "PROJ-2",
      "PROJ-3",
    ]);
    expect(report.blockers).toEqual({
      status: "success",
      count: 1,
      issues: [
        expect.objectContaining({
          key: "PROJ-2",
          status: "In Progress",
          browseUrl: "https://jira.example.com/browse/PROJ-2",
        }),
      ],
    });
    expect(report.groups).toContainEqual({
      dimension: "issue_type",
      key: "Story",
      count: 1,
    });
  });

  it("does not request or expose estimates unless configured and enabled", async () => {
    const client = {
      getSprint: vi.fn(async () => sprint),
      getBoardEstimationField: vi.fn(),
      listSprintIssues: vi.fn(async () => ({
        issues: [
          issue({
            id: "1",
            key: "PROJ-1",
            issueType: "Story",
            statusCategory: "done",
            estimate: 5,
          }),
        ],
        startAt: 0,
        maxResults: 100,
        total: 1,
        isLast: true,
      })),
    };

    const report = await getSprintReport(client, "viewer-token", "42", "12", {
      showStoryPoints: true,
      estimateFieldId: "invalid-field",
    });

    expect(client.listSprintIssues).toHaveBeenCalledWith(
      "viewer-token",
      "12",
      0,
      100,
      undefined,
    );
    expect(report.progress.estimate).toBeUndefined();
    expect(report.blockers).toEqual({
      status: "unavailable",
      count: null,
      issues: [],
    });
  });

  it("rejects sprints that do not belong to the selected board", async () => {
    const client = {
      getSprint: vi.fn(async () => ({ ...sprint, originBoardId: "99" })),
      getBoardEstimationField: vi.fn(),
      listSprintIssues: vi.fn(),
    };

    await expect(
      getSprintReport(client, "viewer-token", "42", "12"),
    ).rejects.toThrow("does not belong to the requested board");
    expect(client.listSprintIssues).not.toHaveBeenCalled();
  });

  it("does not use a configured estimate field that differs from the board field", async () => {
    const client = {
      getSprint: vi.fn(async () => sprint),
      getBoardEstimationField: vi.fn(async () => "customfield_10002"),
      listSprintIssues: vi.fn(async () => ({
        issues: [
          issue({
            id: "1",
            key: "PROJ-1",
            issueType: "Story",
            statusCategory: "done",
            estimate: 8,
          }),
        ],
        startAt: 0,
        maxResults: 100,
        total: 1,
        isLast: true,
      })),
    };

    const report = await getSprintReport(client, "viewer-token", "42", "12", {
      showStoryPoints: true,
      estimateFieldId: "customfield_10001",
    });

    expect(client.listSprintIssues).toHaveBeenCalledWith(
      "viewer-token",
      "12",
      0,
      100,
      undefined,
    );
    expect(report.progress.estimate).toMatchObject({
      status: "unavailable",
      unavailableReason: "board_field_mismatch",
      completed: null,
      estimatedIssueCount: 0,
    });
  });

  it("paginates issues and explicitly marks reports truncated at the limit", async () => {
    const allIssues = Array.from({ length: 501 }, (_, index) =>
      issue({
        id: String(index),
        key: `PROJ-${index}`,
        issueType: "Task",
        statusCategory: "new",
      }),
    );
    const client = {
      getSprint: vi.fn(async () => sprint),
      getBoardEstimationField: vi.fn(),
      listSprintIssues: vi.fn(
        async (_token: string, _sprintId: string, offset: number) => {
          const pageIssues = allIssues.slice(offset, offset + 100);
          return {
            issues: pageIssues,
            startAt: offset,
            maxResults: 100,
            total: allIssues.length,
            isLast: offset + pageIssues.length >= allIssues.length,
          };
        },
      ),
    };

    const report = await getSprintReport(client, "viewer-token", "42", "12");

    expect(client.listSprintIssues).toHaveBeenCalledTimes(5);
    expect(report.progress.issueCount.total).toBe(500);
    expect(report.coverage).toEqual({
      fetchedIssueCount: 500,
      includedIssueCount: 500,
      reportedIssueCount: 501,
      complete: false,
    });
    expect(report.source.status).toBe("partial");
  });
});
