// Analytics event types

export type AnalyticsEventType =
    | 'video_watched'
    | 'pdf_read'
    | 'quiz_completed'
    | 'module_started'
    | 'module_completed'
    | 'student_login'
    | 'ai_text_chat'      // metadata: { moduleId, durationSeconds }
    | 'ai_voice_chat';    // metadata: { moduleId, durationSeconds }

export interface AnalyticsEvent {
    id: string;
    studentId: string;
    eventType: AnalyticsEventType;
    metadata: Record<string, unknown>;
    timestamp: string;
}

export interface AnalyticsSummary {
    totalWatchTime: number; // seconds
    totalReadTime: number; // seconds
    modulesStarted: number;
    modulesCompleted: number;
    quizzesTaken: number;
    averageQuizScore: number;
    lastActiveDate: string;
}

export interface ModuleAnalytics {
    moduleId: string;
    timeSpent: number; // seconds
    started: boolean;
    completed: boolean;
    progress: number; // 0-100
}
