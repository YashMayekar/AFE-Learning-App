import { eq, and } from 'drizzle-orm';
import { getDatabase } from '../core.js';
import { afeSessions, type AFESession, type NewAFESession } from '../schema/index.js';

/**
 * Save a newly completed AFE Session
 */
export async function saveAFESession(session: NewAFESession): Promise<void> {
    const db = getDatabase();
    await db.insert(afeSessions).values(session);
}

/**
 * Get all unsynced AFE Sessions
 */
export async function getUnsyncedSessions(): Promise<AFESession[]> {
    const db = getDatabase();
    return await db.select().from(afeSessions).where(eq(afeSessions.synced, false));
}

/**
 * Mark a list of session IDs as synced
 */
export async function markSessionsAsSynced(sessionIds: string[]): Promise<void> {
    const db = getDatabase();
    for (const id of sessionIds) {
        await db.update(afeSessions).set({ synced: true }).where(eq(afeSessions.id, id));
    }
}

/**
 * Get count of sessions for a student on a specific date (for incremental session sequence number)
 */
export async function getSessionCountForDate(studentId: string, dateStr: string): Promise<number> {
    const db = getDatabase();
    const result = await db.select().from(afeSessions).where(
        and(
            eq(afeSessions.studentId, studentId),
            eq(afeSessions.sessionDate, dateStr)
        )
    );
    return result.length;
}
