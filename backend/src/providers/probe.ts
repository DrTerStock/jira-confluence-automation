import type { ProviderReadinessProbe } from "./readiness.js";
import { ProviderReadinessProbeError } from "./readiness.js";
import { ProviderUsageError, type ProviderUsageAdapter } from "./usage.js";
import { enforceProviderMetricPolicy } from "./metricPolicy.js";

export function createProviderReadinessProbe(
  adapter: ProviderUsageAdapter,
  now: () => Date = () => new Date(),
): ProviderReadinessProbe {
  return async (credential) => {
    const today = now();
    const yesterday = new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate() - 1,
      ),
    )
      .toISOString()
      .slice(0, 10);
    try {
      const result = enforceProviderMetricPolicy(
        await adapter.fetchUsage(credential, {
          from: yesterday,
          to: yesterday,
        }),
      );
      if (result.status === "permission_denied")
        throw new ProviderReadinessProbeError("permission_denied");
      if (
        result.status === "unavailable" ||
        ((result.status === "partial" ||
          result.unsupportedMetrics.length > 0) &&
          result.metrics.length === 0)
      ) {
        throw new ProviderReadinessProbeError("unsupported_coverage");
      }
      if (result.status === "failed" || result.status === "rate_limited") {
        throw new ProviderReadinessProbeError("transient_failure");
      }
      return "ready";
    } catch (error) {
      if (error instanceof ProviderReadinessProbeError) {
        throw error;
      }
      if (!(error instanceof ProviderUsageError)) {
        throw error;
      }
      const status =
        error.status === "permission_denied"
          ? "permission_denied"
          : error.status === "unavailable"
            ? "unsupported_coverage"
            : "transient_failure";
      throw new ProviderReadinessProbeError(status);
    }
  };
}
