import { describe, expect, it, vi } from "vitest";
import { fetchWithSingleRateLimitRetry } from "../../backend/src/httpRetry.js";

describe("bounded rate limit retry", () => {
  it("retries once after the provider retry delay", async () => {
    const fetcher = vi
      .fn(async () => Response.json({ status: "ok" }))
      .mockResolvedValueOnce(
        new Response(null, {
          status: 429,
          headers: { "retry-after": "0" },
        }),
      );
    const delay = vi.fn(async () => {});

    const response = await fetchWithSingleRateLimitRetry(
      fetcher,
      "https://provider.example/usage",
      {},
      (candidate) => candidate.status === 429,
      delay,
    );

    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledWith(0);
  });

  it("does not retry before a rate limit window longer than five seconds", async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(null, {
          status: 429,
          headers: { "retry-after": "6" },
        }),
    );
    const delay = vi.fn(async () => {});

    const response = await fetchWithSingleRateLimitRetry(
      fetcher,
      "https://provider.example/usage",
      {},
      (candidate) => candidate.status === 429,
      delay,
    );

    expect(response.status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });
});
