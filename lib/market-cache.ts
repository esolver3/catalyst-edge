export const FRESH_MS = 5 * 60 * 1000;
const KEY = "cmc-market-v1";
type Snapshot = { updatedAt: string; [key: string]: unknown };
type Row = { payload: string | null; updated_at: number; failures: number; lease_until: number; retry_after: number };

// One durable snapshot and one atomic refresh lease shared by all instances.
export async function readMarket(db: D1Database, fetchMarket: () => Promise<Snapshot>, now = Date.now()) {
  await db.prepare("INSERT OR IGNORE INTO market_cache (key) VALUES (?)").bind(KEY).run();
  const read = () => db.prepare("SELECT payload, updated_at, failures, lease_until, retry_after FROM market_cache WHERE key = ?").bind(KEY).first<Row>();
  let row = await read();
  if (row?.payload && now - row.updated_at < FRESH_MS) {
    return { payload: JSON.parse(row.payload) as Snapshot, source: "cache", refreshing: false };
  }
  const token = crypto.randomUUID();
  const lease = await db.prepare("UPDATE market_cache SET lease_token = ?, lease_until = ? WHERE key = ? AND lease_until <= ? AND retry_after <= ?")
    .bind(token, now + 45_000, KEY, now, now).run();
  if (lease.meta.changes === 1) {
    try {
      const payload = await fetchMarket();
      const timestamp = Date.parse(payload.updatedAt);
      if (!Number.isFinite(timestamp) || timestamp > Date.now() + 60_000 || Date.now() - timestamp > FRESH_MS) {
        throw new Error("Upstream snapshot is stale or has an invalid timestamp");
      }
      const saved = await db.prepare("UPDATE market_cache SET payload = ?, updated_at = ?, lease_token = NULL, lease_until = 0, retry_after = 0, failures = 0 WHERE key = ? AND lease_token = ? AND updated_at <= ?")
        .bind(JSON.stringify(payload), timestamp, KEY, token, timestamp).run();
      if (saved.meta.changes === 1) return { payload, source: "upstream", refreshing: false };
      // A slow response must never overwrite a newer snapshot or another lease.
      await db.prepare("UPDATE market_cache SET lease_token = NULL, lease_until = 0 WHERE key = ? AND lease_token = ?").bind(KEY, token).run();
    } catch (error) {
      console.warn("CMC refresh failed", error instanceof Error ? error.message : "Unknown failure");
      const delay = Math.min(300_000, 30_000 * 2 ** Math.min(row?.failures ?? 0, 4));
      await db.prepare("UPDATE market_cache SET lease_token = NULL, lease_until = 0, retry_after = ?, failures = failures + 1 WHERE key = ? AND lease_token = ?")
        .bind(Date.now() + delay, KEY, token).run();
    }
  }
  row = await read();
  return { payload: row?.payload ? JSON.parse(row.payload) as Snapshot : null, source: "cache", refreshing: Boolean(row && row.lease_until > Date.now()) };
}

export function marketStatus(payload: Snapshot, source: string, now = Date.now()) {
  const ageMs = Math.max(0, now - Date.parse(payload.updatedAt));
  const sourceAgeMs = typeof payload.sourceAsOf === "string" ? Math.max(0, now - Date.parse(payload.sourceAsOf)) : ageMs;
  const stale = ageMs >= FRESH_MS || !Number.isFinite(sourceAgeMs) || sourceAgeMs > 20 * 60_000;
  return { ageMs, stale, live: source === "upstream" && !stale, status: stale ? "stale" : source === "upstream" ? "live" : "cached" };
}
