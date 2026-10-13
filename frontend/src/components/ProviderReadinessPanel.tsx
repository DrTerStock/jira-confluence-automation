import type {
  ProviderReadiness,
  ProviderReadinessStatus,
} from "../../../shared/types/dashboard";
import { SourceStatus } from "./SourceStatus";

const statusLabels: Record<ProviderReadinessStatus, string> = {
  ready: "Provider access verified",
  configured: "Credentials configured; provider access not verified",
  missing_credentials: "Credentials missing",
  permission_denied: "Permission denied",
  unsupported_coverage: "Unsupported reporting coverage",
  transient_failure: "Temporarily unavailable",
};

function checkedTime(timestamp: string): string | undefined {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
}

export function ProviderReadinessPanel({
  sources,
}: {
  sources?: ProviderReadiness[];
}) {
  return (
    <section aria-labelledby="provider-readiness-title" className="panel">
      <p className="eyebrow">Administrator</p>
      <h2 id="provider-readiness-title">Provider readiness</h2>
      {!sources ? (
        <SourceStatus
          status="unavailable"
          message="Provider readiness is unavailable."
        />
      ) : (
        <>
          <p className="panel__note">
            Provider credentials are provisioned in the protected backend secret
            store. This screen does not accept or display secret values.
          </p>
          <ul aria-label="Provider readiness statuses" className="issue-list">
            {sources.map(({ providerId, status, checkedAt }) => (
              <li key={providerId}>
                <strong>{providerId}</strong>
                <span>{statusLabels[status]}</span>
                <time dateTime={checkedTime(checkedAt)}>
                  {checkedTime(checkedAt)
                    ? `Checked ${checkedTime(checkedAt)}`
                    : "Check time unavailable"}
                </time>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
