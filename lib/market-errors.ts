export type FeedIssue = {
  code: "access_inactive" | "authentication" | "permission" | "quota" | "rate_limited" | "upstream" | "invalid_data";
  message: string;
  requiresOwnerAction: boolean;
  httpStatus?: number;
  providerCode?: number;
  source?: string;
  endpoint?: string;
};

export class MarketRefreshError extends Error {
  constructor(public readonly issue: FeedIssue, public readonly retryDelayMs = 0) {
    super(issue.message);
    this.name = "MarketRefreshError";
  }
}

export function refreshFailure(error: unknown) {
  if (error instanceof MarketRefreshError) return error;
  // Never persist or publish arbitrary upstream bodies, exception text, or credentials.
  return new MarketRefreshError({
    code: "upstream",
    message: "Live CMC data is temporarily unavailable. Automatic retries will continue.",
    requiresOwnerAction: false,
  });
}

function retryAfterMs(value: string | null, now = Date.now()) {
  if (!value) return 0;
  const delay = /^\d+$/.test(value) ? Number(value) * 1000 : Date.parse(value) - now;
  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}

export async function readCmcResponse<T = unknown>(response: Response, source: string, endpoint: string): Promise<T> {
  const body = await response.json().catch(() => null) as (T & { status?: { error_code?: unknown } }) | null;
  const rawCode = body?.status?.error_code;
  const providerCode = typeof rawCode === "number" || (typeof rawCode === "string" && /^\d+$/.test(rawCode)) ? Number(rawCode) : undefined;
  if (response.ok && body && providerCode === 0) return body;

  let code: FeedIssue["code"] = "upstream";
  let message = "Live CMC data is temporarily unavailable. Automatic retries will continue.";
  let requiresOwnerAction = false;
  let delay = retryAfterMs(response.headers.get("Retry-After"));
  if (response.status === 402 || providerCode === 1003 || providerCode === 1004) {
    code = "access_inactive";
    message = "Live CMC updates are paused because API access is inactive. The site owner must reactivate the CMC plan.";
    requiresOwnerAction = true;
  } else if (response.status === 401 || providerCode === 1001 || providerCode === 1002 || providerCode === 1005) {
    code = "authentication";
    message = "CMC authentication failed. The site owner must check the configured API key.";
    requiresOwnerAction = true;
  } else if (response.status === 403 || providerCode === 1006 || providerCode === 1007) {
    code = "permission";
    message = "CMC has denied API access. The site owner must check the plan and key permissions.";
    requiresOwnerAction = true;
  } else if (providerCode === 1009 || providerCode === 1010) {
    code = "quota";
    message = "The CMC data quota has been reached. Updates will resume when capacity is available.";
    delay = Math.max(delay, 15 * 60_000);
  } else if (response.status === 429 || providerCode === 1008 || providerCode === 1011) {
    code = "rate_limited";
    message = "CMC is limiting requests. Updates will retry after the cooldown.";
    delay = Math.max(delay, 60_000);
  } else if (response.ok) {
    code = "invalid_data";
    message = "CMC returned an invalid response. The last verified snapshot has been retained.";
  }
  if (requiresOwnerAction) delay = Math.max(delay, 15 * 60_000);
  throw new MarketRefreshError({ code, message, requiresOwnerAction, httpStatus: response.status,
    ...(Number.isSafeInteger(providerCode) ? { providerCode } : {}), source, endpoint }, delay);
}
