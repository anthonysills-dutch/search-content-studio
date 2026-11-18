CREATE TABLE `audit_issues` (
	`id` text PRIMARY KEY NOT NULL,
	`audit_id` text NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_issues_audit` ON `audit_issues` (`audit_id`);--> statement-breakpoint
CREATE TABLE `audits` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`pages_checked` integer DEFAULT 0 NOT NULL,
	`health_score` integer,
	`error` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`finished_at` text
);
--> statement-breakpoint
CREATE INDEX `audits_site` ON `audits` (`site_id`);--> statement-breakpoint
CREATE TABLE `brief_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`brief_id` text NOT NULL,
	`position` integer NOT NULL,
	`url` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`word_count` integer DEFAULT 0 NOT NULL,
	`headings` text DEFAULT '[]' NOT NULL,
	`terms` text DEFAULT '[]' NOT NULL,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `brief_sources_brief` ON `brief_sources` (`brief_id`);--> statement-breakpoint
CREATE TABLE `briefs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`site_id` text,
	`query` text NOT NULL,
	`language` text NOT NULL,
	`country` text NOT NULL,
	`source_mode` text NOT NULL,
	`questions` text DEFAULT '[]' NOT NULL,
	`outline` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `briefs_owner` ON `briefs` (`owner_id`);--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`brief_id` text,
	`voice_profile_id` text,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`seo_score` integer DEFAULT 0 NOT NULL,
	`geo_score` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documents_owner` ON `documents` (`owner_id`);--> statement-breakpoint
CREATE TABLE `sites` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`org_id` text NOT NULL,
	`name` text NOT NULL,
	`origin` text NOT NULL,
	`brand_name` text NOT NULL,
	`language` text NOT NULL,
	`country` text NOT NULL,
	`voice_profile_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sites_owner` ON `sites` (`owner_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`org_id` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visibility_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_id` text NOT NULL,
	`site_id` text NOT NULL,
	`run_id` text NOT NULL,
	`day` text NOT NULL,
	`model` text NOT NULL,
	`mentioned` integer NOT NULL,
	`cited` integer NOT NULL,
	`position` integer,
	`excerpt` text DEFAULT '' NOT NULL,
	`error` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visibility_checks_site` ON `visibility_checks` (`site_id`,`day`);--> statement-breakpoint
CREATE TABLE `visibility_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`site_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visibility_prompts_site` ON `visibility_prompts` (`site_id`);--> statement-breakpoint
CREATE TABLE `voice_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`tone` text DEFAULT '' NOT NULL,
	`formality` text DEFAULT 'neutral' NOT NULL,
	`audience` text DEFAULT '' NOT NULL,
	`context` text DEFAULT '' NOT NULL,
	`samples` text DEFAULT '' NOT NULL,
	`preferred_words` text DEFAULT '' NOT NULL,
	`banned_words` text DEFAULT '' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `voice_profiles_owner` ON `voice_profiles` (`owner_id`);--> statement-breakpoint
CREATE TABLE `workspace_settings` (
	`org_id` text PRIMARY KEY NOT NULL,
	`audit_page_cap` integer DEFAULT 50 NOT NULL,
	`visibility_models` text NOT NULL,
	`draft_model` text NOT NULL,
	`ai_state` text DEFAULT 'unknown' NOT NULL,
	`ai_message` text,
	`ai_checked_at` text
);
