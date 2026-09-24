import type { Student, Module, Lesson, VideoProgress, QuizAttempt, AIChatMessage, AISession, StartedModule, ReadingProgress } from '../types/index.js';
import type { LatencySummary } from '../latency.js';
export declare const IPC_CHANNELS: {
    readonly STUDENT_CREATE: "student:create";
    readonly STUDENT_GET_ALL: "student:getAll";
    readonly STUDENT_GET_BY_ID: "student:getById";
    readonly STUDENT_UPDATE_LAST_ACTIVE: "student:updateLastActive";
    readonly STUDENT_GENERATE_USERNAME: "student:generateUsername";
    readonly CONTENT_GET_MODULES: "content:getModules";
    readonly CONTENT_GET_MODULE_BY_ID: "content:getModuleById";
    readonly CONTENT_GET_LESSON_BY_ID: "content:getLessonById";
    readonly CONTENT_GET_VIDEO_METADATA: "content:getVideoMetadata";
    readonly PROGRESS_UPDATE_VIDEO: "progress:updateVideo";
    readonly PROGRESS_GET_VIDEO: "progress:getVideo";
    readonly PROGRESS_GET_ALL_FOR_STUDENT: "progress:getAllForStudent";
    readonly PROGRESS_MARK_MODULE_STARTED: "progress:markModuleStarted";
    readonly PROGRESS_GET_STARTED_MODULES: "progress:getStartedModules";
    readonly PROGRESS_UPDATE_READING: "progress:updateReading";
    readonly PROGRESS_GET_READING: "progress:getReading";
    readonly PROGRESS_GET_ALL_READING: "progress:getAllReadingForStudent";
    readonly QUIZ_SUBMIT_ATTEMPT: "quiz:submitAttempt";
    readonly QUIZ_GET_ATTEMPTS: "quiz:getAttempts";
    readonly QUIZ_GET_BEST_SCORE: "quiz:getBestScore";
    readonly ANALYTICS_TRACK_EVENT: "analytics:trackEvent";
    readonly ANALYTICS_GET_SUMMARY: "analytics:getSummary";
    readonly LATENCY_GET_SUMMARY: "latency:getSummary";
    readonly AI_SEND_MESSAGE: "ai:sendMessage";
    readonly AI_CANCEL_MESSAGE: "ai:cancelMessage";
    readonly AI_GET_SESSION_HISTORY: "ai:getSessionHistory";
    readonly AI_SESSION_GET_ALL: "ai:session:getAll";
    readonly AI_SESSION_CREATE: "ai:session:create";
    readonly AI_SESSION_DELETE: "ai:session:delete";
    readonly AI_CLEAR_HISTORY: "ai:clearHistory";
    readonly AI_STREAM_CHUNK: "ai:streamChunk";
    readonly AI_SESSION_UPDATED: "ai:session:updated";
    readonly AI_VOICE_MESSAGE: "ai:voice-message";
    readonly TTS_SENTENCE_READY: "tts:sentence-ready";
    readonly AI_VOICE_DONE: "ai:voice-done";
    readonly RAG_UPLOAD_PDF: "rag:upload-pdf";
    readonly RAG_UPLOAD_STATUS: "rag:upload-status";
    readonly STT_START: "stt:start";
    readonly STT_CHUNK: "stt:chunk";
    readonly STT_STOP: "stt:stop";
    readonly STT_FINAL: "stt:final";
    readonly TTS_SPEAK: "tts:speak";
    readonly TTS_STOP: "tts:stop";
    readonly TTS_STATUS: "tts:status";
    readonly SESSION_START: "session:start";
    readonly SESSION_END: "session:end";
    readonly SESSION_PAUSE: "session:pause";
    readonly SESSION_SEEK: "session:seek";
    readonly SESSION_SPEED: "session:speed";
    readonly SESSION_UPDATE_LANGUAGE: "session:updateLanguage";
};
export type StudentCreateRequest = {
    name: string;
    avatar: string;
    grade?: number;
    language?: string;
};
export type StudentCreateResponse = Student;
export type StudentGetAllRequest = void;
export type StudentGetAllResponse = Student[];
export type StudentGetByIdRequest = {
    studentId: string;
};
export type StudentGetByIdResponse = Student | null;
export type StudentUpdateLastActiveRequest = {
    studentId: string;
};
export type StudentUpdateLastActiveResponse = void;
export type StudentGenerateUsernameRequest = {
    avatarName: string;
};
export type StudentGenerateUsernameResponse = string;
export type ContentGetModulesRequest = void;
export type ContentGetModulesResponse = Module[];
export type ContentGetModuleByIdRequest = {
    moduleId: string;
};
export type ContentGetModuleByIdResponse = Module | null;
export type ContentGetLessonByIdRequest = {
    lessonId: string;
};
export type ContentGetLessonByIdResponse = Lesson | null;
export type ContentGetVideoMetadataRequest = {
    videoUrl: string;
};
export type ContentGetVideoMetadataResponse = {
    duration: number;
    size: number;
} | null;
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
export type ProgressGetVideoRequest = {
    studentId: string;
    lessonId: string;
};
export type ProgressGetVideoResponse = VideoProgress | null;
export type ProgressGetAllForStudentRequest = {
    studentId: string;
};
export type ProgressGetAllForStudentResponse = VideoProgress[];
export type ProgressMarkModuleStartedRequest = {
    studentId: string;
    moduleId: string;
};
export type ProgressMarkModuleStartedResponse = void;
export type ProgressGetStartedModulesRequest = {
    studentId: string;
};
export type ProgressGetStartedModulesResponse = StartedModule[];
export type ProgressUpdateReadingRequest = {
    studentId: string;
    lessonId: string;
    readPercentage: number;
    readDuration: number;
    currentPage: number;
};
export type ProgressUpdateReadingResponse = void;
export type ProgressGetReadingRequest = {
    studentId: string;
    lessonId: string;
};
export type ProgressGetReadingResponse = ReadingProgress | null;
export type ProgressGetAllReadingRequest = {
    studentId: string;
};
export type ProgressGetAllReadingResponse = ReadingProgress[];
export type QuizSubmitAttemptRequest = {
    studentId: string;
    lessonId: string;
    answers: Array<{
        questionId: string;
        selectedAnswerIndex: number;
    }>;
    timeTaken: number;
};
export type QuizSubmitAttemptResponse = QuizAttempt;
export type QuizGetAttemptsRequest = {
    studentId: string;
    lessonId: string;
};
export type QuizGetAttemptsResponse = QuizAttempt[];
export type QuizGetBestScoreRequest = {
    studentId: string;
    lessonId: string;
};
export type QuizGetBestScoreResponse = number | null;
export type AnalyticsTrackEventRequest = {
    studentId: string;
    eventType: string;
    metadata: Record<string, unknown>;
};
export type AnalyticsTrackEventResponse = void;
export type AnalyticsGetSummaryRequest = {
    studentId: string;
};
export type AnalyticsGetSummaryResponse = {
    totalWatchTime: number;
    totalReadTime: number;
    modulesStarted: number;
    modulesCompleted: number;
    quizzesTaken: number;
    averageQuizScore: number;
};
export type LatencyGetSummaryRequest = void;
export type LatencyGetSummaryResponse = LatencySummary[];
export type AISessionGetAllRequest = {
    studentId: string;
};
export type AISessionGetAllResponse = AISession[];
export type AISessionCreateRequest = {
    studentId: string;
    title: string;
    mode: 'tutor' | 'chat';
    moduleId?: string;
};
export type AISessionCreateResponse = AISession;
export type AISessionDeleteRequest = {
    sessionId: string;
};
export type AISessionDeleteResponse = void;
export type AIGetSessionHistoryRequest = {
    sessionId: string;
};
export type AIGetSessionHistoryResponse = AIChatMessage[];
export type AISendMessageRequest = {
    studentId: string;
    message: string;
    sessionId: string;
    requestId: string;
};
export type AISendMessageResponse = {
    response: string;
    cancelled: boolean;
};
export type AICancelMessageRequest = {
    requestId: string;
};
export type AICancelMessageResponse = {
    cancelled: boolean;
};
export type AIGetHistoryRequest = {
    studentId: string;
};
export type AIGetHistoryResponse = AIChatMessage[];
export type AIClearHistoryRequest = {
    studentId: string;
};
export type AIClearHistoryResponse = void;
export type AIVoiceMessageRequest = {
    studentId: string;
    message: string;
    sessionId: string;
};
export type AIVoiceMessageResponse = {
    response: string;
};
export type RagUploadPdfRequest = void;
export type RagUploadPdfResponse = {
    accepted: boolean;
    fileName?: string;
};
export type TTSSpeakRequest = {
    text: string;
};
export type TTSSpeakResponse = {
    audio: ArrayBuffer | null;
    fallback: boolean;
};
export type TTSStopRequest = void;
export type TTSStopResponse = void;
export type TTSStatusRequest = void;
export type TTSStatusResponse = {
    available: boolean;
};
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
    [IPC_CHANNELS.LATENCY_GET_SUMMARY]: {
        request: LatencyGetSummaryRequest;
        response: LatencyGetSummaryResponse;
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
    [IPC_CHANNELS.RAG_UPLOAD_PDF]: {
        request: RagUploadPdfRequest;
        response: RagUploadPdfResponse;
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
        request: {
            studentId: string;
            language?: string;
        };
        response: void;
    };
    [IPC_CHANNELS.SESSION_END]: {
        request: {
            csat: number | null;
            itp: number | null;
            overallRating?: number | null;
            exploreCareerRating?: number | null;
            seeMoreToursRating?: number | null;
        };
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
        request: {
            speed: number;
        };
        response: void;
    };
    [IPC_CHANNELS.SESSION_UPDATE_LANGUAGE]: {
        request: {
            language: string;
        };
        response: void;
    };
}
//# sourceMappingURL=contracts.d.ts.map