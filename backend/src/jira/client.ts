import { fetchWithSingleRateLimitRetry } from "../httpRetry.js";

export interface JiraBoard {
  id: string;
  name: string;
  type: string;
  location?: {
    projectName?: string;
    projectKey?: string;
  };
}

export interface JiraSprint {
  id: string;
  name: string;
  state: "active" | "closed" | "future";
  startDate?: string;
  endDate?: string;
  active: boolean;
}

export interface JiraSprintDetails extends JiraSprint {
  originBoardId: string;
}

export type JiraStatusCategory = "done" | "new" | "indeterminate";

export interface JiraSprintIssue {
  id: string;
  key: string;
  summary: string;
  issueType: string;
  isSubtask: boolean;
  status: string;
  statusCategory?: JiraStatusCategory;
  assignee?: string;
  browseUrl: string;
  estimate?: number;
}

export interface JiraIssuePage {
  issues: JiraSprintIssue[];
  startAt: number;
  maxResults: number;
  total: number;
  isLast: boolean;
}

export interface JiraPage<T> {
  values: T[];
  startAt: number;
  maxResults: number;
  total: number;
  isLast: boolean;
}

export class JiraApiError extends Error {
  constructor(
    readonly code: "permission_denied" | "rate_limited" | "failed",
    readonly httpStatus: number,
    readonly retryAfterSeconds?: number,
  ) {
    super(`Jira request failed with status ${httpStatus}`);
    this.name = "JiraApiError";
  }
}

type Fetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

const MAX_PAGE_SIZE = 100;
const MAX_START_AT = 100_000;
const boardIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const sprintStates = new Set(["active", "closed", "future"]);

function validateBaseUrl(baseUrl: string): URL {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error("Jira base URL must be a valid HTTPS URL");
  }
  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.search !== "" ||
    url.hash !== "" ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "Jira base URL must be an HTTPS origin without credentials or a path",
    );
  }
  return url;
}

function validatePage(startAt: number, limit: number): void {
  if (!Number.isSafeInteger(startAt) || startAt < 0 || startAt > MAX_START_AT) {
    throw new Error("startAt is outside the supported range");
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error(`limit must be between 1 and ${MAX_PAGE_SIZE}`);
  }
}

export function validateJiraPage(startAt: number, limit: number): void {
  validatePage(startAt, limit);
}

export function isValidJiraBoardId(boardId: string): boolean {
  return boardIdPattern.test(boardId);
}

export function isValidJiraSprintState(
  state: string,
): state is JiraSprint["state"] {
  return sprintStates.has(state);
}

function parsePage<T>(
  body: unknown,
  parseValue: (value: unknown) => T,
): JiraPage<T> {
  if (typeof body !== "object" || body === null || !("values" in body)) {
    throw new Error("Jira returned an invalid paginated response");
  }
  const page = body as Record<string, unknown>;
  if (
    !Array.isArray(page.values) ||
    !Number.isSafeInteger(page.startAt) ||
    !Number.isSafeInteger(page.maxResults) ||
    !Number.isSafeInteger(page.total) ||
    typeof page.isLast !== "boolean"
  ) {
    throw new Error("Jira returned invalid pagination metadata");
  }
  return {
    values: page.values.map(parseValue),
    startAt: page.startAt as number,
    maxResults: page.maxResults as number,
    total: page.total as number,
    isLast: page.isLast,
  };
}

function parseBoard(value: unknown): JiraBoard {
  if (typeof value !== "object" || value === null) {
    throw new Error("Jira returned an invalid board");
  }
  const board = value as Record<string, unknown>;
  if (
    (typeof board.id !== "number" && typeof board.id !== "string") ||
    typeof board.name !== "string" ||
    typeof board.type !== "string"
  ) {
    throw new Error("Jira returned an invalid board");
  }

  const location =
    typeof board.location === "object" && board.location !== null
      ? (board.location as Record<string, unknown>)
      : undefined;

  return {
    id: String(board.id),
    name: board.name,
    type: board.type,
    ...(location && {
      location: {
        ...(typeof location.projectName === "string" && {
          projectName: location.projectName,
        }),
        ...(typeof location.projectKey === "string" && {
          projectKey: location.projectKey,
        }),
      },
    }),
  };
}

