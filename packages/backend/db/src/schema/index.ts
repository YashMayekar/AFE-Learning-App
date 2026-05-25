import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Students table
export const students = sqliteTable('students', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    avatar: text('avatar').notNull(),
    createdAt: text('created_at').notNull(),
    lastActiveAt: text('last_active_at').notNull(),
});

// Modules table (cached from content manifest)
export const modules = sqliteTable('modules', {
    id: text('id').primaryKey(),
    contentId: text('content_id').notNull().unique(),
    version: text('version').notNull(),
    hash: text('hash').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    data: text('data', { mode: 'json' }).notNull(), // Full module JSON
});

// Lessons table (cached from content manifest)
export const lessons = sqliteTable('lessons', {
    id: text('id').primaryKey(),
    contentId: text('content_id').notNull().unique(),
    version: text('version').notNull(),
    hash: text('hash').notNull(),
    moduleId: text('module_id')
        .notNull()
        .references(() => modules.id),
    title: text('title').notNull(),
    description: text('description').notNull(),
    type: text('type', { enum: ['video', 'quiz', 'reading'] }).notNull(),
    videoUrl: text('video_url'),
    readingUrl: text('reading_url'),
    order: integer('order').notNull(),
    data: text('data', { mode: 'json' }).notNull(), // Full lesson JSON
});

// Video progress tracking
export const videoProgress = sqliteTable('video_progress', {
    id: text('id').primaryKey(),
    studentId: text('student_id')
        .notNull()
        .references(() => students.id, { onDelete: 'cascade' }),
    lessonId: text('lesson_id')
        .notNull()
        .references(() => lessons.id),
    watchedPercentage: real('watched_percentage').notNull().default(0),
    totalWatchDuration: integer('total_watch_duration').notNull().default(0), // seconds
    lastWatchedAt: text('last_watched_at').notNull(),
    watchedSegments: text('watched_segments', { mode: 'json' }).$type<[number, number][]>(),
    lastPosition: real('last_position').notNull().default(0),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
});

// Quiz attempts
export const quizAttempts = sqliteTable('quiz_attempts', {
    id: text('id').primaryKey(),
    studentId: text('student_id')
        .notNull()
        .references(() => students.id, { onDelete: 'cascade' }),
    lessonId: text('lesson_id')
        .notNull()
        .references(() => lessons.id),
    score: integer('score').notNull(),
    totalQuestions: integer('total_questions').notNull(),
    answers: text('answers', { mode: 'json' }).notNull(), // QuizAnswer[]
    attemptNumber: integer('attempt_number').notNull(),
    completedAt: text('completed_at').notNull(),
    timeTaken: integer('time_taken').notNull(), // seconds
});

