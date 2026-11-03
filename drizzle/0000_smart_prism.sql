CREATE TABLE `audit` (
	`id` text PRIMARY KEY NOT NULL,
	`household` text NOT NULL,
	`event` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `credentials` (
	`owner` text PRIMARY KEY NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `files` (
	`id` text PRIMARY KEY NOT NULL,
	`household` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`iv` text NOT NULL,
	`sha256` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `households_owner_unique` ON `households` (`owner`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`household` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`access` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_by` text
);
--> statement-breakpoint
CREATE TABLE `members` (
	`household` text NOT NULL,
	`user` text NOT NULL,
	`role` text NOT NULL,
	`access` text NOT NULL,
	`email` text NOT NULL,
	PRIMARY KEY(`household`, `user`)
);
--> statement-breakpoint
CREATE TABLE `model_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`household` text NOT NULL,
	`started_at` text NOT NULL
);
