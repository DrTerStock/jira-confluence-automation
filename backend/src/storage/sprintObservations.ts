import type { Pool } from "pg";
import type {
  BurndownHistory,
  SprintReport,
} from "../../../shared/types/dashboard.js";

export interface ObservationScope {
  installationId: string;
  widgetInstanceKey: string;
  viewerId: string;
  boardId: string;
  sprintId: string;
}

export class SprintObservationStore {
  constructor(private readonly database: Pick<Pool, "query">) {}

  async expire(): Promise<void> {
    await this.database.query(
      "DELETE FROM sprint_observations WHERE observed_at <= now() - interval '30 days'",
    );
  }

  async history(
    scope: ObservationScope,
    report?: SprintReport,
  ): Promise<BurndownHistory | undefined> {
    await this.expire();
    const values = [
      scope.installationId,
      scope.widgetInstanceKey,
      scope.viewerId,
      scope.boardId,
      scope.sprintId,
    ];
    // Only complete, classified observations collected during manual refresh
    // become history. Never extrapolate earlier sprint points.
    if (
      report?.coverage.complete &&
      report.progress.issueCount.unclassified === 0
    ) {
      await this.database.query(
        `INSERT INTO sprint_observations (installation_id, widget_instance_key, viewer_id, board_id, sprint_id, remaining_issue_count) VALUES ($1, $2, $3, $4, $5, $6)`,
        [...values, report.progress.issueCount.remaining],
      );
    }
    const rows = await this.database.query<{
      observed_at: Date;
      remaining_issue_count: number;
    }>(
      `SELECT observed_at, remaining_issue_count FROM sprint_observations WHERE installation_id = $1 AND widget_instance_key = $2 AND viewer_id = $3 AND board_id = $4 AND sprint_id = $5 AND observed_at > now() - interval '30 days' ORDER BY observed_at DESC LIMIT 500`,
      values,
    );
    if (!rows.rows.length) return undefined;
    return {
      source: "manual_snapshot",
      unit: "issues",
      provenance:
        "Complete viewer-authorized sprint issue counts collected at manual refresh time; no points before the first observation.",
      observations: rows.rows.reverse().map((row) => ({
        observedAt: row.observed_at.toISOString(),
        remaining: row.remaining_issue_count,
      })),
    };
  }
}
