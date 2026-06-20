CREATE TABLE `afe_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`student_id` text NOT NULL,
	`session_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text,
	`duration_minutes` integer DEFAULT 0 NOT NULL,
	`csat_avg` real,
	`itp_avg` real,
	`video_completion_rate` real DEFAULT 0 NOT NULL,
	`quiz_accuracy_percentage` real DEFAULT 0 NOT NULL,
	`avg_watch_time_seconds` integer DEFAULT 0 NOT NULL,
	`videos_completed_count` integer DEFAULT 0 NOT NULL,
	`quizzes_completed_count` integer DEFAULT 0 NOT NULL,
	`total_questions_answered` integer DEFAULT 0 NOT NULL,
	`correct_answers_count` integer DEFAULT 0 NOT NULL,
	`session_completed_flag` integer DEFAULT false NOT NULL,
	`completion_percentage` integer DEFAULT 0 NOT NULL,
	`total_watch_time_seconds` integer DEFAULT 0 NOT NULL,
	`avg_playback_speed` real DEFAULT 1 NOT NULL,
	`pause_count_total` integer DEFAULT 0 NOT NULL,
	`seek_count_total` integer DEFAULT 0 NOT NULL,
	`network_type` text DEFAULT 'unknown' NOT NULL,
	`synced` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`student_id`) REFERENCES `students`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
DROP TABLE `daily_sync_snapshots`;--> statement-breakpoint
DROP TABLE `sync_queue`;--> statement-breakpoint
ALTER TABLE students ADD `grade` integer;