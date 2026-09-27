// packages/backend/ai-tutor/src/index.ts
import { getDatabase, aiChatHistory, aiSessions, students, modules, learningSummaries, eq, desc, sql, inArray, initializeDatabase } from '@backend/db';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Ollama } from 'ollama';
import type { Options as OllamaOptions } from 'ollama';
import { buildSystemPrompt, buildVoiceSystemPrompt } from './prompts.js';
import { loadContentManifest, getModuleById } from '@backend/content-engine';

import { DATA_PATHS } from '@afe/shared';
import { isLowEndDevice } from '@afe/shared/hardware';
import { recordLatency } from '@afe/shared';
import { measureLatencyAsync } from '@afe/shared';
import { ollamaQueue } from './ollamaQueue.js';
import { getRagEngine } from '@backend/rag-engine';

// ---------------------------------------------------------------------------
// LLM prompt logger
// ---------------------------------------------------------------------------

/**
 * Appends the exact messages array sent to Ollama to a dedicated log file so
 * the full prompt (system prompt + history + user turn) can be inspected
 * during debugging without being truncated by the console.
 *
 * In development the file lands at:  dev-data/logs/llm-prompts.log
 * In production it lands in the app's AppData logs/ directory.
 */
function logLlmPrompt(messages: Array<{ role: string; content: string }>): void {
    try {
        const currentDir = path.dirname(fileURLToPath(import.meta.url));
        const logsDir = path.resolve(currentDir, '../../../../dev-data/logs');
        const logFile = path.join(logsDir, 'llm-prompts.log');

        fs.mkdirSync(logsDir, { recursive: true });
        fs.appendFileSync(logFile, JSON.stringify(messages, null, 2) + '\n', 'utf8');
    } catch (err) {
        console.warn('[AiTutor] Failed to write LLM prompt log:', err);
    }
}

// Ollama client (assumes Ollama is running locally)
let ollama: Ollama | null = null;
let contentManifest: any = null;
let contentRoot: string | undefined;

const OLLAMA_MODEL_CANDIDATES = [
    'qwen2.5:1.5b',
    'qwen2.5-coder:7b',
    'qwen2.5:7b',
    'llama3.2:3b',
    'llama3.1:8b',
    'gemma3:4b',
];

// ---------------------------------------------------------------------------
// Ollama request tuning (latency): keep the model resident, cap output
// length, and keep num_ctx fixed so the model is never reloaded mid-session.
// ---------------------------------------------------------------------------

/** Keep the model loaded between turns so repeat questions skip the (multi-second) reload. */
const OLLAMA_KEEP_ALIVE = '30m';
const CHAT_NUM_PREDICT = 768;
const VOICE_NUM_PREDICT = 256;
const TITLE_NUM_PREDICT = 32;

// Fixed across every call site (warmup, chat, voice, title). Ollama reloads the
// model — discarding warm state and the KV cache — whenever num_ctx changes
// between requests, which was the root cause of 10-20s latency spikes. Must
// comfortably fit: system prompt + 2 trimmed history turns + RAG context
// (maxContextTokens: 800) + CHAT_NUM_PREDICT (768) + ~256 overhead.
const OLLAMA_NUM_CTX = 4096;

// Rare slow-path exception: when RagEngine.query() returns a full chapter
// (maxSectionTokens: 6000) instead of a few chunks, 4096 tokens may not fit.
// Only used as an explicit opt-in, never as the default per-turn num_ctx.
const OLLAMA_NUM_CTX_LARGE = 16384;

// Applied to every client.chat() call alongside num_ctx.
const OLLAMA_NUM_BATCH = 1024;
const OLLAMA_NUM_UBATCH = 1024;
const OLLAMA_NUM_THREAD = 8;

// ollama-js's Options type doesn't declare num_ubatch even though the Ollama
// server supports it as a Modelfile/runtime parameter.
type ExtendedOllamaOptions = Partial<OllamaOptions> & { num_ubatch?: number };

