export declare const APP_NAME = "Offline Learning App";
export declare const APP_VERSION = "1.0.0";
export declare const DATA_PATHS: {
    readonly ROOT: "C:\\ProgramData\\OfflineLearningApp";
    readonly DATABASE: "data.db";
    readonly CONTENT: "content";
    readonly ASSETS: "assets";
    readonly AVATARS: "assets\\avatars";
    readonly VIDEOS: "assets\\videos";
    readonly MANIFEST: "content\\manifest.json";
};
export declare const AVATARS: readonly [{
    readonly id: "lion";
    readonly name: "Lion";
    readonly emoji: "🦁";
}, {
    readonly id: "elephant";
    readonly name: "Elephant";
    readonly emoji: "🐘";
}, {
    readonly id: "tiger";
    readonly name: "Tiger";
    readonly emoji: "🐯";
}, {
    readonly id: "panda";
    readonly name: "Panda";
    readonly emoji: "🐼";
}, {
    readonly id: "eagle";
    readonly name: "Eagle";
    readonly emoji: "🦅";
}, {
    readonly id: "parrot";
    readonly name: "Parrot";
    readonly emoji: "🦜";
}, {
    readonly id: "owl";
    readonly name: "Owl";
    readonly emoji: "🦉";
}, {
    readonly id: "penguin";
    readonly name: "Penguin";
    readonly emoji: "🐧";
}, {
    readonly id: "dolphin";
    readonly name: "Dolphin";
    readonly emoji: "🐬";
}, {
    readonly id: "butterfly";
    readonly name: "Butterfly";
    readonly emoji: "🦋";
}];
export declare const QUIZ_SCORING: {
    readonly PASSING_PERCENTAGE: 70;
    readonly MAX_ATTEMPTS: 5;
};
export declare const VIDEO_TRACKING: {
    readonly PROGRESS_UPDATE_INTERVAL: 5000;
    readonly COMPLETION_THRESHOLD: 90;
};
export declare const ANALYTICS_EVENTS: {
    readonly VIDEO_WATCHED: "video_watched";
    readonly QUIZ_COMPLETED: "quiz_completed";
    readonly MODULE_STARTED: "module_started";
    readonly MODULE_COMPLETED: "module_completed";
};
export declare const SUMMARY_REFRESH_DAYS = 10;
//# sourceMappingURL=constants.d.ts.map