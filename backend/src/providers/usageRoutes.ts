import type { Express, RequestHandler, Response } from "express";
import {
  getViewerContext,
  rejectUnauthenticated,
  rejectWidgetAccess,
} from "../auth/context.js";
import type {
  WidgetConfig,
  WidgetConfigStore,
} from "../config/widgetConfig.js";
import { CONFIGURABLE_PROVIDERS } from "../config/widgetConfig.js";
import { requestCorrelationId } from "../requestCorrelation.js";
import type { ProviderId } from "../../../shared/types/dashboard.js";
import {
  ProviderUsageConfigurationError,
  ProviderUsageService,
} from "./usage.js";
import {
  isCacheableUsageReport,
  ProviderUsageReportCache,
} from "./reportCache.js";

import { RequestCapacityError } from "../requestWork.js";

const widgetKeyPattern = /^[A-Za-z0-9._:-]{1,255}$/;
const providerIdSet = new Set<string>(CONFIGURABLE_PROVIDERS);

export function registerProviderUsageRoutes(
  app: Express,
  service: ProviderUsageService | undefined,
  widgetConfigStore: Pick<WidgetConfigStore, "get"> | undefined,
  authenticateViewer: RequestHandler,
  reportCache: ProviderUsageReportCache,
): void {
  app.get(
    "/api/v1/usage/report",
    authenticateViewer,
    async (request, response) => {
      const viewer = getViewerContext(response);
      if (!viewer) {
        rejectUnauthenticated(response);
        return;
      }
      if (!service || !widgetConfigStore) {
        response.status(503).json({
          error: {
            code: "usage_reporting_unavailable",
            message: "Provider usage reporting is not configured.",
            correlationId: requestCorrelationId(response),
            retryable: false,
          },
        });
        return;
      }

      const query = request.query;
      if (
        Object.keys(query).some(
          (key) =>
            !["widgetId", "from", "to", "providers", "providers[]"].includes(
              key,
            ),
        ) ||
        typeof query.widgetId !== "string" ||
        !widgetKeyPattern.test(query.widgetId) ||
        typeof query.from !== "string" ||
        typeof query.to !== "string"
      ) {
        sendInvalidRequest(response);
        return;
      }
      if (query.widgetId !== viewer.widgetInstanceKey) {
        rejectWidgetAccess(response);
        return;
      }

      let config: WidgetConfig | undefined;
      try {
        config = await widgetConfigStore.get(
          viewer.installationId,
          query.widgetId,
        );
      } catch {
        const correlationId = requestCorrelationId(response);
        console.error("Widget configuration lookup failed", {
          correlationId,
        });
        response.status(502).json({
          error: {
            code: "widget_configuration_failed",
            message: "The dashboard configuration could not be loaded.",
            correlationId,
            retryable: true,
          },
        });
        return;
      }
      if (!config) {
        response.status(404).json({
          error: {
            code: "widget_configuration_not_found",
            message: "The dashboard configuration could not be found.",
            correlationId: requestCorrelationId(response),
            retryable: false,
          },
        });
        return;
      }

      const rawProviders = query.providers ?? query["providers[]"];
      const requestedProviders =
        rawProviders === undefined
          ? config.enabledProviders
          : Array.isArray(rawProviders)
            ? rawProviders
            : [rawProviders];
      const providerIds: ProviderId[] = [];
      for (const provider of requestedProviders) {
        if (typeof provider !== "string" || !isProviderId(provider)) {
          sendInvalidRequest(response);
          return;
        }
        providerIds.push(provider);
      }
      if (
        providerIds.length === 0 ||
        new Set(providerIds).size !== providerIds.length
      ) {
        sendInvalidRequest(response);
        return;
      }
      if (
        providerIds.some(
          (provider) => !config.enabledProviders.includes(provider),
        )
      ) {
        response.status(403).json({
          error: {
            code: "provider_not_enabled",
            message:
              "The requested provider is not enabled for this dashboard.",
            correlationId: requestCorrelationId(response),
            retryable: false,
          },
        });
        return;
      }

      if (reportCache.isInstallationRemoved(viewer.installationId)) {
        rejectWidgetAccess(response);
        return;
      }
      const cacheKey = JSON.stringify([
        viewer.installationId,
        viewer.pageId,
        viewer.widgetInstanceKey,
        config.boardId,
        viewer.userId,
        providerIds,
        query.from,
        query.to,
      ]);
      const bypassCache = /(?:^|,)\s*no-cache\b/i.test(
        request.get("Cache-Control") ?? "",
      );
      if (bypassCache) {
        reportCache.delete(cacheKey);
      } else {
        const cached = reportCache.get(cacheKey);
        if (cached) {
          response.json(cached.report);
          return;
        }
      }

      const period = { from: query.from, to: query.to };
      const configurationRevision = reportCache.configurationRevision;
      try {
        const report = await reportCache.run(
          JSON.stringify([cacheKey, configurationRevision]),
          viewer.installationId,
          () => service.getReport(providerIds, period, viewer.installationId),
        );
        if (
          configurationRevision === reportCache.configurationRevision &&
          isCacheableUsageReport(report)
        ) {
          reportCache.set(
            cacheKey,
            viewer.installationId,
            viewer.widgetInstanceKey,
            report,
            new Date().toISOString(),
          );
        }
        if (reportCache.isInstallationRemoved(viewer.installationId)) {
          rejectWidgetAccess(response);
          return;
        }
        response.json(report);
      } catch (error) {
        if (error instanceof RequestCapacityError) {
          response.status(429).json({
            error: {
              code: "refresh_capacity",
              message: "Too many refreshes are running. Try again shortly.",
              correlationId: requestCorrelationId(response),
              retryable: true,
              retryAfterSeconds: 1,
            },
          });
          return;
        }
        if (error instanceof ProviderUsageConfigurationError) {
          response.status(422).json({
            error: {
              code: "provider_not_configured",
              message: "A requested provider is not configured for reporting.",
              correlationId: requestCorrelationId(response),
              retryable: false,
            },
          });
          return;
        }
        if (
          error instanceof Error &&
          error.message.startsWith("Reporting period")
        ) {
          sendInvalidRequest(response);
          return;
        }
        const correlationId = requestCorrelationId(response);
        console.error("Provider usage report failed", { correlationId });
        response.status(502).json({
          error: {
            code: "provider_usage_failed",
            message: "Provider usage could not be retrieved.",
            correlationId,
            retryable: true,
          },
        });
      }
    },
  );
}

function isProviderId(value: string): value is ProviderId {
  return providerIdSet.has(value);
}

function sendInvalidRequest(response: Response): void {
  response.status(400).json({
    error: {
      code: "invalid_usage_report_request",
      message:
        "Provide a configured widget, valid dates, and only enabled providers.",
      correlationId: requestCorrelationId(response),
      retryable: false,
    },
  });
}
