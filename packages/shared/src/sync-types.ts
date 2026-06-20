// Shared types for AFE-RMS sync
export interface DeviceInfo {
    serialNumber: string;
    macAddress: string;
    ngoKey: string;
    partnerName: string;
    schoolName: string;
    schoolUdise: string;
    state: string;
    district: string;
}

export interface SyncSessionPayload {
    sessionId: string;
    dataCollectionMethod: string;
    partnerName: string;
    sessionDate: string;
    academicYear: string;
    monthName: string;
    state: string;
    district: string;
    schoolUdise: string;
    schoolName: string;
    schoolType: string;
    grade: number;
    studentCount: number;
    studentDummyId: string;
    classSection: string | null;
    unitType: string;
    tourType: string;
    language: string;
    deliveryModel: string;
    sessionDurationMinutes: number;
    csatAvg: number | null;
    itpAvg: number | null;
    npsScore: number | null;
    responseRatePercentage: number | null;
    videoCompletionRate: number;
    quizAccuracyPercentage: number;
    avgWatchTimeSeconds: number;
    videosCompletedCount: number;
    quizzesCompletedCount: number;
    totalQuestionsAnswered: number;
    correctAnswersCount: number;
    sessionCompletedFlag: boolean;
    completionPercentage: number;
    totalWatchTimeSeconds: number;
    avgPlaybackSpeed: number;
    pauseCountTotal: number;
    seekCountTotal: number;
    facilitatorName: string | null;
    teacherConfidenceRating: number | null;
    teacherFeedbackText: string | null;
    implementationChallenges: string | null;
    deviceType: string;
    platformOs: string;
    platformVersion: string;
    appVersion: string;
    networkType: string;
    dataSource: string;
    submissionDate: string;
}

export interface SyncPayload {
    ngoKey: string;
    serialNumber: string;
    macAddress: string;
    sessions: SyncSessionPayload[];
}
