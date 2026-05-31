// Shared TypeScript types used across frontend and backend

export interface Student {
    id: string;
    name: string;
    avatar: string;
    createdAt: string;
    lastActiveAt: string;
}

export interface Module {
    id: string;
    contentId: string;
    version: string;
    hash: string;
    title: string;
    description: string;
    language?: string;
    thumbnailUrl?: string;
    lessons: Lesson[];
}

export interface Lesson {
    id: string;
    contentId: string;
    version: string;
    hash: string;
    moduleId: string;
    title: string;
    description: string;
    type: 'video' | 'quiz' | 'reading';
    videoUrl?: string;
    readingUrl?: string;
    quizData?: QuizData;
    order: number;
    minVideoLength?: number;   // seconds – minimum watch time for completion
    minReadingTime?: number;   // seconds – minimum read time for completion
}

export interface QuizData {
    questions: QuizQuestion[];
    passingScore: number;
}

export interface QuizQuestion {
    id: string;
    question: string;
    options: string[];
    correctAnswerIndex: number;
    explanation?: string;
}

export interface VideoProgress {
    id: string;
    studentId: string;
    lessonId: string;
    watchedPercentage: number;
    totalWatchDuration: number; // in seconds
    lastWatchedAt: string;
    watchedSegments?: [number, number][];
    lastPosition?: number;
    completed?: boolean;
}

export interface QuizAttempt {
    id: string;
    studentId: string;
    lessonId: string;
    score: number;
    totalQuestions: number;
    answers: QuizAnswer[];
    attemptNumber: number;
    completedAt: string;
    timeTaken: number; // in seconds
}

export interface QuizAnswer {
    questionId: string;
    selectedAnswerIndex: number;
    isCorrect: boolean;
}

export interface AnalyticsEvent {
    id: string;
    studentId: string;
    eventType: 'video_watched' | 'quiz_completed' | 'module_started' | 'module_completed';
    metadata: Record<string, unknown>;
    timestamp: string;
}

export interface AISession {
    id: string;
    studentId: string;
    title: string;
    mode: 'tutor' | 'chat';
    moduleId?: string;
    createdAt: string;
    lastMessageAt: string;
}

export interface AIChatMessage {
    id: string;
    sessionId: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface SyncQueueItem {
    id: string;
    entityType: 'student' | 'video_progress' | 'quiz_attempt' | 'analytics_event';
    entityId: string;
    action: 'create' | 'update' | 'delete';
    data: Record<string, unknown>;
    createdAt: string;
    synced: boolean;
}

export interface StartedModule {
    id: string;
    studentId: string;
    moduleId: string;
    startedAt: string;
    lastAccessedAt: string;
}

export interface ReadingProgress {
    id: string;
    studentId: string;
    lessonId: string;
    readPercentage: number;
    totalReadDuration: number; // in seconds
    currentPage: number;
    lastReadAt: string;
}
