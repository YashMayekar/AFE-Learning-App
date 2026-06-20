import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Students table
export const students = sqliteTable('students', {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    avatar: text('avatar').notNull(),
    grade: integer('grade'), // Grade level (5 to 12)
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

// AFE Sessions table (for session-based offline-first tracking)
export const afeSessions = sqliteTable('afe_sessions', {
    id: text('id').primaryKey(), // session_id (CT_IN_YYYYMMDD_SchoolUDISE_Grade_INDIV_Sequence)
    studentId: text('student_id')
        .notNull()
        .references(() => students.id, { onDelete: 'cascade' }),
    sessionDate: text('session_date').notNull(), // YYYY-MM-DD
    startTime: text('start_time').notNull(),
    endTime: text('end_time'),
    durationMinutes: integer('duration_minutes').notNull().default(0),
    csatAvg: real('csat_avg'),
    itpAvg: real('itp_avg'),
    videoCompletionRate: real('video_completion_rate').notNull().default(0),
    quizAccuracyPercentage: real('quiz_accuracy_percentage').notNull().default(0),
    avgWatchTimeSeconds: integer('avg_watch_time_seconds').notNull().default(0),
    videosCompletedCount: integer('videos_completed_count').notNull().default(0),
    quizzesCompletedCount: integer('quizzes_completed_count').notNull().default(0),
    totalQuestionsAnswered: integer('total_questions_answered').notNull().default(0),
    correctAnswersCount: integer('correct_answers_count').notNull().default(0),
    sessionCompletedFlag: integer('session_completed_flag', { mode: 'boolean' }).notNull().default(false),
    completionPercentage: integer('completion_percentage').notNull().default(0),
    totalWatchTimeSeconds: integer('total_watch_time_seconds').notNull().default(0),
    avgPlaybackSpeed: real('avg_playback_speed').notNull().default(1),
    pauseCountTotal: integer('pause_count_total').notNull().default(0),
    seekCountTotal: integer('seek_count_total').notNull().default(0),
    networkType: text('network_type').notNull().default('unknown'),
    synced: integer('synced', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
});

export type AFESession = typeof afeSessions.$inferSelect;
export type NewAFESession = typeof afeSessions.$inferInsert;

