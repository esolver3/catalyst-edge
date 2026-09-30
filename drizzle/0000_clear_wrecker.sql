CREATE TABLE `market_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`payload` text,
	`updated_at` integer DEFAULT 0 NOT NULL,
	`lease_token` text,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`retry_after` integer DEFAULT 0 NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL
);
