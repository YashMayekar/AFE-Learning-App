// Type-safe IPC contracts for communication between renderer and main process
import type {
    Student,
    Module,
    Lesson,
    VideoProgress,
    QuizAttempt,
    AnalyticsEvent,
    AIChatMessage,
    AISession,
    StartedModule,
    ReadingProgress,
} from '../types/index.js';

// IPC Channel names
export const IPC_CHANNELS = {
    // Student operations
    STUDENT_CREATE: 'student:create',
    STUDENT_GET_ALL: 'student:getAll',
    STUDENT_GET_BY_ID: 'student:getById',
    STUDENT_UPDATE_LAST_ACTIVE: 'student:updateLastActive',
    STUDENT_GENERATE_USERNAME: 'student:generateUsername',

    // Content operations
    CONTENT_GET_MODULES: 'content:getModules',
    CONTENT_GET_MODULE_BY_ID: 'content:getModuleById',
    CONTENT_GET_LESSON_BY_ID: 'content:getLessonById',
    CONTENT_GET_VIDEO_METADATA: 'content:getVideoMetadata',

    // Progress tracking
    PROGRESS_UPDATE_VIDEO: 'progress:updateVideo',
    PROGRESS_GET_VIDEO: 'progress:getVideo',
    PROGRESS_GET_ALL_FOR_STUDENT: 'progress:getAllForStudent',
    PROGRESS_MARK_MODULE_STARTED: 'progress:markModuleStarted',
    PROGRESS_GET_STARTED_MODULES: 'progress:getStartedModules',
    PROGRESS_UPDATE_READING: 'progress:updateReading',
    PROGRESS_GET_READING: 'progress:getReading',
    PROGRESS_GET_ALL_READING: 'progress:getAllReadingForStudent',

    // Quiz operations
    QUIZ_SUBMIT_ATTEMPT: 'quiz:submitAttempt',
    QUIZ_GET_ATTEMPTS: 'quiz:getAttempts',
    QUIZ_GET_BEST_SCORE: 'quiz:getBestScore',

    // Analytics
    ANALYTICS_TRACK_EVENT: 'analytics:trackEvent',
    ANALYTICS_GET_SUMMARY: 'analytics:getSummary',

    // AI Tutor
    AI_SEND_MESSAGE: 'ai:sendMessage',
    AI_CANCEL_MESSAGE: 'ai:cancelMessage',
    AI_GET_SESSION_HISTORY: 'ai:getSessionHistory',
    AI_SESSION_GET_ALL: 'ai:session:getAll',
    AI_SESSION_CREATE: 'ai:session:create',
    AI_SESSION_DELETE: 'ai:session:delete',
    AI_CLEAR_HISTORY: 'ai:clearHistory',
    AI_STREAM_CHUNK: 'ai:streamChunk',
    AI_SESSION_UPDATED: 'ai:session:updated',

    // Voice pipeline (near real-time STS)
    AI_VOICE_MESSAGE: 'ai:voice-message',
    TTS_SENTENCE_READY: 'tts:sentence-ready',
    AI_VOICE_DONE: 'ai:voice-done',


    // STT
    STT_START: 'stt:start',
    STT_CHUNK: 'stt:chunk',
    STT_STOP: 'stt:stop',
    STT_FINAL: 'stt:final',

    // TTS
    TTS_SPEAK: 'tts:speak',
    TTS_STOP: 'tts:stop',
    TTS_STATUS: 'tts:status',

    // Session tracking
    SESSION_START: 'session:start',
    SESSION_END: 'session:end',
    SESSION_PAUSE: 'session:pause',
    SESSION_SEEK: 'session:seek',
    SESSION_SPEED: 'session:speed',
    SESSION_UPDATE_LANGUAGE: 'session:updateLanguage'
} as const;

// Request/Response type definitions

// Students
export type StudentCreateRequest = { name: string; avatar: string; grade?: number };
export type StudentCreateResponse = Student;

export type StudentGetAllRequest = void;
export type StudentGetAllResponse = Student[];

export type StudentGetByIdRequest = { studentId: string };
export type StudentGetByIdResponse = Student | null;

export type StudentUpdateLastActiveRequest = { studentId: string };
export type StudentUpdateLastActiveResponse = void;

export type StudentGenerateUsernameRequest = { avatarName: string };
export type StudentGenerateUsernameResponse = string;

// Content
export type ContentGetModulesRequest = void;
export type ContentGetModulesResponse = Module[];

export type ContentGetModuleByIdRequest = { moduleId: string };
export type ContentGetModuleByIdResponse = Module | null;

export type ContentGetLessonByIdRequest = { lessonId: string };
export type ContentGetLessonByIdResponse = Lesson | null;

export type ContentGetVideoMetadataRequest = { videoUrl: string };
export type ContentGetVideoMetadataResponse = { duration: number; size: number } | null;

// Progress
export type ProgressUpdateVideoRequest = {
    studentId: string;
    lessonId: string;
    watchedPercentage: number;
    watchDuration: number;
    watchedSegments?: [number, number][];
    lastPosition?: number;
    completed?: boolean;
};
export type ProgressUpdateVideoResponse = void;