function buildOllamaOptions(opts: ExtendedOllamaOptions): Partial<OllamaOptions> {
    return opts;
}

/** Rough chars-per-token heuristic. */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/** Only used by the rare large-context slow path, not the default per-turn num_ctx. */
function needsLargeContext(messages: Array<{ content: string }>, numPredict: number): boolean {
    const promptTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content), 0);
    return promptTokens + numPredict + 256 > OLLAMA_NUM_CTX;
}

/**
 * Consumes an Ollama streaming response fully, forwarding each token to
 * onChunk (if given) immediately as it arrives -- no buffering until the
 * response completes.
 */
async function consumeOllamaStream(
    stream: AsyncIterable<{ message: { content: string } }>,
    onChunk: ((chunk: string) => void) | undefined,
    onFirstToken: () => void,
    shouldCancel?: () => boolean
): Promise<{ text: string; cancelled: boolean }> {
    let text = '';
    let firstTokenSeen = false;
    let cancelled = false;
    for await (const part of stream) {
        if (shouldCancel?.()) {
            cancelled = true;
            break;
        }
        const chunk = part.message.content;
        if (!firstTokenSeen && chunk) {
            firstTokenSeen = true;
            onFirstToken();
        }
        text += chunk;
        onChunk?.(chunk);
    }
    return { text, cancelled };
}

/**
 * Turns and older-turn window: verbatim recent turns keep the growing prefix
 * byte-identical across calls (cache reuse); anything older is folded into
 * one short summary message instead of being resent (and regrown) forever.
 */

// Toggles whether history sent to Ollama is folded into a summary (true) or
// sent raw (false). True: system prompt + history summary + last turn + new
// question. False: system prompt + last 2 turns verbatim + new question, no
// summarization.
let historySummaryEnabled = false;

export function getHistorySummaryEnabled(): boolean {
    return historySummaryEnabled;
}

export function setHistorySummaryEnabled(enabled: boolean): boolean {
    historySummaryEnabled = enabled;
    return historySummaryEnabled;
}

/** One user+assistant pair -- "the last turn" kept verbatim in summarized mode. */
const LAST_TURN_MESSAGES = 2;
/** Trailing raw messages (2 turns) sent when summarization is disabled. */
const RAW_RECENT_MESSAGES = 4;

