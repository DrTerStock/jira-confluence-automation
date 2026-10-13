import type { Express, Request, RequestHandler, Response } from "express";
import { requestCorrelationId } from "../requestCorrelation.js";
import {
  getViewerContext,
  rejectUnauthenticated,
  rejectWidgetAccess,
} from "../auth/context.js";
import {
  isValidJiraBoardId,
  isValidJiraSprintState,
  JiraApiError,
  JiraClient,
  validateJiraPage,
} from "./client.js";
import { WidgetConfigStore } from "../config/widgetConfig.js";
import {
  getSprintReport,
  SprintBoardMismatchError,
} from "../services/sprintReport.js";

import { RequestWork, RequestCapacityError } from "../requestWork.js";
import type { SprintObservationStore } from "../storage/sprintObservations.js";

function parsePageQuery(request: Request): { startAt: number; limit: number } {
  const startAt =
    request.query.startAt === undefined ? 0 : Number(request.query.startAt);
  const limit =
    request.query.limit === undefined ? 50 : Number(request.query.limit);
  validateJiraPage(startAt, limit);
  return { startAt, limit };
}

function sendJiraError(
  response: Response,
  error: unknown,
  operation: string,
): void {
  const correlationId = requestCorrelationId(response);
  if (error instanceof RequestCapacityError) {
    response.status(429).json({
      error: {
        code: "refresh_capacity",
        message: "Too many source refreshes are running. Try again shortly.",
        correlationId,
        retryable: true,
        retryAfterSeconds: 1,
      },
    });
    return;
  }
  if (error instanceof JiraApiError) {
    const status =
      error.code === "permission_denied"
        ? 403
        : error.code === "rate_limited"
          ? 429
          : 502;
    response.status(status).json({
      error: {
        code: `jira_${error.code}`,
        message:
          error.code === "permission_denied"
            ? "You do not have access to this Jira data."
            : error.code === "rate_limited"
              ? "Jira is rate limiting this request. Try again later."
              : "Jira could not complete this request.",
        correlationId,
        retryable: error.code === "rate_limited" || status === 502,
        ...(error.retryAfterSeconds !== undefined && {
          retryAfterSeconds: error.retryAfterSeconds,
        }),
      },
    });
    return;
  }

  console.error("Jira request failed", { operation, correlationId });
  response.status(502).json({
    error: {
      code: "jira_request_failed",
      message: "Jira could not complete this request.",
      correlationId,
      retryable: true,
    },
  });
}

function rejectMissingJiraAccess(response: Response): void {
  response.status(401).json({
    error: {
      code: "jira_access_required",
      message: "Connect Jira access to view this data.",
      correlationId: requestCorrelationId(response),
      retryable: false,
    },
  });
}

function sendServiceUnavailable(response: Response): void {
  response.status(503).json({
    error: {
      code: "jira_not_configured",
      message: "Jira reporting is not configured for this service.",
      correlationId: requestCorrelationId(response),
      retryable: false,
    },
  });
}

function parseQueryOrRespond(
  request: Request,
  response: Response,
): { startAt: number; limit: number } | undefined {
  try {
    return parsePageQuery(request);
  } catch {
    response.status(400).json({
      error: {
        code: "invalid_pagination",
        message: "Pagination values are outside the supported range.",
        correlationId: requestCorrelationId(response),
        retryable: false,
      },
    });
    return undefined;
  }
}

