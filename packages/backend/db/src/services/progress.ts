import { eq, and, desc } from 'drizzle-orm';
import { getDatabase } from '../core.js';
import {
    videoProgress,
    quizAttempts,
    startedModules,
    readingProgress,
    type VideoProgress,
    type NewVideoProgress,
    type QuizAttempt,
    type NewQuizAttempt,
    type StartedModule,
    type NewStartedModule,
    type ReadingProgress,
    type NewReadingProgress,
} from '../schema/index.js';
import { randomUUID } from 'crypto';



// ============ Video Progress ============

/**
 * Update video watch progress
 */
export async function updateVideoProgress(
    studentId: string,
    lessonId: string,
    watchedPercentage: number,
    watchDuration: number,
    watchedSegments?: [number, number][],
    lastPosition?: number,
    completed?: boolean
): Promise<void> {
    const now = new Date().toISOString();

    // Sanity check: prevent huge jumps (e.g. > 1 hour at once is likely a bug)
    if (watchDuration > 3600) {
        console.warn(`[ProgressService] Ignoring suspicious watchDuration: ${watchDuration}s`);
        return;
    }

    // Ensure we store integers
    const durationToAdd = Math.round(watchDuration);

    // Check if record exists
    const existing = await getDatabase()
        .select()
        .from(videoProgress)
        .where(and(eq(videoProgress.studentId, studentId), eq(videoProgress.lessonId, lessonId)));

    if (existing.length > 0) {
        // Update existing
        await getDatabase()
            .update(videoProgress)
            .set({
                watchedPercentage: Math.max(watchedPercentage, existing[0].watchedPercentage),
                totalWatchDuration: existing[0].totalWatchDuration + durationToAdd,
                lastWatchedAt: now,
                watchedSegments: watchedSegments !== undefined ? watchedSegments : existing[0].watchedSegments,
                lastPosition: lastPosition !== undefined ? lastPosition : existing[0].lastPosition,
                completed: completed !== undefined ? completed : (existing[0].completed || watchedPercentage >= 95),
            })
            .where(and(eq(videoProgress.studentId, studentId), eq(videoProgress.lessonId, lessonId)));
    } else {
        // Create new
        const newProgress: NewVideoProgress = {
            id: randomUUID(),
            studentId,
            lessonId,
            watchedPercentage,
            totalWatchDuration: durationToAdd,
            lastWatchedAt: now,
            watchedSegments: watchedSegments || [],
            lastPosition: lastPosition || 0,
            completed: completed || watchedPercentage >= 95,
        };
        await getDatabase().insert(videoProgress).values(newProgress);
    }
}

/**
 * Get video progress for a student and lesson
 */
export async function getVideoProgress(
    studentId: string,
    lessonId: string
): Promise<VideoProgress | null> {
    const result = await getDatabase()
        .select()
        .from(videoProgress)
        .where(and(eq(videoProgress.studentId, studentId), eq(videoProgress.lessonId, lessonId)));

    return result[0] || null;
}

/**
 * Get all video progress for a student
 */
export async function getAllVideoProgressForStudent(
    studentId: string
): Promise<VideoProgress[]> {
    return await getDatabase().select().from(videoProgress).where(eq(videoProgress.studentId, studentId));
}

// ============ Quiz Attempts ============

/**
 * Submit a quiz attempt
 */
export async function submitQuizAttempt(
    studentId: string,
    lessonId: string,
    score: number,
    totalQuestions: number,
    answers: Array<{ questionId: string; selectedAnswerIndex: number; isCorrect: boolean }>,
    timeTaken: number
): Promise<QuizAttempt> {
    // Get attempt number
    const previousAttempts = await getDatabase()
        .select()
        .from(quizAttempts)
        .where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, lessonId)));

    const attemptNumber = previousAttempts.length + 1;
    const now = new Date().toISOString();

    const newAttempt: NewQuizAttempt = {
        id: randomUUID(),
        studentId,
        lessonId,
        score,
        totalQuestions,
        answers: JSON.stringify(answers),
        attemptNumber,
        completedAt: now,
        timeTaken,
    };

    await getDatabase().insert(quizAttempts).values(newAttempt);
    return newAttempt as QuizAttempt;
}

/**
 * Get all quiz attempts for a student and lesson
 */
