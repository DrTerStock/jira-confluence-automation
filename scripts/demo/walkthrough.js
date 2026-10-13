import { chromium } from "playwright-core";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const output = fileURLToPath(
  new URL("../../reports/walkthrough", import.meta.url),
);
await mkdir(output, { recursive: true });
// Run against a freshly started local mock demo and the normal frontend.
const chromePath =
  process.env.CHROME_PATH ??
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : "/usr/bin/google-chrome");
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, status: "pass" });
    console.log("PASS " + name);
  } catch (e) {
    results.push({ name, status: "fail", message: e.message });
    console.log("FAIL " + name + ": " + e.message);
    await shot("failure-" + results.length);
    console.log((await body()).slice(0, 1800));
  }
}
function assert(value, message) {
  if (!value) throw new Error(message);
}
async function shot(name) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}
async function body() {
  return page.locator("body").innerText();
}
async function reset(
  role = "admin",
  widget = "widget-1",
  scenario = "success",
) {
  await context.addCookies([
    { name: "demo_role", value: role, url: "http://127.0.0.1:5174" },
    { name: "demo_widget", value: widget, url: "http://127.0.0.1:5174" },
    { name: "demo_scenario", value: scenario, url: "http://127.0.0.1:5174" },
  ]);
  await page.goto("http://127.0.0.1:5174");
  if (role === "denied" || widget === "new-widget") return;
  await page
    .getByRole("button", { name: "Refresh dashboard", exact: true })
    .waitFor({ state: "visible", timeout: 15000 });
  await page.waitForFunction(
    () =>
      document.querySelector(".refresh-button") &&
      !document.querySelector(".refresh-button").disabled,
    { timeout: 15000 },
  );
}
async function refresh() {
  const b = page.getByRole("button", {
    name: "Refresh dashboard",
    exact: true,
  });
  await b.click();
  await page.waitForFunction(
    () => !document.querySelector(".refresh-button")?.disabled,
  );
}
await check("Normal startup rejects unverified access", async () => {
  await page.goto("http://127.0.0.1:5173");
  await page
    .getByText("Sign in to access this dashboard.", { exact: false })
    .waitFor();
  assert(
    (await body()).includes("Permission denied"),
    "No permission-specific error",
  );
  await shot("01-unverified-access");
});
await check(
  "New widget displays configuration entry and unavailable history",
  async () => {
    await reset("admin", "new-widget");
    await page
      .getByText("A page editor must configure", { exact: false })
      .waitFor();
    assert(
      (await body()).includes("Burndown history unavailable"),
      "Missing unavailable chart",
    );
    await shot("02-unconfigured");
  },
);
await check(
  "Configuration saves board, providers and explicit preferences without secrets",
  async () => {
    await page
      .getByRole("button", { name: "Configure dashboard", exact: true })
      .click();
    const panel = page.locator(
      'section[aria-labelledby="configuration-title"]',
    );
    await panel.getByLabel("Jira board").selectOption("12");
    await panel.getByLabel("openai: ready", { exact: true }).check();
    await panel.getByLabel("anthropic: ready", { exact: true }).check();
    await panel.getByLabel("github_copilot: ready", { exact: true }).check();
    await panel
      .getByLabel("Blocked Jira statuses (comma separated)")
      .fill("Blocked");
    await panel.getByLabel("Show configured story points").check();
    await panel.getByLabel("Estimate field").fill("customfield_10001");
    assert(
      (await panel.locator("input[type=password]").count()) === 0,
      "Secret field exists",
    );
    await shot("03-editor-configuration");
    await panel
      .getByRole("button", { name: "Save configuration", exact: true })
      .click();
    await page.getByText("Current sprint — active").waitFor();
    await shot("04-configured-dashboard");
  },
);
await check(
  "Summary filters epics/subtasks, groups work and shows explicit blockers",
  async () => {
    const text = await body();
    assert(text.includes("Synthetic task 2"), "Blocker missing");
    assert(
      !text.includes("Synthetic epic 4") &&
        !text.includes("Synthetic sub-task 5"),
      "Excluded issue displayed",
    );
    assert(text.includes("Work breakdown"), "Groups missing");
    assert(
      text.includes("2 of 3 issues estimated"),
      "Missing estimate coverage not shown",
    );
    assert(
      (await page
        .locator('a[href="https://jira.example.invalid/browse/DEMO-2"]')
        .count()) > 0,
      "Jira link missing",
    );
  },
);
await check("Manual refresh creates dated PostgreSQL history", async () => {
  assert(
    (await body()).includes("Burndown history unavailable"),
    "Initial load invented history",
  );
  await refresh();
  await page
    .getByText("Complete viewer-authorized sprint issue counts", {
      exact: false,
    })
    .waitFor();
  await shot("05-manual-history");
});
await check("Historical sprint selection works", async () => {
  await page.getByLabel("Select a sprint", { exact: true }).selectOption("33");
  await page.getByText("Previous sprint — closed").waitFor();
  await shot("06-historical-sprint");
  await page.getByLabel("Select a sprint", { exact: true }).selectOption("34");
  await page.getByText("Current sprint — active").waitFor();
});
await check(
  "Date range and provider controls update scoped reports",
  async () => {
    const dates = page.locator("fieldset.date-range").filter({
      has: page.getByText("Usage reporting period", { exact: true }),
    });
    await dates
      .getByLabel("From", { exact: true })
      .fill(new Date(Date.now() - 86400000).toISOString().slice(0, 10));
    await page
      .getByRole("button", { name: "Refresh dashboard", exact: true })
      .waitFor();
    await page.waitForFunction(
      () => !document.querySelector(".refresh-button")?.disabled,
    );
    const sources = page.getByRole("group", { name: "Displayed AI sources" });
    await sources.getByLabel("anthropic", { exact: true }).uncheck();
    await page.waitForFunction(
      () => !document.querySelector(".refresh-button")?.disabled,
    );
    assert(
      (await page
        .getByRole("heading", { name: "Anthropic", exact: true })
        .count()) === 0,
      "Deselected source remains",
    );
    await sources.getByLabel("anthropic", { exact: true }).check();
    await page.waitForFunction(
      () => !document.querySelector(".refresh-button")?.disabled,
    );
    await page.waitForFunction(() =>
      document.body.innerText.includes("0 tokens"),
    );
  },
);
await check(
  "Provider failure preserves good and retained data with stale warning",
  async () => {
    await page.getByLabel("Demo scenario").selectOption("partial");
    await refresh();
    const text = await body();
    assert(text.includes("Stale data"), "Retained failure not marked stale");
    assert(
      text.includes("Synthetic Anthropic failure"),
      "Safe source error missing",
    );
    assert(
      text.includes("OpenAI") && text.includes("0 tokens"),
      "Good source lost",
    );
    await shot("07-retained-provider-failure");
  },
);
await check(
  "Fresh mixed provider report has prominent partial status",
  async () => {
    await reset("admin", "widget-1", "partial");
    assert((await body()).includes("Partial data"), "Overall partial missing");
    await shot("08-partial-report");
  },
);
await check("Jira denial clears retained protected data", async () => {
  await reset();
  await page.getByLabel("Demo scenario").selectOption("jira-denied");
  await refresh();
  const text = await body();
  assert(text.includes("Permission denied"), "Permission state missing");
  assert(
    !text.includes("Synthetic task 2"),
    "Protected issue retained after denial",
  );
  await shot("09-jira-denied");
});
await check(
  "Jira rate limit exposes retry guidance and retained stale result",
  async () => {
    await reset();
    await page.getByLabel("Demo scenario").selectOption("jira-rate");
    await refresh();
    const text = await body();
    assert(text.includes("10 seconds"), "Retry delay missing");
    assert(text.includes("Stale data"), "Retained Jira is not stale");
    await shot("10-jira-rate-limit");
  },
);
await check(
  "Successful empty provider query is distinct from zero",
  async () => {
    await reset("admin", "widget-1", "empty");
    await refresh();
    const text = await body();
    assert(text.includes("No data"), "Empty status missing");
    assert(
      text.includes("not a zero-valued report"),
      "Empty semantics missing",
    );
    await shot("11-empty-usage");
  },
);
await check("Viewer cannot configure or read admin readiness", async () => {
  await reset("viewer");
  assert(
    (await page
      .getByRole("button", { name: "Configure dashboard", exact: true })
      .count()) === 0,
    "Viewer can configure",
  );
  assert(
    (await page
      .getByRole("heading", { name: "Provider readiness", exact: true })
      .count()) === 0,
    "Viewer can see admin panel",
  );
  const denied = await page.request.put(
    "http://127.0.0.1:5174/api/v1/dashboard/config",
    { data: { boardId: "12", enabledProviders: [], preferences: {} } },
  );
  assert(denied.status() === 403, "Backend accepted viewer edit");
  await shot("12-viewer");
});
await check(
  "Trusted editor can configure without administrator readiness access",
  async () => {
    await reset("editor");
    await page
      .getByRole("button", { name: "Configure dashboard", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "Dashboard configuration", exact: true })
      .waitFor();
    assert(
      (await page
        .getByRole("heading", { name: "Provider readiness", exact: true })
        .count()) === 0,
      "Editor sees admin-only readiness",
    );
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert(
      (await page
        .getByRole("heading", { name: "Dashboard configuration", exact: true })
        .count()) === 0,
      "Cancel did not close form",
    );
  },
);
await check(
  "Second widget has independent board and enabled sources",
  async () => {
    await reset("admin", "widget-2");
    const text = await body();
    assert(text.includes("Board 13"), "Second board missing");
    assert(
      (await page
        .getByRole("heading", { name: "Anthropic", exact: true })
        .count()) === 0,
      "Second widget inherited other providers",
    );
    await shot("13-second-widget");
  },
);
await check("Denied Confluence page reveals no report data", async () => {
  await reset("denied");
  await page
    .getByText("You do not have access to this Confluence page.", {
      exact: false,
    })
    .waitFor();
  assert(!(await body()).includes("Synthetic task"), "Denied page leaked data");
  await shot("14-page-denied");
});
await check(
  "Already old provider data is immediately marked stale",
  async () => {
    await reset();
    await page.getByLabel("Demo scenario").selectOption("stale");
    await refresh();
    assert(
      (await body()).includes("Stale data"),
      "Old report was presented as fresh",
    );
    await shot("15-clock-stale");
  },
);
let timing;
await check(
  "500-issue mock dashboard becomes usable within three seconds",
  async () => {
    const start = performance.now();
    await reset("admin", "widget-1", "scale");
    timing = performance.now() - start;
    assert(timing < 3000, `500-issue load took ${Math.round(timing)} ms`);
    await page.screenshot({
      path: `${output}/15-scale-500.png`,
      fullPage: false,
    });
  },
);
await check("Mobile layout has no horizontal overflow", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await reset();
  await refresh();
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile overflow",
  );
  await shot("16-mobile");
  await page.setViewportSize({ width: 1440, height: 1000 });
});
await check(
  "Dashboard and configuration controls work with the keyboard",
  async () => {
    await reset();
    await page.keyboard.press("Tab");
    assert(
      await page.evaluate(() => document.activeElement?.id === "demo-role"),
      "First select not keyboard reachable",
    );
    await page.keyboard.press("Tab");
    assert(
      await page.evaluate(() => document.activeElement?.id === "demo-widget"),
      "Second select not keyboard reachable",
    );
    const configure = page.getByRole("button", {
      name: "Configure dashboard",
      exact: true,
    });
    await configure.focus();
    await page.keyboard.press("Enter");
    const panel = page.locator(
      'section[aria-labelledby="configuration-title"]',
    );
    await panel.getByLabel("Jira board").waitFor();
    await panel.getByLabel("Jira board").focus();
    assert(
      await page.evaluate(() => document.activeElement?.tagName === "SELECT"),
      "Board not focusable",
    );
    const source = panel.getByLabel("openai: ready", { exact: true });
    await source.focus();
    const before = await source.isChecked();
    await page.keyboard.press("Space");
    assert(
      (await source.isChecked()) !== before,
      "Checkbox did not respond to Space",
    );
    await page.keyboard.press("Space");
    await panel.getByRole("button", { name: "Cancel", exact: true }).focus();
    await page.keyboard.press("Enter");
    assert(
      (await page
        .getByRole("heading", { name: "Dashboard configuration", exact: true })
        .count()) === 0,
      "Keyboard cancel failed",
    );
    const refreshButton = page.getByRole("button", {
      name: "Refresh dashboard",
      exact: true,
    });
    await refreshButton.focus();
    await page.keyboard.press("Enter");
    await page.waitForFunction(
      () => !document.querySelector(".refresh-button")?.disabled,
    );
  },
);
await check("Browser reports no uncaught JavaScript errors", async () =>
  assert(errors.length === 0, errors.join("\n")),
);
await writeFile(
  `${output}/results.json`,
  JSON.stringify(
    {
      date: new Date().toISOString().slice(0, 10),
      browser: "Installed Google Chrome via Playwright",
      mockOnly: true,
      scaleLoadMs: Math.round(timing ?? 0),
      results,
      errors,
    },
    null,
    2,
  ) + "\n",
);
await browser.close();
console.log(
  JSON.stringify({
    passed: results.filter((x) => x.status === "pass").length,
    failed: results.filter((x) => x.status === "fail").length,
    scaleLoadMs: Math.round(timing ?? 0),
  }),
);

if (results.some((result) => result.status === "fail")) process.exitCode = 1;
