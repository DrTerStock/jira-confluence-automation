import type {
  ProviderId,
  ProviderReadiness,
  ProviderReadinessStatus,
} from "../../../shared/types/dashboard.js";

export const PROVIDER_IDS: ProviderId[] = [
  "github_copilot",
  "openai",
  "anthropic",
];

const credentialEnvironmentVariables: Record<ProviderId, string> = {
  github_copilot: "GITHUB_COPILOT_TOKEN",
  openai: "OPENAI_ADMIN_API_KEY",
  anthropic: "ANTHROPIC_ADMIN_API_KEY",
};

export interface ProviderSecretStore {
  getCredential(
    providerId: ProviderId,
    installationId?: string,
  ): Promise<string | undefined>;
}

export class EnvironmentProviderSecretStore implements ProviderSecretStore {
  constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {}

  async getCredential(
    providerId: ProviderId,
    installationId?: string,
  ): Promise<string | undefined> {
    // Deployment-managed credentials belong to exactly one installation.
    if (
      !installationId ||
      installationId !== this.environment.DASHBOARD_INSTALLATION_ID
    )
      return undefined;
    const credential =
      this.environment[credentialEnvironmentVariables[providerId]];
    return typeof credential === "string" && credential.trim()
      ? credential
      : undefined;
  }
}

export type ProviderProbeStatus = Exclude<
  ProviderReadinessStatus,
  "configured" | "missing_credentials"
>;

export type ProviderReadinessProbe = (
  credential: string,
) => Promise<ProviderProbeStatus>;

export class ProviderReadinessProbeError extends Error {
  constructor(
    readonly status: Exclude<
      ProviderReadinessStatus,
      "ready" | "configured" | "missing_credentials"
    >,
  ) {
    super(`Provider readiness probe returned ${status}`);
    this.name = "ProviderReadinessProbeError";
  }
}

export class ProviderReadinessService {
  constructor(
    private readonly secretStore: ProviderSecretStore,
    private readonly probes: Partial<
      Record<ProviderId, ProviderReadinessProbe>
    > = {},
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(installationId?: string): Promise<ProviderReadiness[]> {
    return Promise.all(
      PROVIDER_IDS.map(async (providerId) => {
        const checkedAt = this.now().toISOString();
        let credential;
        try {
          credential = await this.secretStore.getCredential(
            providerId,
            installationId,
          );
        } catch {
          return {
            providerId,
            status: "transient_failure" as const,
            diagnosticCode: "provider_temporarily_unavailable" as const,
            checkedAt,
          };
        }
        if (!credential) {
          return {
            providerId,
            status: "missing_credentials",
            diagnosticCode: "credentials_not_configured",
            checkedAt,
          };
        }

        const probe = this.probes[providerId];
        if (!probe) {
          return {
            providerId,
            status: "configured",
            diagnosticCode: "credentials_present_unverified",
            checkedAt,
          };
        }

        try {
          const status = await probe(credential);
          return {
            providerId,
            status,
            diagnosticCode: diagnosticCodeFor(status),
            checkedAt,
          };
        } catch (error) {
          if (error instanceof ProviderReadinessProbeError) {
            return {
              providerId,
              status: error.status,
              diagnosticCode: diagnosticCodeFor(error.status),
              checkedAt,
            };
          }
          return {
            providerId,
            status: "transient_failure",
            diagnosticCode: "provider_temporarily_unavailable",
            checkedAt,
          };
        }
      }),
    );
  }
}

function diagnosticCodeFor(
  status: ProviderReadinessStatus,
): ProviderReadiness["diagnosticCode"] {
  switch (status) {
    case "ready":
      return "provider_access_verified";
    case "configured":
      return "credentials_present_unverified";
    case "missing_credentials":
      return "credentials_not_configured";
    case "permission_denied":
      return "insufficient_permissions";
    case "unsupported_coverage":
      return "unsupported_reporting_coverage";
    case "transient_failure":
      return "provider_temporarily_unavailable";
  }
}
