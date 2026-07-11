CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`external_account_id` text NOT NULL,
	`display_name` text,
	`subscription_type` text,
	`status` text DEFAULT 'unknown' NOT NULL,
	`remaining_percentage` numeric,
	`observed_at` integer NOT NULL,
	`last_synced_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_source_external_account_unique` ON `accounts` (`source`,`external_account_id`);--> statement-breakpoint
CREATE TABLE `resource_pool_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_pool_id` text NOT NULL,
	`account_id` text NOT NULL,
	`effective_from` integer NOT NULL,
	`effective_to` integer,
	`observed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`resource_pool_id`) REFERENCES `resource_pools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `resource_pool_memberships_pool_current_index` ON `resource_pool_memberships` (`resource_pool_id`,`effective_to`);--> statement-breakpoint
CREATE INDEX `resource_pool_memberships_account_current_index` ON `resource_pool_memberships` (`account_id`,`effective_to`);--> statement-breakpoint
CREATE TABLE `resource_pools` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`external_group_id` text NOT NULL,
	`name` text NOT NULL,
	`meter_type` text NOT NULL,
	`subscription_type` text,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`total_quota` numeric,
	`quota_unit` text,
	`cycle_start_at` integer,
	`cycle_end_at` integer,
	`reset_rule` text,
	`default_time_multiplier` numeric DEFAULT '1' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_synced_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_pools_source_group_unique` ON `resource_pools` (`source`,`external_group_id`);--> statement-breakpoint
CREATE TABLE `usage_records` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`external_usage_record_id` text,
	`resource_pool_id` text NOT NULL,
	`account_id` text,
	`model` text,
	`occurred_at` integer NOT NULL,
	`raw_request_count` integer DEFAULT 0 NOT NULL,
	`token_count` numeric,
	`currency_amount` numeric,
	`time_multiplier` numeric DEFAULT '1' NOT NULL,
	`model_multiplier` numeric DEFAULT '1' NOT NULL,
	`weighted_usage` numeric,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`resource_pool_id`) REFERENCES `resource_pools`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `usage_records_source_external_usage_unique` ON `usage_records` (`source`,`external_usage_record_id`);--> statement-breakpoint
CREATE INDEX `usage_records_pool_occurred_at_index` ON `usage_records` (`resource_pool_id`,`occurred_at`);