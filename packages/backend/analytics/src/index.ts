import { eq, and, sql, desc } from '@backend/db';
import { getDatabase, analyticsEvents, videoProgress, quizAttempts, startedModules, readingProgress, learningSummaries, students, initializeDatabase } from '@backend/db';
import { randomUUID } from 'crypto';
import type { AnalyticsSummary, AnalyticsEventType } from './types.js';
import { generateLearningSummary } from '@backend/ai-tutor';
import { SUMMARY_REFRESH_DAYS } from '@afe/shared';

/**
 * Initialize the analytics service with the correct database path.
 * This ensures the nested DB instance points to the same file as the main app.
 */
export function initializeAnalytics(dbPath: string) {
    getDatabase(dbPath);
}

/**
 * Track an analytics event (append-only)
 */
export async function trackEvent(
    studentId: string,
    eventType: AnalyticsEventType,
    metadata: Record<string, unknown> = {}
): Promise<void> {
    const event = {
        id: randomUUID(),
        studentId,
        eventType,
        metadata,
        timestamp: new Date().toISOString(),
    };

    await getDatabase().insert(analyticsEvents).values(event);
}

/**
 * Track AI interaction time — lightweight: only module_id + duration + type.
 * No transcripts, summaries, or conversation content stored.
 */
export async function trackAIInteraction(
    studentId: string,
    interactionType: 'speech' | 'text',
    durationSeconds: number,
    moduleId?: string
): Promise<void> {
    const eventType: AnalyticsEventType = interactionType === 'speech' ? 'ai_voice_chat' : 'ai_text_chat';
    await trackEvent(studentId, eventType, {
        moduleId: moduleId || null,
        durationSeconds: Math.round(durationSeconds),
    });
}

/**
 * Get analytics summary for a student
 */
export async function getAnalyticsSummary(studentId: string): Promise<AnalyticsSummary> {
    // Total watch time from video progress
    const videoProgressData = await getDatabase()
        .select()
        .from(videoProgress)
        .where(eq(videoProgress.studentId, studentId));

    const totalWatchTime = videoProgressData.reduce(
        (sum, vp) => sum + vp.totalWatchDuration,
        0
    );

    // Total read time from reading progress
    const readingProgressData = await getDatabase()
        .select()
        .from(readingProgress)
        .where(eq(readingProgress.studentId, studentId));

    const totalReadTime = readingProgressData.reduce(
        (sum, rp) => sum + rp.totalReadDuration,
        0
    );

    // Module events
    const moduleEvents = await getDatabase()
        .select()
        .from(analyticsEvents)
        .where(
            and(
                eq(analyticsEvents.studentId, studentId),
                eq(analyticsEvents.eventType, 'module_completed')
            )
        );

    const startedModulesData = await getDatabase()
        .select()
        .from(startedModules)
        .where(eq(startedModules.studentId, studentId));

    const modulesStarted = startedModulesData.length;
    const modulesCompleted = moduleEvents.length;

    // Quiz statistics
    const quizData = await getDatabase()
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.studentId, studentId));

    const quizzesTaken = quizData.length;
    const averageQuizScore =
        quizzesTaken > 0
            ? quizData.reduce((sum, q) => sum + (q.score / q.totalQuestions) * 100, 0) /
            quizzesTaken
            : 0;

    // Last active date
    const lastEvent = await getDatabase()
        .select()
        .from(analyticsEvents)
        .where(eq(analyticsEvents.studentId, studentId))
        .orderBy(sql`${analyticsEvents.timestamp} DESC`)
        .limit(1);

    const lastActiveDate = lastEvent[0]?.timestamp || new Date().toISOString();

    return {
        totalWatchTime,
        totalReadTime,
        modulesStarted,
        modulesCompleted,
        quizzesTaken,
        averageQuizScore: Math.round(averageQuizScore * 10) / 10, // 1 decimal
        lastActiveDate,
    };
}

/**
 * Get time spent per module for a student
 */
export async function getModuleTimeSpent(
    studentId: string,
    moduleId: string
): Promise<number> {
    const events = await getDatabase()
        .select()
        .from(analyticsEvents)
        .where(
            and(
                eq(analyticsEvents.studentId, studentId),
                sql`json_extract(${analyticsEvents.metadata}, '$.moduleId') = ${moduleId}`
            )
        );

    // Sum up watch time from metadata
    return events.reduce((sum, event) => {
        const metadata = event.metadata as any;
        return sum + (metadata.watchDuration || 0);
    }, 0);
}

/**
 * Check and generate learning summaries for all students
 * To be called on application startup
 */
export async function checkAndGenerateSummaries(dbPath?: string): Promise<void> {
    const db = getDatabase(dbPath);
    const allStudents = await db.select().from(students);
    const now = new Date();

    for (const student of allStudents) {
        try {
            // Get latest summary for this student
            const latestSummaryResult = await db
                .select()
                .from(learningSummaries)
                .where(eq(learningSummaries.studentId, student.id))
                .orderBy(desc(learningSummaries.lastUpdatedAt))
                .limit(1);

            const latestSummary = latestSummaryResult[0];
            let shouldGenerate = false;

            if (!latestSummary) {
                shouldGenerate = true;
                console.log(`[SummaryService] No summary found for student ${student.name}, generating first one...`);
            } else {
                const lastUpdated = new Date(latestSummary.lastUpdatedAt);
                const diffTime = Math.abs(now.getTime() - lastUpdated.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays >= SUMMARY_REFRESH_DAYS) {
                    shouldGenerate = true;
                    console.log(`[SummaryService] Summary for student ${student.name} is ${diffDays} days old, refreshing...`);
                }
            }

            if (shouldGenerate) {
                const { summary, progressNote } = await generateLearningSummary(
                    student.id,
                    latestSummary?.summaryText
                );

                await db.insert(learningSummaries).values({
                    id: randomUUID(),
                    studentId: student.id,
                    summaryText: summary,
                    progressNote: progressNote || null,
                    lastUpdatedAt: now.toISOString()
                });
                console.log(`[SummaryService] Successfully generated summary for student ${student.name}`);
            }
        } catch (error) {
            console.error(`[SummaryService] Failed to generate summary for student ${student.name}:`, error);
        }
    }
}

export * from './sync.js';
export * from './types.js';
export * from './daily-sync.js';
