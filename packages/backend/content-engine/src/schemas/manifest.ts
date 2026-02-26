import { z } from 'zod';

// Quiz question schema
export const QuizQuestionSchema = z.object({
    id: z.string().uuid(),
    question: z.string().min(1),
    options: z.array(z.string()).min(2).max(6),
    correctAnswerIndex: z.number().int().min(0),
    explanation: z.string().optional(),
});

// Quiz data schema
export const QuizDataSchema = z.object({
    questions: z.array(QuizQuestionSchema).min(1),
    passingScore: z.number().int().min(0).max(100).default(70),
});

// Lesson schema
export const LessonSchema = z.object({
    id: z.string().uuid(),
    contentId: z.string().uuid(),
    version: z.string(),
    hash: z.string(),
    moduleId: z.string().uuid(),
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
    id: z.string().uuid(),
    contentId: z.string().uuid(),
    version: z.string(),
    hash: z.string(),
    title: z.string().min(1),
    description: z.string(),
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
