CREATE TABLE `app_metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `chart_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`system` text NOT NULL,
	`input_hash` text NOT NULL,
	`engine_version` text NOT NULL,
	`rule_set_id` text NOT NULL,
	`rule_set_version` text NOT NULL,
	`payload_json` text NOT NULL,
	`warnings_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `consultations` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `liuyao_cases` (
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
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`consultation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`claims_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`consultation_id`) REFERENCES `consultations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`calendar_type` text NOT NULL,
	`birth_date` text NOT NULL,
	`birth_time` text NOT NULL,
	`is_leap_month` integer DEFAULT false NOT NULL,
	`chart_sex` text NOT NULL,
	`location_name` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`time_zone` text NOT NULL,
	`uncertainty_minutes` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
