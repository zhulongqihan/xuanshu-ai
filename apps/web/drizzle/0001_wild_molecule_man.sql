CREATE TABLE `profile_birth_records` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`revision` integer NOT NULL,
	`is_current` integer NOT NULL,
	`raw_input_json` text NOT NULL,
	`canonical_input_json` text NOT NULL,
	`input_hash` text NOT NULL,
	`input_schema_version` integer NOT NULL,
	`normalized_json` text NOT NULL,
	`normalized_schema_version` integer NOT NULL,
	`normalizer_version` text NOT NULL,
	`dependencies_json` text NOT NULL,
	`source_refs_json` text NOT NULL,
	`warnings_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "profile_birth_records_revision_check" CHECK("profile_birth_records"."revision" >= 1),
	CONSTRAINT "profile_birth_records_hash_check" CHECK(length("profile_birth_records"."input_hash") = 64 AND "profile_birth_records"."input_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "profile_birth_records_raw_json_check" CHECK(json_valid("profile_birth_records"."raw_input_json")),
	CONSTRAINT "profile_birth_records_canonical_json_check" CHECK(json_valid("profile_birth_records"."canonical_input_json")),
	CONSTRAINT "profile_birth_records_normalized_json_check" CHECK(json_valid("profile_birth_records"."normalized_json")),
	CONSTRAINT "profile_birth_records_dependencies_json_check" CHECK(json_valid("profile_birth_records"."dependencies_json")),
	CONSTRAINT "profile_birth_records_sources_json_check" CHECK(json_valid("profile_birth_records"."source_refs_json")),
	CONSTRAINT "profile_birth_records_warnings_json_check" CHECK(json_valid("profile_birth_records"."warnings_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_birth_records_profile_revision_unique` ON `profile_birth_records` (`profile_id`,`revision`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_birth_records_profile_hash_unique` ON `profile_birth_records` (`profile_id`,`input_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `profile_birth_records_one_current_unique` ON `profile_birth_records` (`profile_id`) WHERE "profile_birth_records"."is_current" = 1;--> statement-breakpoint
CREATE INDEX `profile_birth_records_profile_idx` ON `profile_birth_records` (`profile_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_liuyao_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text,
	`question` text NOT NULL,
	`method` text NOT NULL,
	`lines_json` text NOT NULL,
	`audit_json` text,
	`cast_at` text NOT NULL,
	`time_zone` text NOT NULL,
	`location_name` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_liuyao_cases`("id", "profile_id", "question", "method", "lines_json", "audit_json", "cast_at", "time_zone", "location_name", "created_at") SELECT "id", "profile_id", "question", "method", "lines_json", "audit_json", "cast_at", "time_zone", "location_name", "created_at" FROM `liuyao_cases`;--> statement-breakpoint
DROP TABLE `liuyao_cases`;--> statement-breakpoint
ALTER TABLE `__new_liuyao_cases` RENAME TO `liuyao_cases`;--> statement-breakpoint
CREATE TABLE `__new_chart_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`birth_record_id` text,
	`system` text NOT NULL,
	`input_hash` text NOT NULL,
	`engine_version` text NOT NULL,
	`rule_set_id` text NOT NULL,
	`rule_set_version` text NOT NULL,
	`payload_json` text NOT NULL,
	`warnings_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`birth_record_id`) REFERENCES `profile_birth_records`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_chart_snapshots`(
	`id`, `profile_id`, `birth_record_id`, `system`, `input_hash`, `engine_version`,
	`rule_set_id`, `rule_set_version`, `payload_json`, `warnings_json`, `created_at`
) SELECT
	`id`, `profile_id`, NULL, `system`, `input_hash`, `engine_version`,
	`rule_set_id`, `rule_set_version`, `payload_json`, `warnings_json`, `created_at`
FROM `chart_snapshots`;--> statement-breakpoint
DROP TABLE `chart_snapshots`;--> statement-breakpoint
ALTER TABLE `__new_chart_snapshots` RENAME TO `chart_snapshots`;--> statement-breakpoint
CREATE INDEX `chart_snapshots_profile_idx` ON `chart_snapshots` (`profile_id`);--> statement-breakpoint
CREATE INDEX `chart_snapshots_birth_record_idx` ON `chart_snapshots` (`birth_record_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;
