type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>;
type Delay = (milliseconds: number) => Promise<void>;

const MAX_RETRY_AFTER_MS = 5_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;

export async function fetchWithSingleRateLimitRetry(
  fetcher: Fetcher,
  input: string | URL,
  init: RequestInit,
  isRateLimited: (response: Response) => boolean,
  delay: Delay = wait,
): Promise<Response> {
  const response = await fetcher(input, init);
  if (!isRateLimited(response)) {
    return response;
  }

  const retryDelay = getRetryDelay(response.headers.get("retry-after"));
  if (retryDelay > MAX_RETRY_AFTER_MS) {
    return response;
  }

  await delay(retryDelay);
  return fetcher(input, init);
}

function getRetryDelay(retryAfter: string | null): number {
  if (retryAfter === null || !retryAfter.trim()) {
    return DEFAULT_RETRY_DELAY_MS;
  }
  const seconds = Number(retryAfter);
  const milliseconds = Number.isFinite(seconds)
    ? seconds * 1_000
    : Date.parse(retryAfter) - Date.now();
  return Number.isFinite(milliseconds) && milliseconds >= 0
    ? Math.ceil(milliseconds)
    : DEFAULT_RETRY_DELAY_MS;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
