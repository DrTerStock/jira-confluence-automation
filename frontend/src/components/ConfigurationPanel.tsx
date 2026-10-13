import { useEffect, useState } from "react";
import type {
  ProviderId,
  ProviderReadiness,
} from "../../../shared/types/dashboard";

export interface EditableConfig {
  boardId: string;
  enabledProviders: ProviderId[];
  preferences?: {
    showStoryPoints?: boolean;
    estimateFieldId?: string;
    blockedStatusNames?: string[];
  };
}

export function ConfigurationPanel({
  config,
  onSaved,
  onCancel,
}: {
  config?: EditableConfig | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [boardId, setBoardId] = useState(config?.boardId ?? "");
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);
  const [sources, setSources] = useState<ProviderReadiness[]>([]);
  const [enabled, setEnabled] = useState(config?.enabledProviders ?? []);
  const [showPoints, setShowPoints] = useState(
    config?.preferences?.showStoryPoints ?? false,
  );
  const [estimateField, setEstimateField] = useState(
    config?.preferences?.estimateFieldId ?? "",
  );
  const [blockedStatuses, setBlockedStatuses] = useState(
    config?.preferences?.blockedStatusNames?.join(", ") ?? "",
  );
  const [nextPage, setNextPage] = useState<number | undefined>(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadPage(startAt: number, signal?: AbortSignal) {
    const response = await fetch(
      `/api/v1/dashboard/options?startAt=${startAt}`,
      { credentials: "same-origin", signal },
    );
    const body = await response.json();
    if (!response.ok)
      throw new Error(
        body.error?.message ?? "Board and source choices could not be loaded.",
      );
    setBoards((previous) => [
      ...new Map(
        [...previous, ...body.boards.values].map((board) => [board.id, board]),
      ).values(),
    ]);
    setSources(body.sources);
    setNextPage(
      body.boards.isLast || body.boards.values.length === 0
        ? undefined
        : startAt + body.boards.values.length,
    );
  }
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true);
    void loadPage(0, controller.signal)
      .catch((error) => {
        if (!controller.signal.aborted) setMessage(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, []);

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/dashboard/config", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          boardId,
          enabledProviders: enabled,
          preferences: {
            showStoryPoints: showPoints,
            ...(showPoints && { estimateFieldId: estimateField }),
            blockedStatusNames: blockedStatuses
              .split(",")
              .map((status) => status.trim())
              .filter(Boolean),
          },
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error?.message ?? "Configuration could not be saved.",
        );
      onSaved();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Configuration could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" aria-labelledby="configuration-title">
      <h2 id="configuration-title">Dashboard configuration</h2>
      <p>
        Choose a Jira board and providers with verified reporting access.
        Credentials are managed by the administrator.
      </p>
      {message && <p role="alert">{message}</p>}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy}>
          <legend>Reporting sources and preferences</legend>
          <label>
            Jira board
            <select
              required
              value={boardId}
              onChange={(event) => setBoardId(event.target.value)}
            >
              <option value="">Select a board</option>
              {boardId && !boards.some((board) => board.id === boardId) && (
                <option value={boardId}>Configured board {boardId}</option>
              )}
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </label>
          {nextPage !== undefined && (
            <button
              type="button"
              onClick={() => {
                setBusy(true);
                void loadPage(nextPage)
                  .catch((error) => setMessage(error.message))
                  .finally(() => setBusy(false));
              }}
            >
              Load more boards
            </button>
          )}
          <fieldset>
            <legend>AI providers</legend>
            {sources.map((source) => (
              <label key={source.providerId}>
                <input
                  type="checkbox"
                  checked={enabled.includes(source.providerId)}
                  disabled={
                    source.status !== "ready" &&
                    !enabled.includes(source.providerId)
                  }
                  onChange={(event) =>
                    setEnabled((previous) =>
                      event.target.checked
                        ? [...previous, source.providerId]
                        : previous.filter((id) => id !== source.providerId),
                    )
                  }
                />
                {source.providerId}: {source.status}
              </label>
            ))}
          </fieldset>
          <label>
            <input
              type="checkbox"
              checked={showPoints}
              onChange={(event) => setShowPoints(event.target.checked)}
            />
            Show configured story points
          </label>
          {showPoints && (
            <label>
              Estimate field
              <input
                required
                pattern="customfield_[0-9]+"
                value={estimateField}
                onChange={(event) => setEstimateField(event.target.value)}
                placeholder="customfield_10001"
              />
            </label>
          )}
          <label>
            Blocked Jira statuses (comma separated)
            <input
              value={blockedStatuses}
              onChange={(event) => setBlockedStatuses(event.target.value)}
            />
          </label>
          <button type="submit">
            {busy ? "Saving or loading…" : "Save configuration"}
          </button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </fieldset>
      </form>
    </section>
  );
}
