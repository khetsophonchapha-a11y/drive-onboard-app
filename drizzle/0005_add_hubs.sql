CREATE TABLE `hubs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX `hubs_name_unique` ON `hubs` (`name`);

ALTER TABLE `users` ADD `hub_id` text REFERENCES `hubs`(`id`) ON UPDATE no action ON DELETE set null;