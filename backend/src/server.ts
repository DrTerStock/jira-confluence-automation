import express, {
  type Express,
  type ErrorRequestHandler,
  type RequestHandler,
} from "express";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";
import {
  createTrustedViewerAuthMiddleware,
  getViewerContext,
  rejectWidgetAccess,
  type TrustedViewerContextResolver,
} from "./auth/context.js";
import type { JiraClient } from "./jira/client.js";
import type { WidgetConfigStore } from "./config/widgetConfig.js";
import { registerJiraRoutes } from "./jira/routes.js";
import { registerProviderReadinessRoutes } from "./providers/routes.js";
import type { ProviderReadinessService } from "./providers/readiness.js";
import { registerProviderUsageRoutes } from "./providers/usageRoutes.js";
import type { ProviderUsageService } from "./providers/usage.js";
import { ProviderUsageReportCache } from "./providers/reportCache.js";

import { registerWidgetConfigRoutes } from "./config/routes.js";

import type { SprintObservationStore } from "./storage/sprintObservations.js";

interface Database {
  query: (sql: string) => Promise<unknown>;
}

export function createApp(
  database: Database = new Pool({ connectionString: process.env.DATABASE_URL }),
  options: {
    requestLogger?: (entry: {
      operation: string;
      correlationId: string;
      durationMs: number;
      errorCategory: string;
    }) => void;
    sprintObservationStore?: SprintObservationStore;
    jiraClient?: JiraClient;
    resolveViewerContext?: TrustedViewerContextResolver;
    widgetConfigStore?: Pick<WidgetConfigStore, "get"> &
      Partial<Pick<WidgetConfigStore, "deleteInstallation" | "save">>;
    providerUsageReportCache?: ProviderUsageReportCache;
    providerReadinessService?: Pick<ProviderReadinessService, "list">;
    providerUsageService?: ProviderUsageService;
  } = {},
): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const startedAt = performance.now();
    const correlationId = randomUUID();
    response.locals.correlationId = correlationId;
    response.setHeader("X-Correlation-ID", correlationId);
    response.once("finish", () => {
      const entry = {
        operation: request.route?.path ?? "unmatched",
        correlationId,
        durationMs: Math.round(performance.now() - startedAt),
        errorCategory:
          response.locals.errorCategory ??
          (response.statusCode >= 400 ? `http_${response.statusCode}` : "none"),
      };
      options.requestLogger?.(entry);
    });
    next();
  });
  app.use(express.json({ limit: "32kb" }));
  const authenticateHostViewer = createTrustedViewerAuthMiddleware(
    options.resolveViewerContext,
  );
  const providerUsageReportCache =
    options.providerUsageReportCache ?? new ProviderUsageReportCache();
  const authenticateViewer: RequestHandler = (request, response, next) => {
    void authenticateHostViewer(request, response, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      const viewer = getViewerContext(response);
      if (
        viewer &&
        providerUsageReportCache.isInstallationRemoved(viewer.installationId)
      ) {
        rejectWidgetAccess(response);
        return;
      }
      next();
    });
  };
  registerWidgetConfigRoutes(
    app,
    authenticateViewer,
    options.widgetConfigStore,
    options.jiraClient,
    options.providerReadinessService,
    (id, widget) => providerUsageReportCache.purgeWidget(id, widget),
  );
  registerJiraRoutes(
    app,
    options.jiraClient,
    authenticateViewer,
    options.widgetConfigStore,
    options.sprintObservationStore,
    (id) => providerUsageReportCache.isInstallationRemoved(id),
  );
  registerProviderReadinessRoutes(
    app,
    options.providerReadinessService,
    authenticateViewer,
  );
  registerProviderUsageRoutes(
    app,
    options.providerUsageService,
    options.widgetConfigStore,
    authenticateViewer,
    providerUsageReportCache,
  );
  app.locals.purgeInstallationData = async (installationId: string) => {
    if (
      !options.widgetConfigStore ||
      !("deleteInstallation" in options.widgetConfigStore) ||
      typeof options.widgetConfigStore.deleteInstallation !== "function"
    ) {
      throw new Error("Installation data purge is not configured");
    }
    providerUsageReportCache.purgeInstallation(installationId);
    await options.widgetConfigStore.deleteInstallation(installationId);
  };

  app.get("/healthz", (_request, response) => {
    response.status(200).json({ status: "ok" });
  });

  app.get("/readyz", async (_request, response) => {
    try {
      await database.query("SELECT 1");
      response.status(200).json({ status: "ready" });
    } catch {
      console.warn("Database readiness check failed");
      response
        .status(503)
        .json({ status: "not_ready", reason: "database_unavailable" });
    }
  });

  const handleError: ErrorRequestHandler = (
    error,
    _request,
    response,
    next,
  ) => {
    if (response.headersSent) {
      next(error);
      return;
    }
    const status =
      error?.type === "entity.parse.failed"
        ? 400
        : error?.type === "entity.too.large"
          ? 413
          : 500;
    response.status(status).json({
      error: {
        code: status === 500 ? "request_failed" : "invalid_request_body",
        message:
          status === 500
            ? "The request could not be completed."
            : "Provide a valid JSON request within the size limit.",
        correlationId: response.locals.correlationId,
        retryable: status === 500,
      },
    });
  };
  app.use(handleError);
  return app;
}