function parseSprint(value: unknown): JiraSprint {
  if (typeof value !== "object" || value === null) {
    throw new Error("Jira returned an invalid sprint");
  }
  const sprint = value as Record<string, unknown>;
  if (
    (typeof sprint.id !== "number" && typeof sprint.id !== "string") ||
    typeof sprint.name !== "string" ||
    typeof sprint.state !== "string" ||
    !sprintStates.has(sprint.state)
  ) {
    throw new Error("Jira returned an invalid sprint");
  }

  return {
    id: String(sprint.id),
    name: sprint.name,
    state: sprint.state as JiraSprint["state"],
    ...(typeof sprint.startDate === "string" && {
      startDate: sprint.startDate,
    }),
    ...(typeof sprint.endDate === "string" && { endDate: sprint.endDate }),
    active: sprint.state === "active",
  };
}

function parseSprintDetails(value: unknown): JiraSprintDetails {
  const sprint = parseSprint(value);
  if (typeof value !== "object" || value === null) {
    throw new Error("Jira returned an invalid sprint");
  }
  const originBoardId = (value as Record<string, unknown>).originBoardId;
  if (typeof originBoardId !== "number" && typeof originBoardId !== "string") {
    throw new Error("Jira returned a sprint without its origin board");
  }
  return { ...sprint, originBoardId: String(originBoardId) };
}

function parseSprintIssue(
  value: unknown,
  baseUrl: URL,
  estimateFieldId?: string,
): JiraSprintIssue {
  if (typeof value !== "object" || value === null) {
    throw new Error("Jira returned an invalid issue");
  }
  const issue = value as Record<string, unknown>;
  if (
    (typeof issue.id !== "number" && typeof issue.id !== "string") ||
    typeof issue.key !== "string" ||
    typeof issue.fields !== "object" ||
    issue.fields === null
  ) {
    throw new Error("Jira returned an invalid issue");
  }
  const fields = issue.fields as Record<string, unknown>;
  const issueType = fields.issuetype;
  const status = fields.status;
  if (
    typeof fields.summary !== "string" ||
    typeof issueType !== "object" ||
    issueType === null ||
    typeof (issueType as Record<string, unknown>).name !== "string" ||
    typeof status !== "object" ||
    status === null ||
    typeof (status as Record<string, unknown>).name !== "string"
  ) {
    throw new Error("Jira returned an issue with invalid fields");
  }

  const typeFields = issueType as Record<string, unknown>;
  const statusFields = status as Record<string, unknown>;
  const category = statusFields.statusCategory;
  const categoryKey =
    typeof category === "object" && category !== null
      ? (category as Record<string, unknown>).key
      : undefined;
  const statusCategory =
    categoryKey === "done" ||
    categoryKey === "new" ||
    categoryKey === "indeterminate"
      ? categoryKey
      : undefined;
  const assignee = fields.assignee;
  const assigneeName =
    typeof assignee === "object" && assignee !== null
      ? (assignee as Record<string, unknown>).displayName
      : undefined;
  const rawEstimate = estimateFieldId ? fields[estimateFieldId] : undefined;
  const estimate =
    typeof rawEstimate === "number" &&
    Number.isFinite(rawEstimate) &&
    rawEstimate >= 0
      ? rawEstimate
      : undefined;

  return {
    id: String(issue.id),
    key: issue.key,
    summary: fields.summary,
    issueType: typeFields.name as string,
    isSubtask: typeFields.subtask === true,
    status: statusFields.name as string,
    ...(statusCategory && { statusCategory }),
    ...(typeof assigneeName === "string" && { assignee: assigneeName }),
    browseUrl: new URL(
      `/browse/${encodeURIComponent(issue.key)}`,
      baseUrl,
    ).toString(),
    ...(estimate !== undefined && { estimate }),
  };
}

export class JiraClient {
  private readonly baseUrl: URL;

  constructor(
    baseUrl: string,
    private readonly fetcher: Fetch = fetch,
    private readonly delay?: (milliseconds: number) => Promise<void>,
  ) {
    this.baseUrl = validateBaseUrl(baseUrl);
  }

  async getBoard(accessToken: string, boardId: string): Promise<JiraBoard> {
    if (!boardIdPattern.test(boardId)) throw new Error("boardId is invalid");
    return parseBoard(
      await this.get(
        `/rest/agile/1.0/board/${encodeURIComponent(boardId)}`,
        accessToken,
      ),
    );
  }

  async listBoards(
    accessToken: string,
    startAt = 0,
    limit = 50,
  ): Promise<JiraPage<JiraBoard>> {
    validatePage(startAt, limit);
    const query = new URLSearchParams({
      startAt: String(startAt),
      maxResults: String(limit),
    });
    const body = await this.get(`/rest/agile/1.0/board?${query}`, accessToken);
    return parsePage(body, parseBoard);
  }

