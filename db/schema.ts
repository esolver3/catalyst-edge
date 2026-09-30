import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const marketCache = sqliteTable("market_cache", {
  key: text("key").primaryKey(),
  payload: text("payload"),
  updatedAt: integer("updated_at").notNull().default(0),
  leaseToken: text("lease_token"),
  leaseUntil: integer("lease_until").notNull().default(0),
  retryAfter: integer("retry_after").notNull().default(0),
  failures: integer("failures").notNull().default(0),
});
