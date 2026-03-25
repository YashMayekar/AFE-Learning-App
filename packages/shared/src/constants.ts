// Application-wide constants

export const APP_NAME = 'Offline Learning App';
export const APP_VERSION = '1.0.0';

// Data paths (default root: C:\ProgramData\OfflineLearningApp\)
// Note: Desktop app overrides this at runtime with dynamic AppData path.
export const DATA_PATHS = {
    ROOT: 'C:\\ProgramData\\OfflineLearningApp',
    DATABASE: 'data.db',
    CONTENT: 'content',
    ASSETS: 'assets',
    AVATARS: 'assets\\avatars',
    VIDEOS: 'assets\\videos',
    MANIFEST: 'content\\manifest.json',
} as const;

// Avatar options (animals/birds)
export const AVATARS = [
    { id: 'lion', name: 'Lion', emoji: '🦁' },
    { id: 'elephant', name: 'Elephant', emoji: '🐘' },
    { id: 'tiger', name: 'Tiger', emoji: '🐯' },
    { id: 'panda', name: 'Panda', emoji: '🐼' },
    { id: 'eagle', name: 'Eagle', emoji: '🦅' },
    { id: 'parrot', name: 'Parrot', emoji: '🦜' },
    { id: 'owl', name: 'Owl', emoji: '🦉' },
    { id: 'penguin', name: 'Penguin', emoji: '🐧' },
    { id: 'dolphin', name: 'Dolphin', emoji: '🐬' },
    { id: 'butterfly', name: 'Butterfly', emoji: '🦋' },
] as const;

// Quiz scoring
export const QUIZ_SCORING = {
    PASSING_PERCENTAGE: 70,
    MAX_ATTEMPTS: 5,
} as const;

// Video tracking
export const VIDEO_TRACKING = {
    PROGRESS_UPDATE_INTERVAL: 5000, // 5 seconds
    COMPLETION_THRESHOLD: 90, // 90% watched = completed
} as const;

// Analytics
export const ANALYTICS_EVENTS = {
    VIDEO_WATCHED: 'video_watched',
    QUIZ_COMPLETED: 'quiz_completed',
    MODULE_STARTED: 'module_started',
    MODULE_COMPLETED: 'module_completed',
} as const;

// Summary refresh config
export const SUMMARY_REFRESH_DAYS = 10;
