CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`mime` text NOT NULL,
	`name` text NOT NULL,
	`size` integer NOT NULL,
	`text` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `attachments_chat` ON `attachments` (`chat_id`);--> statement-breakpoint
CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`subject` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `chats_owner_updated` ON `chats` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `graphs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`expressions` text NOT NULL,
	`x_min` real NOT NULL,
	`x_max` real NOT NULL,
	`y_min` real NOT NULL,
	`y_max` real NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `graphs_owner` ON `graphs` (`owner_id`,`updated_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`chat_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`attachment_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_chat` ON `messages` (`chat_id`,`id`);--> statement-breakpoint
CREATE TABLE `test_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`test_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`position` integer NOT NULL,
	`prompt` text NOT NULL,
	`options` text NOT NULL,
	`correct_index` integer NOT NULL,
	`steps` text NOT NULL,
	`chosen_index` integer,
	`answered_at` integer
);
--> statement-breakpoint
CREATE INDEX `test_questions_test` ON `test_questions` (`test_id`,`position`);--> statement-breakpoint
CREATE TABLE `tests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`topic` text NOT NULL,
	`subject` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tests_owner` ON `tests` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL
);
