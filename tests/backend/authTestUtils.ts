import type {
  TrustedViewerContextResolver,
  ViewerContext,
} from "../../backend/src/auth/context.js";

const defaultViewer: ViewerContext = {
  userId: "viewer-1",
  installationId: "trusted-installation",
  pageId: "page-1",
  widgetInstanceKey: "widget-1",
  jiraAccessToken: "viewer-token",
  isAdmin: false,
};

export function trustedViewerContextResolver(
  overrides: Partial<ViewerContext> = {},
): TrustedViewerContextResolver {
  return () => ({
    status: "authenticated",
    viewer: { ...defaultViewer, ...overrides },
  });
}