export function registerJiraRoutes(
  app: Express,
  client: JiraClient | undefined,
  authenticateViewer: RequestHandler,
  widgetConfigStore?: Pick<WidgetConfigStore, "get">,
  observations?: SprintObservationStore,
  isInstallationRemoved: (id: string) => boolean = () => false,
): void {
  const work = new RequestWork();
  app.get(
    "/api/v1/jira/boards",
    authenticateViewer,
    async (request, response) => {
      if (!client) {
        sendServiceUnavailable(response);
        return;
      }
      const pagination = parseQueryOrRespond(request, response);
      if (!pagination) {
        return;
      }
      const viewer = getViewerContext(response);
      if (!viewer) {
        rejectUnauthenticated(response);
        return;
      }
      if (!viewer.jiraAccessToken) {
        rejectMissingJiraAccess(response);
        return;
      }

      try {
        response.json(
          await client.listBoards(
            viewer.jiraAccessToken,
            pagination.startAt,
            pagination.limit,
          ),
        );
      } catch (error) {
        sendJiraError(response, error, "list_boards");
      }
    },
  );

  app.get(
    "/api/v1/jira/boards/:boardId/sprints",
    authenticateViewer,
    async (request, response) => {
      if (!client) {
        sendServiceUnavailable(response);
        return;
      }
      const boardId = request.params.boardId;
      if (!isValidJiraBoardId(boardId)) {
        response.status(400).json({
          error: {
            code: "invalid_board_id",
            message: "The Jira board identifier is invalid.",
            correlationId: requestCorrelationId(response),
            retryable: false,
          },
        });
        return;
      }
      const pagination = parseQueryOrRespond(request, response);
      if (!pagination) {
        return;
      }
      const stateValue = request.query.state;
      if (
        stateValue !== undefined &&
        (typeof stateValue !== "string" || !isValidJiraSprintState(stateValue))
      ) {
        response.status(400).json({
          error: {
            code: "invalid_sprint_state",
            message: "The sprint state filter is invalid.",
            correlationId: requestCorrelationId(response),
            retryable: false,
          },
        });
        return;
      }
      const viewer = getViewerContext(response);
      if (!viewer) {
        rejectUnauthenticated(response);
        return;
      }
      if (!viewer.jiraAccessToken) {
        rejectMissingJiraAccess(response);
        return;
      }

      try {
        response.json(
          await client.listSprints(
            viewer.jiraAccessToken,
            boardId,
            pagination.startAt,
            pagination.limit,
            stateValue as "active" | "closed" | "future" | undefined,
          ),
        );
      } catch (error) {
        sendJiraError(response, error, "list_sprints");
      }
    },
  );

  app.get(
    "/api/v1/widgets/:widgetInstanceKey/jira/boards/:boardId/sprints/:sprintId/report",
    authenticateViewer,
    async (request, response) => {
      if (!client || !widgetConfigStore) {
        sendServiceUnavailable(response);
        return;
      }
      const { widgetInstanceKey, boardId, sprintId } = request.params;
      if (
        !/^[A-Za-z0-9._:-]{1,255}$/.test(widgetInstanceKey) ||
        !isValidJiraBoardId(boardId) ||
        !/^[A-Za-z0-9._:-]{1,128}$/.test(sprintId)
      ) {
        response.status(400).json({
          error: {
            code: "invalid_report_scope",
            message: "The requested report scope is invalid.",
            correlationId: requestCorrelationId(response),
            retryable: false,
          },
        });
        return;
      }

      const viewer = getViewerContext(response);
      if (!viewer) {
        rejectUnauthenticated(response);
        return;
      }
      if (viewer.widgetInstanceKey !== widgetInstanceKey) {
        rejectWidgetAccess(response);
        return;
      }
      if (!viewer.jiraAccessToken) {
        rejectMissingJiraAccess(response);
        return;
      }

      let config;
      try {
        config = await widgetConfigStore.get(
          viewer.installationId,
          widgetInstanceKey,
        );
      } catch {
        const correlationId = requestCorrelationId(response);
        console.error("Widget configuration lookup failed", { correlationId });
        response.status(500).json({
          error: {
            code: "widget_configuration_failed",
            message: "The dashboard configuration could not be loaded.",
            correlationId,
            retryable: true,
          },
        });
        return;
      }
      if (!config || config.boardId !== boardId) {
        response.status(404).json({
          error: {
            code: "widget_configuration_not_found",
            message: "The requested dashboard configuration was not found.",
            correlationId: requestCorrelationId(response),
            retryable: false,
          },
        });
        return;
      }

      try {
        const key = JSON.stringify([
          viewer.installationId,
          viewer.userId,
          widgetInstanceKey,
          boardId,
          sprintId,
          config.preferences,
          request.get("Cache-Control"),
        ]);
        const report = await work.run(key, viewer.installationId, async () => {
          const report = await getSprintReport(
            client,
            viewer.jiraAccessToken!,
            boardId,
            sprintId,
            {
              showStoryPoints: config.preferences.showStoryPoints,
              estimateFieldId: config.preferences.estimateFieldId,
              blockedStatusNames: config.preferences.blockedStatusNames,
            },
          );
          if (observations && !isInstallationRemoved(viewer.installationId)) {
            try {
              const history = await observations.history(
                {
                  installationId: viewer.installationId,
                  viewerId: viewer.userId,
                  widgetInstanceKey,
                  boardId,
                  sprintId,
                },
                /(?:^|,)\s*no-cache\b/i.test(request.get("Cache-Control") ?? "")
                  ? report
                  : undefined,
              );
              if (history) report.burndown = history;
            } catch {
              /* Keep the accurate summary when optional history is unavailable. */
            }
          }
          return report;
        });
        if (isInstallationRemoved(viewer.installationId)) {
          rejectWidgetAccess(response);
          return;
        }
        response.json(report);
      } catch (error) {
        if (error instanceof SprintBoardMismatchError) {
          response.status(404).json({
            error: {
              code: "sprint_not_found",
              message: "The requested sprint was not found for this board.",
              correlationId: requestCorrelationId(response),
              retryable: false,
            },
          });
          return;
        }
        sendJiraError(response, error, "get_sprint_report");
      }
    },
  );
}
