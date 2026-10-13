import type { Express, RequestHandler } from "express";
import { getViewerContext, rejectUnauthenticated } from "../auth/context.js";
import { requestCorrelationId } from "../requestCorrelation.js";
import type { ProviderReadinessService } from "./readiness.js";

export function registerProviderReadinessRoutes(
  app: Express,
  service: Pick<ProviderReadinessService, "list"> | undefined,
  authenticateViewer: RequestHandler,
): void {
  app.get(
    "/api/v1/admin/sources",
    authenticateViewer,
    async (_request, response) => {
      const viewer = getViewerContext(response);
      if (!viewer) {
        rejectUnauthenticated(response);
        return;
      }
      if (viewer.isAdmin !== true) {
        response.status(403).json({
          error: {
            code: "administrator_required",
            message: "Only administrators can view source readiness.",
            correlationId: requestCorrelationId(response),
            retryable: false,
          },
        });
        return;
      }
      if (!service) {
        response.status(503).json({
          error: {
            code: "source_readiness_unavailable",
            message: "Source readiness is not configured.",
            correlationId: requestCorrelationId(response),
            retryable: false,
          },
        });
        return;
      }

      try {
        response.json({ sources: await service.list(viewer.installationId) });
      } catch {
        const correlationId = requestCorrelationId(response);
        console.error("Provider readiness check failed", { correlationId });
        response.status(502).json({
          error: {
            code: "source_readiness_failed",
            message: "Provider readiness could not be checked.",
            correlationId,
            retryable: true,
          },
        });
      }
    },
  );
}
