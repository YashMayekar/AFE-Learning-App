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
    // Performance measurement
    LATENCY_GET_SUMMARY: 'latency:getSummary',
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
    RAG_UPLOAD_PDF: 'rag:upload-pdf',
    RAG_UPLOAD_STATUS: 'rag:upload-status',
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
};
