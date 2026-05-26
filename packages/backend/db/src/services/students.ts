import { eq } from 'drizzle-orm';
import { getDatabase } from '../core.js';
import { students, type Student, type NewStudent } from '../schema/index.js';
import { randomUUID } from 'crypto';

const POSITIVE_ADJECTIVES = [
    'Glorious', 'Brave', 'Happy', 'Bright', 'Clever', 'Kind', 'Creative', 'Energetic',
    'Joyful', 'Polite', 'Calm', 'Friendly', 'Cheerful', 'Smart', 'Loyal', 'Helpful',
    'Gentle', 'Wise', 'Strong', 'Quick', 'Noble', 'Proud', 'Shiny', 'Sparkly',
    'Sunny', 'Smiling', 'Magic', 'Golden', 'Super', 'Honest', 'Bold', 'Charming',
    'Daring', 'Eager', 'Fearless', 'Jolly', 'Lively', 'Merry', 'Nice', 'Playful',
    'Silly', 'Sweet', 'Valiant', 'Vibrant', 'Wonderful', 'Active', 'Adventurous',
    'Alert', 'Amazing', 'Awesome', 'Brilliant', 'Champion', 'Dynamic', 'Excellent',
    'Excited', 'Glowing', 'Great', 'Heroic', 'Inspiring', 'Invincible', 'Keen',
    'Lucky', 'Mighty', 'Positive', 'Radiant', 'Respectful', 'Tough', 'Unique',
    'Worthy', 'Zesty'
];

/**
 * Generate a unique username based on the selected avatar that does not exist in the database
 */
export async function generateUniqueUsername(avatarName: string): Promise<string> {
    const db = getDatabase();
    const existing = await db.select({ name: students.name }).from(students);
    const existingNames = new Set(existing.map((s) => s.name.toLowerCase()));

    const maxAttempts = 1000;
    for (let i = 0; i < maxAttempts; i++) {
        const adjective = POSITIVE_ADJECTIVES[Math.floor(Math.random() * POSITIVE_ADJECTIVES.length)];
        const number = Math.floor(100 + Math.random() * 900); // 3-digit number (100-999)
        const generated = `${adjective}${avatarName}${number}`;
        if (!existingNames.has(generated.toLowerCase())) {
            return generated;
        }
    }
    // Fallback if somehow collisions are high
    return `${POSITIVE_ADJECTIVES[0]}${avatarName}${Math.floor(100 + Math.random() * 900)}`;
}

/**
 * Create a new student
 */
export async function createStudent(name: string, avatar: string): Promise<Student> {
    const db = getDatabase();
    
    // Programmatic uniqueness check
    const existing = await db.select().from(students).where(eq(students.name, name));
    if (existing.length > 0) {
        throw new Error('Username already exists');
    }

    const now = new Date().toISOString();
    const newStudent: NewStudent = {
        id: randomUUID(),
        name,
        avatar,
        createdAt: now,
        lastActiveAt: now,
    };

    await db.insert(students).values(newStudent);
    return newStudent as Student;
}

/**
 * Get all students
 */
export async function getAllStudents(): Promise<Student[]> {
    return await getDatabase().select().from(students);
}

/**
 * Get student by ID
 */
export async function getStudentById(studentId: string): Promise<Student | null> {
    const result = await getDatabase().select().from(students).where(eq(students.id, studentId));
    return result[0] || null;
}

/**
 * Update student's last active timestamp
 */
export async function updateStudentLastActive(studentId: string): Promise<void> {
    const now = new Date().toISOString();
    await getDatabase().update(students).set({ lastActiveAt: now }).where(eq(students.id, studentId));
}

/**
 * Delete a student (cascades to all related data)
 */
export async function deleteStudent(studentId: string): Promise<void> {
    await getDatabase().delete(students).where(eq(students.id, studentId));
}
