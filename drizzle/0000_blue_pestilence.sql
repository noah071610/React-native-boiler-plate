CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text,
	`name` text,
	`icon` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`hidden_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_key_idx` ON `categories` (`key`);--> statement-breakpoint
CREATE INDEX `categories_sort_idx` ON `categories` (`sort_order`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`author_id` text NOT NULL,
	`category_id` text,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`base_amount` integer NOT NULL,
	`base_currency` text NOT NULL,
	`rate` real NOT NULL,
	`rate_date` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`payment_method` text,
	`is_personal` integer DEFAULT false NOT NULL,
	`memo` text,
	`place` text,
	`photo_uri` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `expenses_timeline_idx` ON `expenses` (`trip_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `expenses_category_idx` ON `expenses` (`trip_id`,`category_id`);--> statement-breakpoint
CREATE INDEX `expenses_author_idx` ON `expenses` (`trip_id`,`author_id`);--> statement-breakpoint
CREATE INDEX `expenses_deleted_idx` ON `expenses` (`trip_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `expenses_dedupe_idx` ON `expenses` (`trip_id`,`amount`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`trip_id` text NOT NULL,
	`name` text NOT NULL,
	`is_me` integer DEFAULT false NOT NULL,
	`joined_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`trip_id`) REFERENCES `trips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `participants_trip_idx` ON `participants` (`trip_id`);--> statement-breakpoint
CREATE TABLE `rate_history` (
	`base` text NOT NULL,
	`quote` text NOT NULL,
	`date` text NOT NULL,
	`rate` real NOT NULL,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`base`, `quote`, `date`)
);
--> statement-breakpoint
CREATE INDEX `rate_history_lookup_idx` ON `rate_history` (`base`,`quote`,`date`);--> statement-breakpoint
CREATE TABLE `trips` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`destination_currency` text NOT NULL,
	`base_currency` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`budget_amount` integer,
	`budget_currency` text,
	`share_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trips_share_code_idx` ON `trips` (`share_code`);--> statement-breakpoint
CREATE INDEX `trips_deleted_idx` ON `trips` (`deleted_at`);