import { refreshFailure, type FeedIssue } from "./market-errors";

export const FRESH_MS = 5 * 60 * 1000;
const KEY = "cmc-market-v1";
type Snapshot = { updatedAt: string; [key: string]: unknown };
type Row = { payload: string | null; updated_at: number; failures: number; lease_until: number; retry_after: number; refresh_error: string | null };
type SavedIssue = FeedIssue & { observedAt: string };

function diagnostics(row: Row | null) {
  return {
    feedIssue: row?.refresh_error ? JSON.parse(row.refresh_error) as SavedIssue : undefined,
    nextRetryAt: row?.retry_after ? new Date(row.retry_after).toISOString() : undefined,
  };
}

// One durable snapshot and one atomic refresh lease shared by all instances.
export async function readMarket(db: D1Database, fetchMarket: () => Promise<Snapshot>, now = Date.now()) {
  await db.prepare("INSERT OR IGNORE INTO market_cache (key) VALUES (?)").bind(KEY).run();
  const read = () => db.prepare("SELECT payload, updated_at, failures, lease_until, retry_after, refresh_error FROM market_cache WHERE key = ?").bind(KEY).first<Row>();
  let row = await read();
  if (row?.payload && now - row.updated_at < FRESH_MS) {
    return { payload: JSON.parse(row.payload) as Snapshot, source: "cache", refreshing: false, ...diagnostics(row) };
  }
  const token = crypto.randomUUID();
  const lease = await db.prepare("UPDATE market_cache SET lease_token = ?, lease_until = ? WHERE key = ? AND lease_until <= ? AND retry_after <= ? AND (payload IS NULL OR updated_at <= ?)")
    .bind(token, now + 45_000, KEY, now, now, now - FRESH_MS).run();
  if (lease.meta.changes === 1) {
    try {
      const payload = await fetchMarket();
      const timestamp = Date.parse(payload.updatedAt);
      if (!Number.isFinite(timestamp) || timestamp > Date.now() + 60_000 || Date.now() - timestamp > FRESH_MS) {
        throw new Error("Upstream snapshot is stale or has an invalid timestamp");
      }
      const saved = await db.prepare("UPDATE market_cache SET payload = ?, updated_at = ?, lease_token = NULL, lease_until = 0, retry_after = 0, failures = 0, refresh_error = NULL WHERE key = ? AND lease_token = ? AND updated_at <= ?")
        .bind(JSON.stringify(payload), timestamp, KEY, token, timestamp).run();
      if (saved.meta.changes === 1) return { payload, source: "upstream", refreshing: false, feedIssue: undefined, nextRetryAt: undefined };
      // A slow response must never overwrite a newer snapshot or another lease.
      await db.prepare("UPDATE market_cache SET lease_token = NULL, lease_until = 0 WHERE key = ? AND lease_token = ?").bind(KEY, token).run();
    } catch (error) {
      const failure = refreshFailure(error);
      const issue = { ...failure.issue, observedAt: new Date().toISOString() };
      console.warn("CMC refresh failed", JSON.stringify(issue));
      const delay = Math.max(failure.retryDelayMs, Math.min(300_000, 30_000 * 2 ** Math.min(row?.failures ?? 0, 4)));
      await db.prepare("UPDATE market_cache SET lease_token = NULL, lease_until = 0, retry_after = ?, failures = failures + 1, refresh_error = ? WHERE key = ? AND lease_token = ?")
        .bind(Date.now() + delay, JSON.stringify(issue), KEY, token).run();
    }
  }
  row = await read();
  return { payload: row?.payload ? JSON.parse(row.payload) as Snapshot : null, source: "cache", refreshing: Boolean(row && row.lease_until > Date.now()), ...diagnostics(row) };
}

export function marketStatus(payload: Snapshot, source: string, now = Date.now()) {
  const ageMs = Math.max(0, now - Date.parse(payload.updatedAt));
  const sourceAgeMs = typeof payload.sourceAsOf === "string" ? Math.max(0, now - Date.parse(payload.sourceAsOf)) : ageMs;
  const stale = !Number.isFinite(ageMs) || ageMs >= FRESH_MS || !Number.isFinite(sourceAgeMs) || sourceAgeMs > 20 * 60_000;
  return { ageMs, stale, live: source === "upstream" && !stale, status: stale ? "stale" : source === "upstream" ? "live" : "cached" };
}