function summarizeOlderTurns(older: Array<{ role: string; content: string }>): string {
    return older
        .map((h) => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.content.slice(0, 140)}`)
        .join('\n');
}

/**
 * Builds the history messages sent to Ollama, honoring historySummaryEnabled:
 *  - summarized (default): everything before the last turn is folded into one
 *    summary message, and the last turn is kept verbatim.
 *  - raw: no summary at all, just the last two turns verbatim.
 */
function buildHistoryMessages(
    history: Array<{ role: string; content: string }>
): Array<{ role: 'user' | 'assistant'; content: string }> {
    if (!historySummaryEnabled) {
        return history
            .slice(-RAW_RECENT_MESSAGES)
            .map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }));
    }

    if (history.length <= LAST_TURN_MESSAGES) {
        return history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }));
    }

    const older = history.slice(0, history.length - LAST_TURN_MESSAGES);
    const lastTurn = history.slice(history.length - LAST_TURN_MESSAGES).map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
    }));

    return [
        { role: 'user', content: `Earlier conversation summary (for context only):\n${summarizeOlderTurns(older)}` },
        { role: 'assistant', content: 'Got it, I have the context from earlier.' },
        ...lastTurn,
    ];
}


/**
 * Formats retrieved RAG chunks + the question into the LATEST user message
 * only. The system prompt and all earlier messages are never touched, so
 * Ollama can reuse the KV-cache prefix for everything before this turn.
 */
function buildUserContent(message: string, ragContext: string): string {
    if (!ragContext) return message;
    return `Context:\n${ragContext}\n\nQuestion: ${message}`;
}

/**
 * Initialize the AI Tutor service with the correct database path and optional content root.
 */
export function initializeAiTutor(dbPath: string, contentRootPath?: string) {
    getDatabase(dbPath);
    if (contentRootPath) {
        contentRoot = contentRootPath;
        console.log(`[AiTutor] Initialized with content root: ${contentRootPath}`);
    }
}

function getOllamaClient(): Ollama {
    if (!ollama) {
        ollama = new Ollama({ host: 'http://127.0.0.1:11434' });
    }
    return ollama;
}

async function getAvailableOllamaModels(): Promise<string[]> {
    try {
        const client = getOllamaClient();
        const response = await client.list();
        const models = Array.isArray(response?.models) ? response.models : [];
        return models
            .map((model) => typeof model?.name === 'string' ? model.name : '')
            .filter(Boolean);
    } catch (error) {
        console.warn('[AiTutor] Unable to list Ollama models:', error);
        return [];
    }
}

async function pickOllamaModel(): Promise<string> {
    const installedModels = await getAvailableOllamaModels();

    for (const candidate of OLLAMA_MODEL_CANDIDATES) {
        const matches = installedModels.some((modelName) => modelName === candidate || modelName.startsWith(`${candidate}:`));
        if (matches) return candidate;
    }

    if (installedModels.length > 0) return installedModels[0];
    return OLLAMA_MODEL_CANDIDATES[0];
}

// Resolved once (client.list() is a network round-trip) and reused everywhere;
// only re-resolved if a chat call fails with a model-not-found style error.
let resolvedModelName: string | null = null;

async function resolveOllamaModel(): Promise<string> {
    if (resolvedModelName) return resolvedModelName;
    resolvedModelName = await pickOllamaModel();
    return resolvedModelName;
}

function isModelNotFoundError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return /not found|no such model|model.*(does not exist|not exist)/i.test(msg);
}

/** Drops the cached model name so the next call re-resolves it, if the failure looks model-related. */
function invalidateModelCacheOnError(error: unknown): void {
    if (isModelNotFoundError(error)) {
        resolvedModelName = null;
    }
}

/**
 * Preloads the chosen Ollama model into memory so the student's first chat
 * message doesn't pay the (multi-second) cold model-load cost inline.
 * Call once at app startup, same slot as STT/RAG warmup — never in the
 * request path. Records latency under the 'llm.warmup' metric.
 */
export async function warmupOllama(): Promise<void> {
    const model = await resolveOllamaModel();
    await measureLatencyAsync(
        'llm.warmup',
        async () => {
            const client = getOllamaClient();
            const stream = await client.chat({
                model,
                messages: [{ role: 'user', content: 'Hi' }],
                stream: true,
                keep_alive: OLLAMA_KEEP_ALIVE,
                // Must match every other call site so Ollama never reloads the model
                // (a num_ctx change discards warm state + the KV cache).
                options: buildOllamaOptions({
                    num_predict: 8,
                    num_ctx: OLLAMA_NUM_CTX,
                    num_batch: OLLAMA_NUM_BATCH,
                    num_ubatch: OLLAMA_NUM_UBATCH,
                    num_thread: OLLAMA_NUM_THREAD,
                }),
            });
            for await (const _part of stream) { /* drain: just forces the model to load */ }
        },
        { model }
    );
    console.log(`[AiTutor] Ollama model "${model}" warmed up`);
}

function getManifest() {
    if (!contentManifest) {
        // Use the initialized content root, or fall back to the hardcoded shared constant
        contentManifest = loadContentManifest(contentRoot || DATA_PATHS.ROOT);
    }
    return contentManifest;
}

async function getRetrievedContext(message: string): Promise<string> {
    const rag = getRagEngine();
    if (!rag) return '';
    const startedAt = performance.now();
    try {
        // topK/maxContextTokens bound the common "closest fragments" path; when
        // the question names a whole chapter/topic/subtopic, RagEngine.query()
        // instead returns everything in that section under maxSectionTokens,
        // so a student asking about a full chapter gets the full chapter.
        const results = await rag.query(message, { topK: 3, maxContextTokens: 800, maxSectionTokens: 6000 });
        recordLatency({
            metric: 'rag.query',
            durationMs: performance.now() - startedAt,
            success: true,
            metadata: { resultCount: results.length },
        });
        return rag.buildContextBlock(results);
    } catch (error) {
        recordLatency({
            metric: 'rag.query',
            durationMs: performance.now() - startedAt,
            success: false,
        });
        console.warn('[AiTutor] RAG query failed:', error);
        return '';
    }
}

async function generateSessionTitle(sessionId: string, firstMessage: string): Promise<string | null> {
    try {
        const client = getOllamaClient();
        const model = await resolveOllamaModel();
        const messages = [
            {
                role: 'system' as const,
                content: 'You are a helpful assistant. Generate a short, concise title (3-5 words) for a chat session based on the user\'s first message. Do not use quotes or prefixes. Just the title.'
            },
            {
                role: 'user' as const,
                content: firstMessage
            }
        ];
        const stream = await client.chat({
            model,
            keep_alive: OLLAMA_KEEP_ALIVE,
            messages,
            stream: true,
            options: buildOllamaOptions({
                num_predict: TITLE_NUM_PREDICT,
                num_ctx: OLLAMA_NUM_CTX,
                num_batch: OLLAMA_NUM_BATCH,
                num_ubatch: OLLAMA_NUM_UBATCH,
                num_thread: OLLAMA_NUM_THREAD,
            }),
        });

        let title = '';
        for await (const part of stream) title += part.message.content;
        title = title.trim();
        if (title) {
            await updateSessionTitle(sessionId, title);
            return title;
        }
    } catch (error) {
        console.error('Failed to generate session title:', error);
        invalidateModelCacheOnError(error);
    }
    return null;
}

export async function sendMessage(
    studentId: string,
    message: string,
    sessionId: string,
    shouldCancel?: () => boolean,
    onChunk?: (chunk: string) => void,
    onTitleGenerated?: (title: string) => void
): Promise<{ response: string; cancelled: boolean }> {
    console.log('DEBUG: sendMessage arguments:', { studentId, sessionId });
    try {
        const db = getDatabase();
        const client = getOllamaClient();

        // Get session context
        const sessionResult = await db.select().from(aiSessions).where(eq(aiSessions.id, sessionId));
        const session = sessionResult[0];
        if (!session) throw new Error('Session not found');

        // Get student name
        const student = await db.select().from(students).where(eq(students.id, studentId));
        const studentName = student[0]?.name || 'Student';

        // Fetch module title if in tutor mode
        let moduleTitle: string | undefined;
        if (session.mode === 'tutor' && session.moduleId) {
            const manifest = getManifest();
            const module = getModuleById(manifest, session.moduleId);
            if (module) moduleTitle = module.title;
        }

        // Fetch student summary if available
        const summaryRecord = await db.select().from(learningSummaries).where(eq(learningSummaries.studentId, studentId)).orderBy(desc(learningSummaries.lastUpdatedAt)).limit(1);
        const studentSummary = summaryRecord[0]?.summaryText;

        // Build system prompt -- STATIC per session: persona/instructions only,
        // never RAG chunks (those go on the latest user message, see below) so
        // the prefix stays byte-identical across turns for KV-cache reuse.
        const ragContext = await getRetrievedContext(message);
        const systemPrompt = session.mode === 'tutor'
            ? buildSystemPrompt(undefined, moduleTitle, undefined, studentSummary)
            : `You are a course tutor. Answer using ONLY the information in the Context section provided with the question. Do not use outside knowledge, even if you know the answer.

If the Context does not contain enough information to answer, say so directly — do not guess or fill gaps from general knowledge. For example: "I don't see that covered in your course material. Could you rephrase, or ask about a related topic that's in your notes?"

Cite sources using the [n] markers from the Context when giving facts.

Keep answers clear, concise, and appropriate for a student.. ${studentSummary ? `Here is context on the student: ${studentSummary}` : ''}`;

        console.log(`DEBUG: Using systemPrompt for mode ${session.mode}: ${systemPrompt}`);

        // Get recent chat history for this SESSION
        const history = await db
            .select()
            .from(aiChatHistory)
            .where(eq(aiChatHistory.sessionId, sessionId))
            .orderBy(aiChatHistory.timestamp)
            .limit(20);

        const isFirstMessage = history.length === 0;

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt },
            ...buildHistoryMessages(history),
            // RAG chunks are injected only here, on the newest user turn --
            // stored history above (and on the next turn) stays the plain message.
            { role: 'user', content: buildUserContent(message, ragContext) },
        ];

        // Write the full messages array (system prompt + history + user turn) to
        // a dedicated log file so it can be read without console truncation.
        const model = await resolveOllamaModel();
        logLlmPrompt(messages);

        let aiResponse = '';
        let cancelled = false;
        const llmStartedAt = performance.now();

        try {
            if (shouldCancel?.()) {
                return { response: '', cancelled: true };
            }
            // Rare slow-path: a full-chapter RAG hit can exceed OLLAMA_NUM_CTX.
            // This is the only place num_ctx is allowed to vary from the constant.
            const numCtx = needsLargeContext(messages, CHAT_NUM_PREDICT) ? OLLAMA_NUM_CTX_LARGE : OLLAMA_NUM_CTX;
            const result = await ollamaQueue.enqueue(async () => {
                const stream = await client.chat({
                    model,
                    messages,
                    stream: true,
                    keep_alive: OLLAMA_KEEP_ALIVE,
                    options: buildOllamaOptions({
                        num_predict: CHAT_NUM_PREDICT,
                        num_ctx: numCtx,
                        num_batch: OLLAMA_NUM_BATCH,
                        num_ubatch: OLLAMA_NUM_UBATCH,
                        num_thread: OLLAMA_NUM_THREAD,
                    }),
                });

                return consumeOllamaStream(
                    stream,
                    onChunk,
                    () => recordLatency({
                        metric: 'llm.first_token',
                        durationMs: performance.now() - llmStartedAt,
                        success: true,
                        metadata: { model, streaming: true },
                    }),
                    shouldCancel
                );
            }, 'high');
            aiResponse = result.text;
            cancelled = result.cancelled;

            recordLatency({
                metric: 'llm.completion',
                durationMs: performance.now() - llmStartedAt,
                success: true,
                metadata: { model, streaming: Boolean(onChunk), characters: aiResponse.length, cancelled },
            });
            console.log(`[AiTutor] llm.completion totalMs=${Math.round(performance.now() - llmStartedAt)} chars=${aiResponse.length} cancelled=${cancelled}`);
        } catch (error) {
            recordLatency({
                metric: 'llm.completion',
                durationMs: performance.now() - llmStartedAt,
                success: false,
                metadata: { model, streaming: Boolean(onChunk) },
            });
            invalidateModelCacheOnError(error);
            throw error;
        }

        if (cancelled) {
            aiResponse = aiResponse.trim();
            if (aiResponse.length > 0) {
                aiResponse += '\n\n*(response stopped)*';
            } else {
                aiResponse = '*(response stopped)*';
            }
        }

        const now = new Date().toISOString();

        // Save messages and update session
        await db.transaction(async (tx) => {
            await tx.insert(aiChatHistory).values({
                id: randomUUID(),
                sessionId,
                role: 'user',
                content: message,
                timestamp: now,
            });

            if (aiResponse) {
                await tx.insert(aiChatHistory).values({
                    id: randomUUID(),
                    sessionId,
                    role: 'assistant',
                    content: aiResponse,
                    timestamp: now,
                });
            }

            await tx.update(aiSessions)
                .set({ lastMessageAt: now })
                .where(eq(aiSessions.id, sessionId));
        });

        if (isFirstMessage) {
            void ollamaQueue.enqueue(async () => {
                const title = await generateSessionTitle(sessionId, message);
                if (title && onTitleGenerated) {
                    onTitleGenerated(title);
                }
            }, 'low');
        }

        return { response: aiResponse, cancelled };
    } catch (error) {
        console.error('AI Tutor error:', error);
        return {
            response: "I'm sorry, I'm currently unavailable. Please make sure Ollama is running locally.",
            cancelled: false,
        };
    }
}

// =============================
// Sentence-boundary streaming
// =============================

/**
 * Split accumulated text into complete sentences for TTS.
 *
 * Rules:
 *  - Split on [.!?] when followed by a space + uppercase letter (new sentence)
 *  - Split on [.!?] at end of string
 *  - Do NOT split on "1. " "2. " (numbered lists) — those get stripped in TTS layer anyway
 *  - Minimum 10 chars to avoid tiny garbage fragments
 */
function extractSentences(buffer: string): { sentences: string[]; remainder: string } {
    const sentences: string[] = [];

    // Matches: sentence-ending punctuation followed by whitespace+uppercase (next sentence)
    // Uses a lookahead so we don't consume the uppercase char
    const sentenceEndRegex = /[.!?](?=\s+[A-Z]|\s*$)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = sentenceEndRegex.exec(buffer)) !== null) {
        const end = match.index + match[0].length;
        const sentence = buffer.substring(lastIndex, end).trim();
        if (sentence.length >= 10) {
            sentences.push(sentence);
        }
        lastIndex = end;
        // Skip whitespace after the sentence end
        while (lastIndex < buffer.length && /\s/.test(buffer[lastIndex])) {
            lastIndex++;
        }
        sentenceEndRegex.lastIndex = lastIndex;
    }

    const remainder = buffer.substring(lastIndex).trim();
    return { sentences, remainder };
}

/**
 * Send a voice message — streams from Ollama and fires onSentence at each
 * sentence boundary so TTS can synthesize in parallel.
 * Uses the concise voice system prompt.
 */
export async function sendVoiceMessage(
    studentId: string,
    message: string,
    sessionId: string,
    onSentence: (sentence: string) => void,
    onChunk?: (chunk: string) => void,
    onTitleGenerated?: (title: string) => void
): Promise<string> {
    console.log('DEBUG: sendVoiceMessage arguments:', { studentId, sessionId });
    try {
        const db = getDatabase();
        const client = getOllamaClient();

        // Get session context
        const sessionResult = await db.select().from(aiSessions).where(eq(aiSessions.id, sessionId));
        const session = sessionResult[0];
        if (!session) throw new Error('Session not found');

        // Get student name
        const student = await db.select().from(students).where(eq(students.id, studentId));
        const studentName = student[0]?.name || 'Student';

        // Fetch module title if in tutor mode
        let moduleTitle: string | undefined;
        if (session.mode === 'tutor' && session.moduleId) {
            const manifest = getManifest();
            const module = getModuleById(manifest, session.moduleId);
            if (module) moduleTitle = module.title;
        }

        // Fetch student summary
        const summaryRecord = await db.select().from(learningSummaries).where(eq(learningSummaries.studentId, studentId)).orderBy(desc(learningSummaries.lastUpdatedAt)).limit(1);
        const studentSummary = summaryRecord[0]?.summaryText;

        // Use concise voice prompt -- STATIC per session, RAG goes on the user message only.
        const ragContext = await getRetrievedContext(message);
        const systemPrompt = buildVoiceSystemPrompt(undefined, moduleTitle, undefined, studentSummary);

        // Get recent chat history for this SESSION
        const history = await db
            .select()
            .from(aiChatHistory)
            .where(eq(aiChatHistory.sessionId, sessionId))
            .orderBy(aiChatHistory.timestamp)
            .limit(50);

        const isFirstMessage = history.length === 0;

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: 'system', content: systemPrompt },
            ...buildHistoryMessages(history),
            { role: 'user', content: buildUserContent(message, ragContext) },
        ];

        let aiResponse = '';
        let sentenceBuffer = '';
        const model = await resolveOllamaModel();

        // Write the full messages array to the prompt log file.
        logLlmPrompt(messages);

        const llmStartedAt = performance.now();
        let firstTokenRecorded = false;

        try {
            // Rare slow-path: a full-chapter RAG hit can exceed OLLAMA_NUM_CTX.
            const numCtx = needsLargeContext(messages, VOICE_NUM_PREDICT) ? OLLAMA_NUM_CTX_LARGE : OLLAMA_NUM_CTX;
            aiResponse = await ollamaQueue.enqueue(async () => {
                const stream = await client.chat({
                    model,
                    messages,
                    stream: true,
                    keep_alive: OLLAMA_KEEP_ALIVE,
                    options: buildOllamaOptions({
                        num_predict: VOICE_NUM_PREDICT,
                        num_ctx: numCtx,
                        num_batch: OLLAMA_NUM_BATCH,
                        num_ubatch: OLLAMA_NUM_UBATCH,
                        num_thread: OLLAMA_NUM_THREAD,
                    }),
                });

                let response = '';
                for await (const part of stream) {
                    const chunk = part.message.content;
                    if (!firstTokenRecorded && chunk) {
                        firstTokenRecorded = true;
                        recordLatency({
                            metric: 'llm.first_token',
                            durationMs: performance.now() - llmStartedAt,
                            success: true,
                            metadata: { model, streaming: true, voice: true },
                        });
                    }
                    response += chunk;
                    sentenceBuffer += chunk;

                    if (onChunk) onChunk(chunk);

                    // Check for complete sentences
                    const { sentences, remainder } = extractSentences(sentenceBuffer);
                    for (const sentence of sentences) {
                        onSentence(sentence);
                    }
                    sentenceBuffer = remainder;
                }
                return response;
            }, 'high');

            recordLatency({
                metric: 'llm.completion',
                durationMs: performance.now() - llmStartedAt,
                success: true,
                metadata: { model, streaming: true, voice: true, characters: aiResponse.length },
            });
        } catch (error) {
            recordLatency({
                metric: 'llm.completion',
                durationMs: performance.now() - llmStartedAt,
                success: false,
                metadata: { model, streaming: true, voice: true },
            });
            invalidateModelCacheOnError(error);
            throw error;
        }

        // Flush any remaining text as the final sentence
        if (sentenceBuffer.trim().length > 0) {
            onSentence(sentenceBuffer.trim());
        }

        const now = new Date().toISOString();

        // Save messages and update session
        await db.transaction(async (tx) => {
            await tx.insert(aiChatHistory).values({
                id: randomUUID(),
                sessionId,
                role: 'user',
                content: message,
                timestamp: now,
            });

            await tx.insert(aiChatHistory).values({
                id: randomUUID(),
                sessionId,
                role: 'assistant',
                content: aiResponse,
                timestamp: now,
            });

            await tx.update(aiSessions)
                .set({ lastMessageAt: now })
                .where(eq(aiSessions.id, sessionId));
        });

        if (isFirstMessage) {
            void ollamaQueue.enqueue(async () => {
                const title = await generateSessionTitle(sessionId, message);
                if (title && onTitleGenerated) {
                    onTitleGenerated(title);
                }
            }, 'low');
        }

        return aiResponse;
    } catch (error) {
        console.error('AI Tutor voice error:', error);
        return "I'm sorry, I'm currently unavailable. Please make sure Ollama is running.";
    }
}

export async function getSessions(studentId: string) {
    return await getDatabase()
        .select()
        .from(aiSessions)
        .where(eq(aiSessions.studentId, studentId))
        .orderBy(aiSessions.lastMessageAt);
}

export async function createSession(
    studentId: string,
    title: string,
    mode: 'tutor' | 'chat',
    moduleId?: string
) {
    const id = randomUUID();
    const now = new Date().toISOString();
    await getDatabase().insert(aiSessions).values({
        id,
        studentId,
        title,
        mode,
        moduleId,
        createdAt: now,
        lastMessageAt: now,
    });

    // Initial AI greeting if it's a new chat
    // We could add a default message here or let the frontend do it.

    return await getDatabase().select().from(aiSessions).where(eq(aiSessions.id, id)).then(res => res[0]);
}

export async function deleteSession(sessionId: string) {
    await getDatabase().delete(aiSessions).where(eq(aiSessions.id, sessionId));
}

export async function updateSessionTitle(sessionId: string, title: string) {
    await getDatabase()
        .update(aiSessions)
        .set({ title })
        .where(eq(aiSessions.id, sessionId));
}

export async function getSessionHistory(sessionId: string) {
    return await getDatabase()
        .select()
        .from(aiChatHistory)
        .where(eq(aiChatHistory.sessionId, sessionId))
        .orderBy(aiChatHistory.timestamp);
}

export async function clearChatHistory(studentId: string): Promise<void> {
    // This now deletes all sessions for the student which cascades to history
    await getDatabase().delete(aiSessions).where(eq(aiSessions.studentId, studentId));
}

/**
 * Check if Ollama is available
 */
export async function isOllamaAvailable(): Promise<boolean> {
    try {
        const client = getOllamaClient();
        await client.list(); // Simple ping to check if Ollama is running
        return true;
    } catch {
        return false;
    }
}

export async function generateLearningSummary(
    studentId: string,
    previousSummary?: string,
    dbPath?: string
): Promise<{ summary: string; progressNote?: string }> {
    const db = getDatabase(dbPath);
    const client = getOllamaClient();
    const model = await resolveOllamaModel();

    // 1. Fetch all chat history for this student (across all sessions)
    const sessions = await db.select().from(aiSessions).where(eq(aiSessions.studentId, studentId));
    const sessionIds = sessions.map((s) => s.id);

    let chatContext = '';
    if (sessionIds.length > 0) {
        const history = await db
            .select()
            .from(aiChatHistory)
            .where(inArray(aiChatHistory.sessionId, sessionIds))
            .orderBy(aiChatHistory.timestamp);

        // Take last 50 messages to avoid context window issues
        const recentHistory = history.slice(-50);
        chatContext = recentHistory
            .map((h) => `${h.role === 'user' ? 'Student' : 'AI'}: ${h.content}`)
            .join('\n');
    }

    if (!chatContext) {
        return { summary: "No chat history available to generate a summary." };
    }

    // 2. Generate Summary (<300 words)
    const summaryResponse = await ollamaQueue.enqueue(() => client.chat({
        model,
        keep_alive: isLowEndDevice() ? 0 : '5m', // Unload immediately logic on low-end
        messages: [
            {
                role: 'system',
                content: 'You are an educational psychologist. Analyze the student\'s chat history and provide a concise learning summary (< 300 words). Focus on what they have learned, their strengths, and areas where they needed help. Use a supportive tone.'
            },
            { role: 'user', content: `Chat History:\n${chatContext}` }
        ]
    }), 'low');

    const summary = summaryResponse.message.content.trim();

    // 3. Generate Progress Note if previous summary exists (<100 words)
    let progressNote: string | undefined;
    if (previousSummary) {
        const progressResponse = await ollamaQueue.enqueue(() => client.chat({
            model,
            keep_alive: isLowEndDevice() ? 0 : '5m', // Unload immediately on low-end
            messages: [
                {
                    role: 'system',
                    content: 'You are an educational psychologist. Compare the NEW learning summary with the PREVIOUS one. Write a very brief note (< 100 words) highlighting the progress made or new topics covered. Be specific.'
                },
                {
                    role: 'user',
                    content: `PREVIOUS SUMMARY: ${previousSummary}\n\nNEW SUMMARY: ${summary}`
                }
            ]
        }), 'low');
        progressNote = progressResponse.message.content.trim();
    }

    return { summary, progressNote };
}

export * from './prompts.js';
