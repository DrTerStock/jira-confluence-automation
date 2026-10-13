// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigurationPanel } from "../../frontend/src/components/ConfigurationPanel";
import Dashboard from "../../frontend/src/Dashboard";
import { getSprintReport } from "../../backend/src/services/sprintReport";

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("mounted dashboard controls", () => {
  it("renders bootstrap permission errors without leaving protected reports visible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { error: { message: "You do not have access to this Jira data." } },
          { status: 403, headers: { "X-Correlation-ID": "fixture-reference" } },
        ),
      ),
    );
    await act(async () => {
      root.render(createElement(Dashboard));
      await settle();
    });
    expect(container.textContent).toContain("Permission denied");
    expect(container.textContent).toContain("fixture-reference");
    expect(container.querySelector("[role=alert]")).not.toBeNull();
    expect(
      container.querySelector(".refresh-button")?.hasAttribute("disabled"),
    ).toBe(true);
  });

  it("saves approved configuration from native controls and supports cancel without saving", async () => {
    const onSaved = vi.fn();
    const onCancel = vi.fn();
    const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
      if (init?.method === "PUT") {
        expect(JSON.parse(String(init.body))).toMatchObject({
          boardId: "12",
          enabledProviders: ["openai"],
        });
        return Response.json({ boardId: "12" });
      }
      return Response.json({
        boards: { values: [{ id: "12", name: "Team board" }], isLast: true },
        sources: [
          {
            providerId: "openai",
            status: "ready",
            checkedAt: "2026-10-13T12:00:00Z",
          },
          { providerId: "anthropic", status: "missing_credentials" },
        ],
      });
    });
    vi.stubGlobal("fetch", fetcher);
    await act(async () => {
      root.render(createElement(ConfigurationPanel, { onSaved, onCancel }));
      await settle();
    });
    const board = container.querySelector("select")!;
    act(() => {
      board.value = "12";
      board.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const checkboxes = container.querySelectorAll<HTMLInputElement>(
      'input[type="checkbox"]',
    );
    expect(checkboxes[1].disabled).toBe(true);
    act(() => checkboxes[0].click());
    await act(async () => {
      container
        .querySelector("form")!
        .dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
      await settle();
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    const writes = fetcher.mock.calls.filter(
      ([, init]) => init?.method === "PUT",
    ).length;
    act(() =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Cancel")!
        .click(),
    );
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(
      fetcher.mock.calls.filter(([, init]) => init?.method === "PUT"),
    ).toHaveLength(writes);
    expect(container.querySelector('input[type="password"]')).toBeNull();
  });

  it("selects active/history sprints, renders groups and bypasses cache only on explicit refresh", async () => {
    const fetcher = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith("/context"))
        return Response.json({
          widgetId: "widget-1",
          isAdmin: false,
          canEdit: false,
          config: { boardId: "12", enabledProviders: [] },
        });
      if (path.includes("?startAt"))
        return Response.json({
          values: [
            { id: "34", name: "Current", state: "active" },
            { id: "33", name: "Previous", state: "closed" },
          ],
          isLast: true,
        });
      const sprintId = path.includes("/33/") ? "33" : "34";
      const report = await getSprintReport(
        {
          getSprint: async () => ({
            id: sprintId,
            name: sprintId === "34" ? "Current" : "Previous",
            state: sprintId === "34" ? "active" : "closed",
            active: sprintId === "34",
            originBoardId: "12",
          }),
          getBoardEstimationField: async () => undefined,
          listSprintIssues: async () => ({
            issues: [
              {
                id: "1",
                key: "TEAM-1",
                summary: "Task",
                issueType: "Task",
                status: "Done",
                statusCategory: "done",
                isSubtask: false,
                browseUrl: "https://jira.example.com/browse/TEAM-1",
              },
            ],
            total: 1,
            isLast: true,
            startAt: 0,
            maxResults: 100,
          }),
        },
        "fixture-token",
        "12",
        sprintId,
      );
      expect(init?.credentials).toBe("same-origin");
      return Response.json(report);
    });
    vi.stubGlobal("fetch", fetcher);
    await act(async () => {
      root.render(createElement(Dashboard));
      await settle();
      await settle();
    });
    const selector = container.querySelector(
      'select[aria-label="Select a sprint"]',
    ) as HTMLSelectElement;
    expect(selector.value).toBe("34");
    expect(container.textContent).toContain("Current (active)");
    expect(container.textContent).toContain("Work breakdown");
    const initial = fetcher.mock.calls.find(([path]) =>
      String(path).endsWith("/report"),
    )!;
    expect(new Headers(initial[1]?.headers).has("Cache-Control")).toBe(false);
    await act(async () => {
      selector.value = "33";
      selector.dispatchEvent(new Event("change", { bubbles: true }));
      await settle();
    });
    expect(container.textContent).toContain("Previous — closed");
    await act(async () => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Refresh dashboard")!
        .click();
      await settle();
    });
    const last = fetcher.mock.calls.at(-1)!;
    expect(new Headers(last[1]?.headers).get("Cache-Control")).toBe("no-cache");
  });
});
