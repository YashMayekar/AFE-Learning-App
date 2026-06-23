import { getDatabase, getUnsyncedSessions, markSessionsAsSynced, students, eq } from '@backend/db';
import type { DeviceInfo, SyncSessionPayload, SyncPayload } from '@afe/shared';
import os from 'os';

export class SyncService {
    private serverUrl: string;
    private fetchFn: any;

    constructor(serverUrl: string, fetchFn: any) {
        this.serverUrl = serverUrl;
        this.fetchFn = fetchFn;
    }

    /**
     * Validate NGO key with RMS server
     */
    async validateNGOKey(ngoKey: string): Promise<{ valid: boolean; ngoId?: number; ngoName?: string; error?: string }> {
        try {
            const response = await this.fetchFn(`${this.serverUrl}/validate-key`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ngoKey })
            });

            if (!response.ok) {
                return { valid: false, error: `Server responded with ${response.status}` };
            }

            return await response.json();
        } catch (error) {
            console.error('[SyncService] NGO key validation failed:', error);
            return { valid: false, error: String(error) };
        }
    }

    /**
     * Sync all unsynced sessions to RMS server
     */
    async syncToServer(deviceInfo: DeviceInfo): Promise<{ success: boolean; syncedCount: number }> {
        try {
            const db = getDatabase();

            // Get all unsynced sessions from the database
            const unsyncedSessions = await getUnsyncedSessions();

            if (unsyncedSessions.length === 0) {
                console.log('[SyncService] No unsynced sessions found');
                return { success: true, syncedCount: 0 };
            }

            console.log(`[SyncService] Found ${unsyncedSessions.length} unsynced sessions`);

            // Fetch students to look up student grade and username
            const allStudents = await db.select().from(students);
            const studentMap = new Map<string, typeof students.$inferSelect>();
            for (const s of allStudents) {
                studentMap.set(s.id, s);
            }

            // Map database AFESession rows to SyncSessionPayload format (48 columns specification)
            const mappedSessions: SyncSessionPayload[] = unsyncedSessions.map(session => {
                const student = studentMap.get(session.studentId);
                const startDate = new Date(session.startTime);

                // Calculate academic year (Apr - Mar boundary)
                const year = startDate.getFullYear();
                const month = startDate.getMonth(); // 0-indexed: Jan=0, Dec=11
                const academicYear = month >= 3 // April or later
                    ? `${year}-${String(year + 1).slice(2)}`
                    : `${year - 1}-${String(year).slice(2)}`;

                const monthName = startDate.toLocaleString('en-US', { month: 'long' });

                const osPlatform = os.platform() === 'win32'
                    ? 'Windows'
                    : os.platform() === 'darwin'
                        ? 'macOS'
                        : 'Linux';

                return {
                    sessionId: session.id,
                    avatarName: session.avatarName || null,
                    dataCollectionMethod: 'Method 2 - Individual Tracking',
                    partnerName: 'sama',
                    sessionDate: session.sessionDate,
                    academicYear,
                    monthName,
                    state: deviceInfo.state,
                    district: deviceInfo.district,
                    schoolUdise: deviceInfo.schoolUdise || null,
                    schoolName: deviceInfo.schoolName,
                    schoolType: 'NGO',
                    grade: student?.grade || 5,
                    studentCount: 1,
                    studentDummyId: session.studentId,
                    classSection: null,
                    unitType: 'Modular AFE',
                    tourType: 'Virtual',
                    language: session.language || 'English',
                    deliveryModel: 'Self-paced',
                    sessionDurationMinutes: session.durationMinutes,
                    csatAvg: session.csatAvg,
                    itpAvg: session.itpAvg,
                    npsScore: null,
                    responseRatePercentage: 100.00,
                    videoCompletionRate: session.videoCompletionRate,
                    quizAccuracyPercentage: session.quizAccuracyPercentage,
                    avgWatchTimeSeconds: session.avgWatchTimeSeconds,
                    videosCompletedCount: session.videosCompletedCount,
                    quizzesCompletedCount: session.quizzesCompletedCount,
                    totalQuestionsAnswered: session.totalQuestionsAnswered,
                    correctAnswersCount: session.correctAnswersCount,
                    sessionCompletedFlag: session.sessionCompletedFlag,
                    completionPercentage: session.completionPercentage,
                    totalWatchTimeSeconds: session.totalWatchTimeSeconds,
                    avgPlaybackSpeed: session.avgPlaybackSpeed,
                    pauseCountTotal: session.pauseCountTotal,
                    seekCountTotal: session.seekCountTotal,
                    facilitatorName: null,
                    teacherConfidenceRating: null,
                    teacherFeedbackText: null,
                    implementationChallenges: null,
                    deviceType: 'Laptop',
                    platformOs: osPlatform,
                    platformVersion: os.release(),
                    appVersion: deviceInfo.appVersion || '1.0.0',
                    networkType: session.networkType || 'unknown',
                    dataSource: 'Local DB',
                    submissionDate: new Date().toISOString().split('T')[0]
                };
            });

            const payload: SyncPayload = {
                ngoKey: deviceInfo.ngoKey,
                serialNumber: deviceInfo.serialNumber,
                macAddress: deviceInfo.macAddress,
                sessions: mappedSessions
            };

            // Send payload to POST /api/afe/sync
            const response = await this.fetchFn(`${this.serverUrl}/sync`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                console.error(`[SyncService] Server responded with ${response.status}: ${response.statusText}`);
                return { success: false, syncedCount: 0 };
            }

            // Mark successfully synced records locally
            const sessionIds = unsyncedSessions.map(s => s.id);
            await markSessionsAsSynced(sessionIds);

            console.log(`[SyncService] Successfully synced ${unsyncedSessions.length} sessions`);
            return { success: true, syncedCount: unsyncedSessions.length };
        } catch (error) {
            console.error('[SyncService] Session sync failed:', error);
            return { success: false, syncedCount: 0 };
        }
    }
}
