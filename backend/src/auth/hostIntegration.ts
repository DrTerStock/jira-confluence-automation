import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";
import type { TrustedViewerContextResolver } from "./context.js";

export interface HostIntegration {
  resolveViewerContext: TrustedViewerContextResolver;
  registerInstallationRemoval?: (
    purge: (installationId: string) => Promise<void>,
  ) => void | Promise<void>;
}

// Only a deployment-controlled local module can provide platform verification.
// The module must verify session/page/widget/editor context and removal events.
export async function loadHostIntegration(
  modulePath: string | undefined,
  importer: (url: string) => Promise<unknown> = (url) => import(url),
): Promise<HostIntegration | undefined> {
  if (!modulePath) return undefined;
  if (!isAbsolute(modulePath))
    throw new Error(
      "DASHBOARD_HOST_MODULE must be an absolute local module path",
    );
  const loaded = await importer(pathToFileURL(modulePath).href);
  if (
    typeof loaded !== "object" ||
    loaded === null ||
    !("resolveViewerContext" in loaded) ||
    typeof loaded.resolveViewerContext !== "function"
  )
    throw new Error("Host integration must export resolveViewerContext");
  const host = loaded as HostIntegration;
  if (
    host.registerInstallationRemoval !== undefined &&
    typeof host.registerInstallationRemoval !== "function"
  )
    throw new Error("Invalid installation-removal integration");
  return host;
}