export type ProgressGetVideoRequest = { studentId: string; lessonId: string };
export type ProgressGetVideoResponse = VideoProgress | null;

export type ProgressGetAllForStudentRequest = { studentId: string };
export type ProgressGetAllForStudentResponse = VideoProgress[];

export type ProgressMarkModuleStartedRequest = { studentId: string; moduleId: string };
export type ProgressMarkModuleStartedResponse = void;

export type ProgressGetStartedModulesRequest = { studentId: string };
export type ProgressGetStartedModulesResponse = StartedModule[];

export type ProgressUpdateReadingRequest = {
    studentId: string;
    lessonId: string;
    readPercentage: number;
    readDuration: number;
    currentPage: number;
};
export type ProgressUpdateReadingResponse = void;

export type ProgressGetReadingRequest = { studentId: string; lessonId: string };
export type ProgressGetReadingResponse = ReadingProgress | null;

export type ProgressGetAllReadingRequest = { studentId: string };
export type ProgressGetAllReadingResponse = ReadingProgress[];

// Quiz
export type QuizSubmitAttemptRequest = {
    studentId: string;
    lessonId: string;
    answers: Array<{ questionId: string; selectedAnswerIndex: number }>;
    timeTaken: number;
};
export type QuizSubmitAttemptResponse = QuizAttempt;

export type QuizGetAttemptsRequest = { studentId: string; lessonId: string };
export type QuizGetAttemptsResponse = QuizAttempt[];

export type QuizGetBestScoreRequest = { studentId: string; lessonId: string };
export type QuizGetBestScoreResponse = number | null;

// Analytics
export type AnalyticsTrackEventRequest = {
    studentId: string;
    eventType: string;
    metadata: Record<string, unknown>;
};
export type AnalyticsTrackEventResponse = void;

export type AnalyticsGetSummaryRequest = { studentId: string };
export type AnalyticsGetSummaryResponse = {
    totalWatchTime: number;
    totalReadTime: number;
    modulesStarted: number;
    modulesCompleted: number;
    quizzesTaken: number;
    averageQuizScore: number;
};

// AI Tutor sessions
export type AISessionGetAllRequest = { studentId: string };
export type AISessionGetAllResponse = AISession[];

export type AISessionCreateRequest = {
    studentId: string;
    title: string;
    mode: 'tutor' | 'chat';
    moduleId?: string;
};
export type AISessionCreateResponse = AISession;

export type AISessionDeleteRequest = { sessionId: string };
export type AISessionDeleteResponse = void;

export type AIGetSessionHistoryRequest = { sessionId: string };
export type AIGetSessionHistoryResponse = AIChatMessage[];

// AI Tutor message
export type AISendMessageRequest = {
    studentId: string;
    message: string;
    sessionId: string;
    requestId: string;
};
export type AISendMessageResponse = { response: string; cancelled: boolean };

export type AICancelMessageRequest = { requestId: string };
export type AICancelMessageResponse = { cancelled: boolean };

export type AIGetHistoryRequest = { studentId: string };
export type AIGetHistoryResponse = AIChatMessage[];

export type AIClearHistoryRequest = { studentId: string };
export type AIClearHistoryResponse = void;

// Voice pipeline
export type AIVoiceMessageRequest = {
    studentId: string;
    message: string;
    sessionId: string;
};
export type AIVoiceMessageResponse = { response: string };

// TTS
export type TTSSpeakRequest = { text: string };
export type TTSSpeakResponse = { audio: ArrayBuffer | null; fallback: boolean };

export type TTSStopRequest = void;
export type TTSStopResponse = void;

export type TTSStatusRequest = void;
export type TTSStatusResponse = { available: boolean };

