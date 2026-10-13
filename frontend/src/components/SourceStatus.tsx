import type {
  DashboardStatus,
  StatusMessage as StatusMessageModel,
} from "../../../shared/types/dashboard";

const statusLabels: Record<DashboardStatus, string> = {
  success: "Available",
  loading: "Loading",
  empty: "No data",
  partial: "Partial data",
  stale: "Stale data",
  unavailable: "Unavailable",
  permission_denied: "Permission denied",
  rate_limited: "Rate limited",
  failed: "Failed",
};

interface SourceStatusProps extends StatusMessageModel {
  source?: string;
}

export function SourceStatus({ status, message, source }: SourceStatusProps) {
  const isFailure = status === "permission_denied" || status === "failed";

  return (
    <p
      className={`source-status source-status--${status}`}
      role={isFailure ? "alert" : "status"}
      aria-live={isFailure ? "assertive" : "polite"}
    >
      <strong>
        {source ? `${source}: ` : ""}
        {statusLabels[status]}.
      </strong>{" "}
      {message}
    </p>
  );
}