  async listSprints(
    accessToken: string,
    boardId: string,
    startAt = 0,
    limit = 50,
    state?: JiraSprint["state"],
  ): Promise<JiraPage<JiraSprint>> {
    validatePage(startAt, limit);
    if (!boardIdPattern.test(boardId)) {
      throw new Error("boardId is invalid");
    }
    if (state !== undefined && !sprintStates.has(state)) {
      throw new Error("state is invalid");
    }

    const query = new URLSearchParams({
      startAt: String(startAt),
      maxResults: String(limit),
    });
    if (state) {
      query.set("state", state);
    }
    const body = await this.get(
      `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/sprint?${query}`,
      accessToken,
    );
    return parsePage(body, parseSprint);
  }

  async getSprint(
    accessToken: string,
    sprintId: string,
  ): Promise<JiraSprintDetails> {
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(sprintId)) {
      throw new Error("sprintId is invalid");
    }
    const body = await this.get(
      `/rest/agile/1.0/sprint/${encodeURIComponent(sprintId)}`,
      accessToken,
    );
    return parseSprintDetails(body);
  }

  async getBoardEstimationField(
    accessToken: string,
    boardId: string,
  ): Promise<string | undefined> {
    if (!boardIdPattern.test(boardId)) {
      throw new Error("boardId is invalid");
    }
    const body = await this.get(
      `/rest/agile/1.0/board/${encodeURIComponent(boardId)}/configuration`,
      accessToken,
    );
    if (typeof body !== "object" || body === null) {
      throw new Error("Jira returned invalid board configuration");
    }
    const estimation = (body as Record<string, unknown>).estimation;
    if (typeof estimation !== "object" || estimation === null) {
      return undefined;
    }
    const field = (estimation as Record<string, unknown>).field;
    if (typeof field !== "object" || field === null) {
      return undefined;
    }
    const fieldId = (field as Record<string, unknown>).fieldId;
    return typeof fieldId === "string" && /^customfield_[0-9]+$/.test(fieldId)
      ? fieldId
      : undefined;
  }

  async listSprintIssues(
    accessToken: string,
    sprintId: string,
    startAt = 0,
    limit = 50,
    estimateFieldId?: string,
  ): Promise<JiraIssuePage> {
    validatePage(startAt, limit);
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(sprintId)) {
      throw new Error("sprintId is invalid");
    }
    if (
      estimateFieldId !== undefined &&
      !/^customfield_[0-9]+$/.test(estimateFieldId)
    ) {
      throw new Error("estimateFieldId is invalid");
    }

    const fields = ["summary", "issuetype", "status", "assignee", "parent"];
    if (estimateFieldId) {
      fields.push(estimateFieldId);
    }
    const query = new URLSearchParams({
      startAt: String(startAt),
      maxResults: String(limit),
      fields: fields.join(","),
    });
    const body = await this.get(
      `/rest/agile/1.0/sprint/${encodeURIComponent(sprintId)}/issue?${query}`,
      accessToken,
    );
    if (typeof body !== "object" || body === null) {
      throw new Error("Jira returned an invalid issue page");
    }
    const page = body as Record<string, unknown>;
    if (
      !Array.isArray(page.issues) ||
      !Number.isSafeInteger(page.startAt) ||
      !Number.isSafeInteger(page.maxResults) ||
      !Number.isSafeInteger(page.total)
    ) {
      throw new Error("Jira returned invalid issue pagination metadata");
    }
    const parsedIssues = page.issues.map((issue) =>
      parseSprintIssue(issue, this.baseUrl, estimateFieldId),
    );
    return {
      issues: parsedIssues,
      startAt: page.startAt as number,
      maxResults: page.maxResults as number,
      total: page.total as number,
      isLast:
        (page.startAt as number) + parsedIssues.length >=
        (page.total as number),
    };
  }

  private async get(path: string, accessToken: string): Promise<unknown> {
    if (!accessToken.trim()) {
      throw new Error("A viewer-scoped Jira access token is required");
    }
    const response = await fetchWithSingleRateLimitRetry(
      this.fetcher,
      new URL(path, this.baseUrl),
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(15_000),
      },
      (candidate) => candidate.status === 429,
      this.delay,
    );
    if (!response.ok) {
      const status = response.status;
      const code =
        status === 401 || status === 403
          ? "permission_denied"
          : status === 429
            ? "rate_limited"
            : "failed";
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfter =
        retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
      throw new JiraApiError(
        code,
        status,
        Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter : undefined,
      );
    }
    return response.json();
  }
}
