export type DashboardStatus =
  | "success"
  | "loading"
  | "empty"
  | "partial"
  | "stale"
  | "unavailable"
  | "permission_denied"
  | "rate_limited"
  | "failed";

export interface StatusMessage {
  status: DashboardStatus;
  message: string;
}

export type ProviderId = "github_copilot" | "openai" | "anthropic";

export type ProviderReadinessStatus =
  | "ready"
  | "configured"
  | "missing_credentials"
  | "permission_denied"
  | "unsupported_coverage"
  | "transient_failure";

export interface ProviderReadiness {
  providerId: ProviderId;
  status: ProviderReadinessStatus;
  diagnosticCode:
    | "provider_access_verified"
    | "credentials_not_configured"
    | "credentials_present_unverified"
    | "insufficient_permissions"
    | "unsupported_reporting_coverage"
    | "provider_temporarily_unavailable";
  checkedAt: string;
}

export interface ReportingPeriod {
  from: string;
  to: string;
}

export interface UsageMetric {
  name: string;
  value: string;
  unit: string;
  kind: "reported" | "estimated";
  currency: string | null;
}

export type ProviderUsageStatus =
  | "success"
  | "partial"
  | "empty"
  | "stale"
  | "unavailable"
  | "permission_denied"
  | "rate_limited"
  | "failed";

export interface ProviderUsageSource {
  id: ProviderId;
  status: ProviderUsageStatus;
  requestedPeriod: ReportingPeriod;
  actualPeriod?: ReportingPeriod;
  lastSuccessfulAt?: string;
  metrics: UsageMetric[];
  unsupportedMetrics: string[];
  metricDefinitions?: Record<
    string,
    { providerName: string; description: string }
  >;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

export interface UsageReport {
  requestedPeriod: ReportingPeriod;
  sources: ProviderUsageSource[];
  compatibleTotals: CompatibleUsageTotal[];
}

export interface CompatibleUsageTotal extends UsageMetric {
  sourceIds: ProviderId[];
}

export interface BurndownHistory {
  source: "jira" | "manual_snapshot";
  unit: "issues" | "story_points";
  provenance: string;
  observations: Array<{
    observedAt: string;
    remaining: number;
  }>;
}

export interface SprintReport {
  sprint: {
    id: string;
    name: string;
    state: "active" | "closed" | "future";
    startDate?: string;
    endDate?: string;
  };
  progress: {
    issueCount: {
      completed: number;
      remaining: number;
      unclassified: number;
      total: number;
    };
    estimate?: {
      unit: "story_points";
      completed: number | null;
      remaining: number | null;
      unclassified: number | null;
      estimatedIssueCount: number;
      totalIssueCount: number;
      status: "complete" | "partial" | "unavailable";
      unavailableReason?:
        | "board_configuration_permission_denied"
        | "board_field_mismatch"
        | "no_estimates";
    };
  };
  blockers:
    | {
        status: "success";
        count: number;
        issues: SprintReport["issues"];
      }
    | {
        status: "unavailable";
        count: null;
        issues: [];
      };
  burndown?: BurndownHistory;
  issues: Array<{
    id: string;
    key: string;
    summary: string;
    issueType: string;
    status: string;
    assignee?: string;
    browseUrl: string;
  }>;
  groups: Array<{
    dimension: "status" | "issue_type";
    key: string;
    count: number;
  }>;
  coverage: {
    fetchedIssueCount: number;
    includedIssueCount: number;
    reportedIssueCount: number;
    complete: boolean;
  };
  source: {
    id: "jira";
    status: "success" | "partial";
    retrievedAt: string;
    completeness: "complete" | "partial";
  };
}
