CREATE TABLE `revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`household` text NOT NULL,
	`revision` integer NOT NULL,
	`state` text NOT NULL,
	`created_at` text NOT NULL
);