// Type helper for IPC invocation
export interface IPCContract {
    [IPC_CHANNELS.STUDENT_CREATE]: {
        request: StudentCreateRequest;
        response: StudentCreateResponse;
    };
    [IPC_CHANNELS.STUDENT_GET_ALL]: {
        request: StudentGetAllRequest;
        response: StudentGetAllResponse;
    };
    [IPC_CHANNELS.STUDENT_GET_BY_ID]: {
        request: StudentGetByIdRequest;
        response: StudentGetByIdResponse;
    };
    [IPC_CHANNELS.STUDENT_UPDATE_LAST_ACTIVE]: {
        request: StudentUpdateLastActiveRequest;
        response: StudentUpdateLastActiveResponse;
    };
    [IPC_CHANNELS.STUDENT_GENERATE_USERNAME]: {
        request: StudentGenerateUsernameRequest;
        response: StudentGenerateUsernameResponse;
    };
    [IPC_CHANNELS.CONTENT_GET_MODULES]: {
        request: ContentGetModulesRequest;
        response: ContentGetModulesResponse;
    };
    [IPC_CHANNELS.CONTENT_GET_MODULE_BY_ID]: {
        request: ContentGetModuleByIdRequest;
        response: ContentGetModuleByIdResponse;
    };
    [IPC_CHANNELS.CONTENT_GET_LESSON_BY_ID]: {
        request: ContentGetLessonByIdRequest;
        response: ContentGetLessonByIdResponse;
    };
    [IPC_CHANNELS.CONTENT_GET_VIDEO_METADATA]: {
        request: ContentGetVideoMetadataRequest;
        response: ContentGetVideoMetadataResponse;
    };
    [IPC_CHANNELS.PROGRESS_UPDATE_VIDEO]: {
        request: ProgressUpdateVideoRequest;
        response: ProgressUpdateVideoResponse;
    };
    [IPC_CHANNELS.PROGRESS_GET_VIDEO]: {
        request: ProgressGetVideoRequest;
        response: ProgressGetVideoResponse;
    };
    [IPC_CHANNELS.PROGRESS_GET_ALL_FOR_STUDENT]: {
        request: ProgressGetAllForStudentRequest;
        response: ProgressGetAllForStudentResponse;
    };
    [IPC_CHANNELS.PROGRESS_MARK_MODULE_STARTED]: {
        request: ProgressMarkModuleStartedRequest;
        response: ProgressMarkModuleStartedResponse;
    };
    [IPC_CHANNELS.PROGRESS_GET_STARTED_MODULES]: {
        request: ProgressGetStartedModulesRequest;
        response: ProgressGetStartedModulesResponse;
    };
    [IPC_CHANNELS.PROGRESS_UPDATE_READING]: {
        request: ProgressUpdateReadingRequest;
        response: ProgressUpdateReadingResponse;
    };
    [IPC_CHANNELS.PROGRESS_GET_READING]: {
        request: ProgressGetReadingRequest;
        response: ProgressGetReadingResponse;
    };
    [IPC_CHANNELS.PROGRESS_GET_ALL_READING]: {
        request: ProgressGetAllReadingRequest;
        response: ProgressGetAllReadingResponse;
    };
    [IPC_CHANNELS.QUIZ_SUBMIT_ATTEMPT]: {
        request: QuizSubmitAttemptRequest;
        response: QuizSubmitAttemptResponse;
    };
    [IPC_CHANNELS.QUIZ_GET_ATTEMPTS]: {
        request: QuizGetAttemptsRequest;
        response: QuizGetAttemptsResponse;
    };
    [IPC_CHANNELS.QUIZ_GET_BEST_SCORE]: {
        request: QuizGetBestScoreRequest;
        response: QuizGetBestScoreResponse;
    };
    [IPC_CHANNELS.ANALYTICS_TRACK_EVENT]: {
        request: AnalyticsTrackEventRequest;
        response: AnalyticsTrackEventResponse;
    };
    [IPC_CHANNELS.ANALYTICS_GET_SUMMARY]: {
        request: AnalyticsGetSummaryRequest;
        response: AnalyticsGetSummaryResponse;
    };
    [IPC_CHANNELS.AI_SEND_MESSAGE]: {
        request: AISendMessageRequest;
        response: AISendMessageResponse;
    };
    [IPC_CHANNELS.AI_CANCEL_MESSAGE]: {
        request: AICancelMessageRequest;
        response: AICancelMessageResponse;
    };
    [IPC_CHANNELS.AI_GET_SESSION_HISTORY]: {
        request: AIGetSessionHistoryRequest;
        response: AIGetSessionHistoryResponse;
    };
    [IPC_CHANNELS.AI_SESSION_GET_ALL]: {
        request: AISessionGetAllRequest;
        response: AISessionGetAllResponse;
    };
    [IPC_CHANNELS.AI_SESSION_CREATE]: {
        request: AISessionCreateRequest;
        response: AISessionCreateResponse;
    };
    [IPC_CHANNELS.AI_SESSION_DELETE]: {
        request: AISessionDeleteRequest;
        response: AISessionDeleteResponse;
    };
    [IPC_CHANNELS.AI_CLEAR_HISTORY]: {
        request: AIClearHistoryRequest;
        response: AIClearHistoryResponse;
    };
    [IPC_CHANNELS.AI_VOICE_MESSAGE]: {
        request: AIVoiceMessageRequest;
        response: AIVoiceMessageResponse;
    };
    [IPC_CHANNELS.TTS_SPEAK]: {
        request: TTSSpeakRequest;
        response: TTSSpeakResponse;
    };
    [IPC_CHANNELS.TTS_STOP]: {
        request: TTSStopRequest;
        response: TTSStopResponse;
    };
    [IPC_CHANNELS.TTS_STATUS]: {
        request: TTSStatusRequest;
        response: TTSStatusResponse;
    };
    [IPC_CHANNELS.SESSION_START]: {
        request: { studentId: string };
        response: void;
    };
    [IPC_CHANNELS.SESSION_END]: {
        request: { csat: number | null; itp: number | null };
        response: void;
    };
    [IPC_CHANNELS.SESSION_PAUSE]: {
        request: void;
        response: void;
    };
    [IPC_CHANNELS.SESSION_SEEK]: {
        request: void;
        response: void;
    };
    [IPC_CHANNELS.SESSION_SPEED]: {
        request: { speed: number };
        response: void;
    };
    [IPC_CHANNELS.SESSION_UPDATE_LANGUAGE]: {
        request: { language: string };
        response: void;
    };
}