// Analytics events (append-only)
export const analyticsEvents = sqliteTable('analytics_events', {
    id: text('id').primaryKey(),
    studentId: text('student_id')
        .notNull()
        .references(() => students.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    metadata: text('metadata', { mode: 'json' }).notNull(),
    timestamp: text('timestamp').notNull(),
});

// AI chat sessions
export const aiSessions = sqliteTable('ai_sessions', {
    id: text('id').primaryKey(),
    studentId: text('student_id')
        .notNull()
        .references(() => students.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    mode: text('mode', { enum: ['tutor', 'chat'] }).notNull(),
    moduleId: text('module_id').references(() => modules.id),
    createdAt: text('created_at').notNull(),
    lastMessageAt: text('last_message_at').notNull(),
});

// AI chat history
export const aiChatHistory = sqliteTable('ai_chat_history', {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
        .notNull()
        .references(() => aiSessions.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['user', 'assistant'] }).notNull(),
    content: text('content').notNull(),
    timestamp: text('timestamp').notNull(),
});

// Sync queue (for future online sync)
export const syncQueue = sqliteTable('sync_queue', {
    id: text('id').primaryKey(),
    entityType: text('entity_type', {
        enum: ['student', 'video_progress', 'quiz_attempt', 'analytics_event'],
    }).notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action', { enum: ['create', 'update', 'delete'] }).notNull(),
    data: text('data', { mode: 'json' }).notNull(),
    createdAt: text('created_at').notNull(),
    synced: integer('synced', { mode: 'boolean' }).notNull().default(false),
});

// Type exports
export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;

export type Module = typeof modules.$inferSelect;
export type NewModule = typeof modules.$inferInsert;

export type Lesson = typeof lessons.$inferSelect;
export type NewLesson = typeof lessons.$inferInsert;

export type VideoProgress = typeof videoProgress.$inferSelect;
export type NewVideoProgress = typeof videoProgress.$inferInsert;

export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type NewQuizAttempt = typeof quizAttempts.$inferInsert;

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;

export type AIChatHistory = typeof aiChatHistory.$inferSelect;
export type NewAIChatHistory = typeof aiChatHistory.$inferInsert;

export type AISession = typeof aiSessions.$inferSelect;
export type NewAISession = typeof aiSessions.$inferInsert;

export type SyncQueue = typeof syncQueue.$inferSelect;
export type NewSyncQueue = typeof syncQueue.$inferInsert;

// Started modules tracking
export const startedModules = sqliteTable(
    'started_modules',
    {
        id: text('id').primaryKey(),
        studentId: text('student_id')
            .notNull()
            .references(() => students.id, { onDelete: 'cascade' }),
        moduleId: text('module_id')
            .notNull()
            .references(() => modules.id),
        startedAt: text('started_at').notNull(),
        lastAccessedAt: text('last_accessed_at').notNull(),
    },
    (table) => ({
        uniqueUserModule: uniqueIndex('unique_user_module').on(table.studentId, table.moduleId),
    })
);

export type StartedModule = typeof startedModules.$inferSelect;
export type NewStartedModule = typeof startedModules.$inferInsert;

// Reading progress tracking (PDFs)
export const readingProgress = sqliteTable('reading_progress', {
    id: text('id').primaryKey(),
    studentId: text('student_id')
        .notNull()
        .references(() => students.id, { onDelete: 'cascade' }),
    lessonId: text('lesson_id')
        .notNull()
        .references(() => lessons.id),
    readPercentage: real('read_percentage').notNull().default(0),
    totalReadDuration: integer('total_read_duration').notNull().default(0), // seconds
    currentPage: integer('current_page').notNull().default(1),
    lastReadAt: text('last_read_at').notNull(),
});

export type ReadingProgress = typeof readingProgress.$inferSelect;
export type NewReadingProgress = typeof readingProgress.$inferInsert;

// Learning summaries
export const learningSummaries = sqliteTable('learning_summaries', {
    id: text('id').primaryKey(),
    studentId: text('student_id')
        .notNull()
        .references(() => students.id, { onDelete: 'cascade' }),
    summaryText: text('summary_text').notNull(),
    progressNote: text('progress_note'), // Diff from last summary
    lastUpdatedAt: text('last_updated_at').notNull(),
});

export type LearningSummary = typeof learningSummaries.$inferSelect;
export type NewLearningSummary = typeof learningSummaries.$inferInsert;

// Daily sync snapshots for AFE-to-RMS synchronization
export const dailySyncSnapshots = sqliteTable(
    'daily_sync_snapshots',
    {
        id: text('id').primaryKey(),
        studentId: text('student_id')
            .notNull()
            .references(() => students.id, { onDelete: 'cascade' }),
        snapshotDate: text('snapshot_date').notNull(), // YYYY-MM-DD
        modulesStarted: integer('modules_started').notNull().default(0),
        modulesCompleted: integer('modules_completed').notNull().default(0),
        timeWatched: integer('time_watched').notNull().default(0), // seconds
        timeRead: integer('time_read').notNull().default(0), // seconds
        avgQuizScore: real('avg_quiz_score').notNull().default(0),
        learningSummaryText: text('learning_summary_text'),
        learningSummaryProgressNote: text('learning_summary_progress_note'),
        learningSummaryUpdatedAt: text('learning_summary_updated_at'),
        synced: integer('synced', { mode: 'boolean' }).notNull().default(false),
        createdAt: text('created_at').notNull(),
    },
    (table) => ({
        uniqueStudentDate: uniqueIndex('unique_student_date').on(table.studentId, table.snapshotDate),
    })
);

export type DailySyncSnapshot = typeof dailySyncSnapshots.$inferSelect;
export type NewDailySyncSnapshot = typeof dailySyncSnapshots.$inferInsert;

