import type { Request, RequestHandler, Response } from "express";
import { requestCorrelationId } from "../requestCorrelation.js";

export interface ViewerContext {
  userId: string;
  installationId: string;
  pageId: string;
  widgetInstanceKey: string;
  jiraAccessToken?: string;
  isAdmin: boolean;
  canEdit?: boolean;
}

export type TrustedViewerAuthenticationResult =
  | { status: "authenticated"; viewer: ViewerContext }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

// The host resolver must verify platform authentication and page access before
// returning a viewer; request-supplied identity and scope are never trusted.
export type TrustedViewerContextResolver = (
  request: Request,
) =>
  | TrustedViewerAuthenticationResult
  | Promise<TrustedViewerAuthenticationResult>;

const identifierPattern = /^[A-Za-z0-9._:-]{1,255}$/;

export function createTrustedViewerAuthMiddleware(
  resolveViewerContext?: TrustedViewerContextResolver,
): RequestHandler {
  return async (request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    if (!resolveViewerContext) {
      rejectUnauthenticated(response);
      return;
    }

    let result: TrustedViewerAuthenticationResult;
    try {
      result = await resolveViewerContext(request);
    } catch {
      const correlationId = requestCorrelationId(response);
      console.error("Trusted viewer authentication failed", {
        correlationId,
      });
      response.status(503).json({
        error: {
          code: "authentication_unavailable",
          message: "Dashboard access could not be verified.",
          correlationId,
          retryable: true,
        },
      });
      return;
    }

    if (!isTrustedViewerAuthenticationResult(result)) {
      sendAuthenticationUnavailable(response);
      return;
    }
    if (result.status === "unauthenticated") {
      rejectUnauthenticated(response);
      return;
    }
    if (result.status === "forbidden") {
      rejectPageAccess(response);
      return;
    }
    if (!isValidViewerContext(result.viewer)) {
      sendAuthenticationUnavailable(response);
      return;
    }

    response.locals.viewerContext = result.viewer;
    next();
  };
}

export function getViewerContext(
  response: Response,
): ViewerContext | undefined {
  return (
    response.locals as typeof response.locals & {
      viewerContext?: ViewerContext;
    }
  ).viewerContext;
}

export function rejectUnauthenticated(response: Response): void {
  response.status(401).json({
    error: {
      code: "authentication_required",
      message: "Sign in to access this dashboard.",
      correlationId: requestCorrelationId(response),
      retryable: false,
    },
  });
}

export function rejectPageAccess(response: Response): void {
  response.status(403).json({
    error: {
      code: "page_access_denied",
      message: "You do not have access to this Confluence page.",
      correlationId: requestCorrelationId(response),
      retryable: false,
    },
  });
}

export function rejectWidgetAccess(response: Response): void {
  response.status(403).json({
    error: {
      code: "widget_access_denied",
      message: "You do not have access to this dashboard.",
      correlationId: requestCorrelationId(response),
      retryable: false,
    },
  });
}

function isValidViewerContext(value: unknown): value is ViewerContext {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const viewer = value as Partial<ViewerContext>;
  return (
    typeof viewer.userId === "string" &&
    identifierPattern.test(viewer.userId) &&
    typeof viewer.installationId === "string" &&
    /^[A-Za-z0-9._:-]{1,128}$/.test(viewer.installationId) &&
    typeof viewer.pageId === "string" &&
    identifierPattern.test(viewer.pageId) &&
    typeof viewer.widgetInstanceKey === "string" &&
    identifierPattern.test(viewer.widgetInstanceKey) &&
    typeof viewer.isAdmin === "boolean" &&
    (viewer.canEdit === undefined || typeof viewer.canEdit === "boolean") &&
    (viewer.jiraAccessToken === undefined ||
      (typeof viewer.jiraAccessToken === "string" &&
        viewer.jiraAccessToken.trim().length > 0))
  );
}

function isTrustedViewerAuthenticationResult(
  value: unknown,
): value is TrustedViewerAuthenticationResult {
  if (typeof value !== "object" || value === null || !("status" in value)) {
    return false;
  }
  const result = value as { status?: unknown };
  return (
    result.status === "authenticated" ||
    result.status === "unauthenticated" ||
    result.status === "forbidden"
  );
}

function sendAuthenticationUnavailable(response: Response): void {
  const correlationId = requestCorrelationId(response);
  console.error("Trusted viewer authentication returned invalid context", {
    correlationId,
  });
  response.status(503).json({
    error: {
      code: "authentication_unavailable",
      message: "Dashboard access could not be verified.",
      correlationId,
      retryable: true,
    },
  });
}
