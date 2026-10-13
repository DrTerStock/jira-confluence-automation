import type { Express, RequestHandler } from "express";
import { getViewerContext } from "../auth/context.js";
import { sendApiError } from "../apiError.js";
import {
  JiraApiError,
  type JiraClient,
  validateJiraPage,
} from "../jira/client.js";
import type { ProviderReadinessService } from "../providers/readiness.js";
import {
  validateWidgetConfigInput,
  type WidgetConfigStore,
} from "./widgetConfig.js";

export function registerWidgetConfigRoutes(
  app: Express,
  authenticate: RequestHandler,
  store?: Pick<WidgetConfigStore, "get"> &
    Partial<Pick<WidgetConfigStore, "save">>,
  jira?: JiraClient,
  readiness?: Pick<ProviderReadinessService, "list">,
  configurationChanged?: (
    installationId: string,
    widgetInstanceKey: string,
  ) => void,
): void {
  app.get(
    "/api/v1/dashboard/context",
    authenticate,
    async (_request, response) => {
      const viewer = getViewerContext(response)!;
      if (!store)
        return sendApiError(
          response,
          503,
          "configuration_unavailable",
          "Dashboard configuration is unavailable.",
        );
      try {
        const config = await store.get(
          viewer.installationId,
          viewer.widgetInstanceKey,
        );
        response.json({
          widgetId: viewer.widgetInstanceKey,
          isAdmin: viewer.isAdmin,
          canEdit: viewer.isAdmin || viewer.canEdit === true,
          config: config ?? null,
        });
      } catch {
        sendApiError(
          response,
          502,
          "configuration_failed",
          "Dashboard configuration could not be loaded. Try again.",
          true,
        );
      }
    },
  );
  app.get(
    "/api/v1/dashboard/options",
    authenticate,
    async (request, response) => {
      const viewer = getViewerContext(response)!;
      if (!viewer.isAdmin && !viewer.canEdit)
        return sendApiError(
          response,
          403,
          "editor_required",
          "Only page editors can configure this dashboard.",
        );
      if (!jira || !viewer.jiraAccessToken)
        return sendApiError(
          response,
          503,
          "jira_access_required",
          "Connect viewer Jira access before selecting a board.",
        );
      const startAt = Number(request.query.startAt ?? 0);
      try {
        validateJiraPage(startAt, 50);
      } catch {
        return sendApiError(
          response,
          400,
          "invalid_options_request",
          "Provide a supported board page offset.",
        );
      }
      try {
        const [boards, sources] = await Promise.all([
          jira.listBoards(viewer.jiraAccessToken, startAt, 50),
          readiness?.list(viewer.installationId) ?? [],
        ]);
        response.json({ boards, sources });
      } catch (error) {
        if (error instanceof JiraApiError)
          return sendApiError(
            response,
            error.code === "permission_denied" ? 403 : 502,
            `jira_${error.code}`,
            "Jira board choices could not be loaded. Check access or try again.",
            error.code !== "permission_denied",
          );
        sendApiError(
          response,
          502,
          "configuration_options_failed",
          "Configuration choices could not be loaded. Try again.",
          true,
        );
      }
    },
  );
  app.put(
    "/api/v1/dashboard/config",
    authenticate,
    async (request, response) => {
      const viewer = getViewerContext(response)!;
      if (!viewer.isAdmin && !viewer.canEdit)
        return sendApiError(
          response,
          403,
          "editor_required",
          "Only page editors can configure this dashboard.",
        );
      if (!store?.save || !jira || !viewer.jiraAccessToken)
        return sendApiError(
          response,
          503,
          "configuration_unavailable",
          "Configuration storage and viewer Jira access must be connected.",
        );
      let config;
      try {
        config = validateWidgetConfigInput(request.body);
      } catch {
        return sendApiError(
          response,
          400,
          "invalid_configuration",
          "Use one board, supported providers and only approved non-secret preferences.",
        );
      }
      try {
        await jira.getBoard(viewer.jiraAccessToken, config.boardId);
        if (
          config.preferences.showStoryPoints &&
          (!config.preferences.estimateFieldId ||
            (await jira.getBoardEstimationField(
              viewer.jiraAccessToken,
              config.boardId,
            )) !== config.preferences.estimateFieldId)
        )
          return sendApiError(
            response,
            422,
            "estimate_field_mismatch",
            "The estimate field must match the selected board’s story-point configuration.",
          );
        const sources = config.enabledProviders.length
          ? await readiness?.list(viewer.installationId)
          : [];
        if (
          config.enabledProviders.some(
            (id) =>
              !sources?.some(
                (source) =>
                  source.providerId === id && source.status === "ready",
              ),
          )
        )
          return sendApiError(
            response,
            422,
            "provider_not_ready",
            "Select only providers with verified reporting access, or disable them until access is fixed.",
          );
        const saved = await store.save(
          viewer.installationId,
          viewer.widgetInstanceKey,
          config,
        );
        configurationChanged?.(viewer.installationId, viewer.widgetInstanceKey);
        response.json({ ...saved, sources: sources ?? [] });
      } catch (error) {
        if (error instanceof JiraApiError)
          return sendApiError(
            response,
            error.code === "permission_denied" || error.httpStatus === 404
              ? 403
              : 502,
            "board_access_failed",
            "The selected board could not be verified. Check Jira access and try again.",
            error.code !== "permission_denied",
          );
        sendApiError(
          response,
          502,
          "configuration_failed",
          "Configuration could not be saved. Try again.",
          true,
        );
      }
    },
  );
}
