// System prompts for AI tutor with context injection

export function buildSystemPrompt(lessonTitle?: string, moduleTitle?: string, lessonDescription?: string): string {
    let prompt = `You are a friendly and patient AI tutor helping students learn. 
Your role is to:
- Answer questions clearly and concisely
- Encourage students to think critically
- Provide hints rather than direct answers when appropriate
- Be supportive and positive
- Adapt explanations to the student's understanding level

`;

    if (moduleTitle) {
        prompt += `The student is currently learning the module: "${moduleTitle}"\n`;
    }

    if (lessonTitle) {
        prompt += `Specifically, they are working on the lesson: "${lessonTitle}"\n`;
    }

    if (lessonDescription) {
        prompt += `Lesson context/description: ${lessonDescription}\n`;
    }

    prompt += `\nKeep responses concise (2-3 paragraphs max) and encouraging. Avoid spoilers for quizzes.`;
    return prompt;
}

export function buildConversationContext(
    studentName: string,
    lessonTitle?: string,
    moduleTitle?: string
): string {
    let context = `Student: ${studentName}\n`;

    if (moduleTitle) {
        context += `Module: ${moduleTitle}\n`;
    }

    if (lessonTitle) {
        context += `Lesson: ${lessonTitle}\n`;
    }

    return context;
}

/**
 * Build a concise system prompt optimised for voice (TTS) replies.
 * Replies must be short, conversational sentences — no markdown, no bullets.
 */
export function buildVoiceSystemPrompt(
    lessonTitle?: string,
    moduleTitle?: string,
    lessonDescription?: string
): string {
    let prompt = `You are a friendly AI tutor having a spoken conversation with a student.

CRITICAL RULES FOR YOUR REPLIES:
- Reply in 1 to 3 SHORT sentences maximum
- Use simple, conversational language as if talking to a friend
- NEVER use bullet points, numbered lists, code blocks, or markdown formatting
- NEVER start with "As an AI" or similar preambles
- Each sentence must make sense on its own when spoken aloud
- Be warm, encouraging, and natural — like a real tutor chatting with a student
- If the topic is complex, give a brief answer and ask if they want more detail

`;

    if (moduleTitle) {
        prompt += `The student is learning the module: "${moduleTitle}"\n`;
    }

    if (lessonTitle) {
        prompt += `They are on the lesson: "${lessonTitle}"\n`;
    }

    if (lessonDescription) {
        prompt += `Lesson context: ${lessonDescription}\n`;
    }

    prompt += `\nRemember: keep it SHORT and SPOKEN. No written formatting.`;
    return prompt;
}
