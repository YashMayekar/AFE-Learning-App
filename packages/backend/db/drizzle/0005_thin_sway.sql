ALTER TABLE video_progress ADD `watched_segments` text;--> statement-breakpoint
ALTER TABLE video_progress ADD `last_position` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE video_progress ADD `completed` integer DEFAULT false NOT NULL;