export async function getQuizAttempts(
    studentId: string,
    lessonId: string
): Promise<QuizAttempt[]> {
    return await getDatabase()
        .select()
        .from(quizAttempts)
        .where(and(eq(quizAttempts.studentId, studentId), eq(quizAttempts.lessonId, lessonId)))
        .orderBy(desc(quizAttempts.completedAt));
}

/**
 * Get best quiz score for a student and lesson
 */
export async function getBestQuizScore(
    studentId: string,
    lessonId: string
): Promise<number | null> {
    const attempts = await getQuizAttempts(studentId, lessonId);
    if (attempts.length === 0) return null;

    return Math.max(...attempts.map((a) => (a.score / a.totalQuestions) * 100));
}

/**
 * Get quiz improvement metrics (first vs best attempt)
 */
export async function getQuizImprovement(
    studentId: string,
    lessonId: string
): Promise<{ firstScore: number; bestScore: number; improvement: number } | null> {
    const attempts = await getQuizAttempts(studentId, lessonId);
    if (attempts.length === 0) return null;

    const firstAttempt = attempts[attempts.length - 1];
    const firstScore = (firstAttempt.score / firstAttempt.totalQuestions) * 100;
    const bestScore = Math.max(...attempts.map((a) => (a.score / a.totalQuestions) * 100));

    return {
        firstScore,
        bestScore,
        improvement: bestScore - firstScore,
    };
}


// ============ Module Tracking ============

/**
 * Mark a module as started (or update last accessed time)
 */
export async function markModuleStarted(
    studentId: string,
    moduleId: string
): Promise<void> {
    const now = new Date().toISOString();

    // Check if record exists
    const existing = await getDatabase()
        .select()
        .from(startedModules)
        .where(and(eq(startedModules.studentId, studentId), eq(startedModules.moduleId, moduleId)));

    if (existing.length > 0) {
        // Update existing
        await getDatabase()
            .update(startedModules)
            .set({
                lastAccessedAt: now,
            })
            .where(and(eq(startedModules.studentId, studentId), eq(startedModules.moduleId, moduleId)));
    } else {
        // Create new
        const newEntry: NewStartedModule = {
            id: randomUUID(),
            studentId,
            moduleId,
            startedAt: now,
            lastAccessedAt: now,
        };
        await getDatabase().insert(startedModules).values(newEntry);
    }
}

/**
 * Get all started modules for a student
 */
export async function getStartedModules(
    studentId: string
): Promise<StartedModule[]> {
    return await getDatabase()
        .select()
        .from(startedModules)
        .where(eq(startedModules.studentId, studentId))
        .orderBy(desc(startedModules.lastAccessedAt));
}

// ============ Reading Progress ============

/**
 * Update reading progress (PDFs)
 */
export async function updateReadingProgress(
    studentId: string,
    lessonId: string,
    readPercentage: number,
    readDuration: number,
    currentPage: number
): Promise<void> {
    const now = new Date().toISOString();

    // Check if record exists
    const existing = await getDatabase()
        .select()
        .from(readingProgress)
        .where(and(eq(readingProgress.studentId, studentId), eq(readingProgress.lessonId, lessonId)));

    if (existing.length > 0) {
        // Update existing
        await getDatabase()
            .update(readingProgress)
            .set({
                readPercentage: Math.max(readPercentage, existing[0].readPercentage),
                totalReadDuration: existing[0].totalReadDuration + readDuration,
                currentPage: currentPage,
                lastReadAt: now,
            })
            .where(and(eq(readingProgress.studentId, studentId), eq(readingProgress.lessonId, lessonId)));
    } else {
        // Create new
        const newProgress: NewReadingProgress = {
            id: randomUUID(),
            studentId,
            lessonId,
            readPercentage,
            totalReadDuration: readDuration,
            currentPage,
            lastReadAt: now,
        };
        await getDatabase().insert(readingProgress).values(newProgress);
    }
}

/**
 * Get reading progress for a student and lesson
 */
export async function getReadingProgress(
    studentId: string,
    lessonId: string
): Promise<ReadingProgress | null> {
    const result = await getDatabase()
        .select()
        .from(readingProgress)
        .where(and(eq(readingProgress.studentId, studentId), eq(readingProgress.lessonId, lessonId)));

    return (result[0] as ReadingProgress) || null;
}

/**
 * Get all reading progress for a student
 */
export async function getAllReadingProgressForStudent(
    studentId: string
): Promise<ReadingProgress[]> {
    return (await getDatabase()
        .select()
        .from(readingProgress)
        .where(eq(readingProgress.studentId, studentId))) as ReadingProgress[];
}
