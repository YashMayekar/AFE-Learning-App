import { z } from 'zod';

// Helper to clean strings for fuzzy matching
function normalizeText(text: string): string {
    return text
        .trim()
        .toLowerCase()
        .replace(/^[a-d][.)]\s*/i, '')
        .replace(/[.!?।]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Quiz question schema with auto-recovery for answer -> correctAnswerIndex
export const QuizQuestionSchema = z.preprocess((val: any) => {
    if (val && typeof val === 'object') {
        const copy = { ...val };
        if (copy.correctAnswerIndex === undefined && typeof copy.answer === 'string' && Array.isArray(copy.options)) {
            const rawAns = copy.answer.trim();
            if (/^[a-d]$/i.test(rawAns)) {
                const letterMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
                copy.correctAnswerIndex = letterMap[rawAns.toLowerCase()];
            } else {
                const normAns = normalizeText(rawAns);
                let foundIdx = copy.options.findIndex((opt: string) => typeof opt === 'string' && normalizeText(opt) === normAns);
                if (foundIdx === -1) {
                    foundIdx = copy.options.findIndex((opt: string) => typeof opt === 'string' && (normalizeText(opt).includes(normAns) || normAns.includes(normalizeText(opt))));
                }
                if (foundIdx !== -1) {
                    copy.correctAnswerIndex = foundIdx;
                }
            }
        }
        return copy;
    }
    return val;
}, z.object({
    id: z.string().min(1),
    question: z.string().min(1),
    options: z.array(z.string()).min(2).max(6),
    correctAnswerIndex: z.number().int().min(0),
    explanation: z.string().optional(),
}));

// Quiz data schema
export const QuizDataSchema = z.object({
    questions: z.array(QuizQuestionSchema).min(1),
    passingScore: z.number().int().min(0).max(100).default(70),
});

// Lesson schema
export const LessonSchema = z.object({
    id: z.string().min(1),
    contentId: z.string().min(1),
    version: z.string(),
    hash: z.string(),
    moduleId: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    type: z.enum(['video', 'quiz', 'reading']),
    videoUrl: z.string().optional(),
    readingUrl: z.string().optional(),
    quizData: QuizDataSchema.optional(),
    order: z.number().int().min(0),
    minVideoLength: z.number().int().min(0).optional(),   // seconds – minimum watch time for completion
    minReadingTime: z.number().int().min(0).optional(),   // seconds – minimum read time for completion
});

// Module schema
export const ModuleSchema = z.object({
    id: z.string().min(1),
    contentId: z.string().min(1),
    version: z.string(),
    hash: z.string(),
    title: z.string().min(1),
    description: z.string(),
    language: z.string().optional(),
    thumbnailUrl: z.string().optional(),
    lessons: z.array(LessonSchema).min(1),
});

// Content manifest schema
export const ContentManifestSchema = z.object({
    version: z.string(),
    generatedAt: z.string(),
    modules: z.array(ModuleSchema).min(1),
});

// Type exports
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type QuizData = z.infer<typeof QuizDataSchema>;
export type Lesson = z.infer<typeof LessonSchema>;
export type Module = z.infer<typeof ModuleSchema>;
export type ContentManifest = z.infer<typeof ContentManifestSchema>;

// Validation errors
export class ContentValidationError extends Error {
    constructor(
        message: string,
        public errors: z.ZodError
    ) {
        super(message);
        this.name = 'ContentValidationError';
    }
}
