import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@afe/shared';

// Backend services
import {
    createStudent,
    getAllStudents,
    getStudentById,
    updateStudentLastActive,
    generateUniqueUsername,
    updateVideoProgress,
    getVideoProgress,
    getAllVideoProgressForStudent,
    submitQuizAttempt,
    getQuizAttempts,
    getBestQuizScore,
    markModuleStarted,
    getStartedModules,
    updateReadingProgress,
    getReadingProgress,
    getAllReadingProgressForStudent,
} from '@backend/db';
import { trackEvent, getAnalyticsSummary } from '@backend/analytics';
import {
    sendMessage,
    sendVoiceMessage,
    getSessions,
    createSession,
    deleteSession,
    getSessionHistory,
    clearChatHistory
} from '@backend/ai-tutor';
import { loadContentManifest, getModuleById, getLessonById } from '@backend/content-engine';

import {
    pushAudioChunk,
    processAudio,
    resetAudio
} from "@backend/stt-engine";

import {
    speak as ttsSpeak,
    stop as ttsStop,
    isAvailable as ttsIsAvailable
} from "@backend/tts-engine";
// Content manifest (loaded once)
let contentManifest: ReturnType<typeof loadContentManifest> | null = null;

import path from 'path';
import fs from 'fs';
import { PATHS, APP_DATA_ROOT } from '../main/paths.js';
import { getMp4Duration } from '../main/mp4-parser.js';
import { SessionManager } from '../main/session-manager.js';

function getManifest() {
    if (!contentManifest) {
        contentManifest = loadContentManifest(APP_DATA_ROOT);
        console.log('Manifest loaded from:', APP_DATA_ROOT);
    }
    return contentManifest;
}

let sttInterval: NodeJS.Timeout | null = null;
let isRecording = false;

/**
 * Register all IPC handlers
 * Each handler maps to a backend service function
 */
export function registerIPCHandlers() {
    // ========== Student Operations ==========

    ipcMain.handle(IPC_CHANNELS.STUDENT_CREATE, async (_event, data) => {
        const { name, avatar, grade } = data;
        return await createStudent(name, avatar, grade);
    });

    ipcMain.handle(IPC_CHANNELS.STUDENT_GET_ALL, async () => {
        return await getAllStudents();
    });

    ipcMain.handle(IPC_CHANNELS.STUDENT_GET_BY_ID, async (_event, data) => {
        const { studentId } = data;
        return await getStudentById(studentId);
    });

    ipcMain.handle(IPC_CHANNELS.STUDENT_UPDATE_LAST_ACTIVE, async (_event, data) => {
        const { studentId } = data;
        await updateStudentLastActive(studentId);
    });

    ipcMain.handle(IPC_CHANNELS.STUDENT_GENERATE_USERNAME, async (_event, data) => {
        const { avatarName } = data;
        return await generateUniqueUsername(avatarName);
    });

    // ========== Content Operations ==========

    ipcMain.handle(IPC_CHANNELS.CONTENT_GET_MODULES, async () => {
        const manifest = getManifest();
        return manifest.modules;
    });

    ipcMain.handle(IPC_CHANNELS.CONTENT_GET_MODULE_BY_ID, async (_event, data) => {
        const { moduleId } = data;
        const manifest = getManifest();
        return getModuleById(manifest, moduleId);
    });

    ipcMain.handle(IPC_CHANNELS.CONTENT_GET_LESSON_BY_ID, async (_event, data) => {
        const { lessonId } = data;
        const manifest = getManifest();
        return getLessonById(manifest, lessonId);
    });

    ipcMain.handle(IPC_CHANNELS.CONTENT_GET_VIDEO_METADATA, async (_event, data) => {
        const { videoUrl } = data;
        try {
            const absolutePath = path.join(PATHS.ROOT, videoUrl);
            if (!fs.existsSync(absolutePath)) {
                return null;
            }
            const duration = getMp4Duration(absolutePath);
            const stats = fs.statSync(absolutePath);
            return {
                duration,
                size: stats.size
            };
        } catch (error) {
            console.error('[IPC] Failed to get video metadata:', error);
            return null;
        }
    });

    // ========== Progress Tracking ==========

    ipcMain.handle(IPC_CHANNELS.PROGRESS_UPDATE_VIDEO, async (_event, data) => {
        const { studentId, lessonId, watchedPercentage, watchDuration, watchedSegments, lastPosition, completed } = data;
        
        // Track watch duration in session
        SessionManager.recordWatchDuration(watchDuration);

        await updateVideoProgress(
            studentId,
            lessonId,
            watchedPercentage,
            watchDuration,
            watchedSegments,
            lastPosition,
            completed
        );

        // Track analytics event
        await trackEvent(studentId, 'video_watched', {
            lessonId,
            watchDuration,
            watchedPercentage,
            lastPosition,
            completed,
        });
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_VIDEO, async (_event, data) => {
        const { studentId, lessonId } = data;
        return await getVideoProgress(studentId, lessonId);
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_ALL_FOR_STUDENT, async (_event, data) => {
        const { studentId } = data;
        return await getAllVideoProgressForStudent(studentId);
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_MARK_MODULE_STARTED, async (_event, data) => {
        const { studentId, moduleId } = data;
        await markModuleStarted(studentId, moduleId);

        // Track analytics
        await trackEvent(studentId, 'module_started', {
            moduleId,
        });
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_STARTED_MODULES, async (_event, data) => {
        const { studentId } = data;
        return await getStartedModules(studentId);
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_UPDATE_READING, async (_event, data) => {
        const { studentId, lessonId, readPercentage, readDuration, currentPage } = data;
        console.log(`[IPC] Updating reading progress: Student=${studentId}, Lesson=${lessonId}, Duration=+${readDuration}s`);
        await updateReadingProgress(studentId, lessonId, readPercentage, readDuration, currentPage);

        // Track analytics event
        await trackEvent(studentId, 'pdf_read', {
            lessonId,
            readDuration,
        });
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_READING, async (_event, data) => {
        const { studentId, lessonId } = data;
        return await getReadingProgress(studentId, lessonId);
    });

    ipcMain.handle(IPC_CHANNELS.PROGRESS_GET_ALL_READING, async (_event, data) => {
        const { studentId } = data;
        return await getAllReadingProgressForStudent(studentId);
    });

    // ========== Quiz Operations ==========

    ipcMain.handle(IPC_CHANNELS.QUIZ_SUBMIT_ATTEMPT, async (_event, data) => {
        const { studentId, lessonId, answers, timeTaken } = data;

        // Get lesson data to validate answers
        const manifest = getManifest();
        const lesson = getLessonById(manifest, lessonId);

        if (!lesson || !lesson.quizData) {
            throw new Error('Quiz not found');
        }

        // Calculate score
        const gradedAnswers = answers.map((answer: any) => {
            const question = lesson.quizData!.questions.find((q: any) => (q as any).id === answer.questionId);
            const isCorrect = question ? (question as any).correctAnswerIndex === answer.selectedAnswerIndex : false;

            return {
                ...answer,
                isCorrect,
            };
        });

        const score = gradedAnswers.filter((a: any) => a.isCorrect).length;
        const totalQuestions = lesson.quizData.questions.length;

        // Submit attempt
        const attempt = await submitQuizAttempt(
            studentId,
            lessonId,
            score,
            totalQuestions,
            gradedAnswers,
            timeTaken
        );

        // Track analytics
        await trackEvent(studentId, 'quiz_completed', {
            lessonId,
            score,
            totalQuestions,
            percentage: (score / totalQuestions) * 100,
        });

        return attempt;
    });

    ipcMain.handle(IPC_CHANNELS.QUIZ_GET_ATTEMPTS, async (_event, data) => {
        const { studentId, lessonId } = data;
        return await getQuizAttempts(studentId, lessonId);
    });

    ipcMain.handle(IPC_CHANNELS.QUIZ_GET_BEST_SCORE, async (_event, data) => {
        const { studentId, lessonId } = data;
        return await getBestQuizScore(studentId, lessonId);
    });

    // ========== Analytics ==========

    ipcMain.handle(IPC_CHANNELS.ANALYTICS_TRACK_EVENT, async (_event, data) => {
        const { studentId, eventType, metadata } = data;
        await trackEvent(studentId, eventType as any, metadata);
    });

    ipcMain.handle(IPC_CHANNELS.ANALYTICS_GET_SUMMARY, async (_event, data) => {
        const { studentId } = data;
        return await getAnalyticsSummary(studentId);
    });

    // ========== Session Tracking ==========

    ipcMain.handle('session:start', async (_event, data) => {
        const { studentId } = data;
        SessionManager.startSession(studentId);
    });

    ipcMain.handle('session:end', async (_event, data) => {
        const { csat, itp } = data;
        await SessionManager.endSession(csat, itp);
    });

    ipcMain.handle('session:pause', async () => {
        SessionManager.recordPause();
    });

    ipcMain.handle('session:seek', async () => {
        SessionManager.recordSeek();
    });

    ipcMain.handle('session:speed', async (_event, data) => {
        const { speed } = data;
        SessionManager.recordPlaybackSpeed(speed);
    });

    ipcMain.handle('session:updateLanguage', async (_event, data) => {
        const { language } = data;
        SessionManager.updateLanguage(language);
    });

    // ========== AI Tutor ==========
    const aiCancelFlags = new Map<string, boolean>();

    ipcMain.handle(IPC_CHANNELS.AI_SEND_MESSAGE, async (event, data) => {
        const { studentId, message, sessionId, requestId } = data;
        console.log('DEBUG: IPC AI_SEND_MESSAGE received:', { studentId, sessionId });

        aiCancelFlags.set(requestId, false);

        const result = await sendMessage(
            studentId,
            message,
            sessionId,
            () => aiCancelFlags.get(requestId) === true,
            (chunk) => {
                event.sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, { chunk });
            },
            (title) => {
                event.sender.send(IPC_CHANNELS.AI_SESSION_UPDATED, { sessionId, title });
            }
        );
        aiCancelFlags.delete(requestId);
        return result;
    });

    ipcMain.handle(IPC_CHANNELS.AI_CANCEL_MESSAGE, async (_event, data) => {
        const { requestId } = data;
        if (!requestId) return { cancelled: false };
        aiCancelFlags.set(requestId, true);
        return { cancelled: true };
    });

    ipcMain.handle(IPC_CHANNELS.AI_SESSION_GET_ALL, async (_event, data) => {
        const { studentId } = data;
        return await getSessions(studentId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_SESSION_CREATE, async (_event, data) => {
        const { studentId, title, mode, moduleId } = data;
        return await createSession(studentId, title, mode, moduleId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_SESSION_DELETE, async (_event, data) => {
        const { sessionId } = data;
        await deleteSession(sessionId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_GET_SESSION_HISTORY, async (_event, data) => {
        const { sessionId } = data;
        return await getSessionHistory(sessionId);
    });

    ipcMain.handle(IPC_CHANNELS.AI_CLEAR_HISTORY, async (_event, data) => {
        const { studentId } = data;
        await clearChatHistory(studentId);
    });


    // ========== Voice Pipeline (Near RT STS) ==========

    /**
     * Strip markdown formatting from text before sending to TTS.
     * Piper speaks asterisks and hashes literally, which sounds terrible.
     */
    function stripMarkdownForTTS(text: string): string {
        return text
            .replace(/\*\*([^*]*)\*\*/g, '$1')   // **bold** → bold
            .replace(/\*([^*]*)\*/g, '$1')         // *italic* → italic
            .replace(/^\s*\d+[.)]\s+/gm, '')       // 1. or 1) list → remove
            .replace(/^\s*[-*•]\s+/gm, '')          // - bullet → remove
            .replace(/#{1,6}\s+/g, '')              // ## heading → remove
            .replace(/`([^`]*)`/g, '$1')            // `code` → code
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url) → text
            .replace(/\s+/g, ' ')
            .trim();
    }

    ipcMain.handle(IPC_CHANNELS.AI_VOICE_MESSAGE, async (event, data) => {
        const { studentId, message, sessionId } = data;
        console.log('DEBUG: IPC AI_VOICE_MESSAGE received:', { studentId, sessionId });

        // Sequential TTS queue: synthesize ONE sentence at a time to avoid
        // resource contention (each Piper loads the 63MB ONNX model).
        // Playback of sentence N overlaps with synthesis of sentence N+1.
        let sentenceIndex = 0;
        const ttsPromiseChain: Promise<void>[] = [];
        let previousPromise: Promise<void> = Promise.resolve();

        const response = await sendVoiceMessage(
            studentId,
            message,
            sessionId,
            (rawSentence) => {
                const idx = sentenceIndex++;
                // Strip markdown BEFORE sending to Piper
                const sentence = stripMarkdownForTTS(rawSentence);
                if (!sentence) return; // Skip empty sentences after stripping

                console.log(`[Voice] Sentence ${idx}: "${sentence.substring(0, 50)}"`);

                // Chain: start Piper only AFTER previous sentence's audio is sent.
                // This means only one Piper process at a time → no resource contention.
                // Sentence N's playback (in renderer) overlaps N+1's synthesis here.
                const waitForPrevious = previousPromise;
                const orderedSend = waitForPrevious.then(async () => {
                    try {
                        const audioBuffer = await ttsSpeak(sentence);
                        if (audioBuffer) {
                            const base64 = audioBuffer.toString('base64');
                            event.sender.send(IPC_CHANNELS.TTS_SENTENCE_READY, {
                                audio: base64,
                                index: idx,
                                text: sentence,
                            });
                        }
                    } catch (err) {
                        console.error(`[Voice] TTS failed for sentence ${idx}:`, err);
                    }
                });

                previousPromise = orderedSend;
                ttsPromiseChain.push(orderedSend);
            },
            (chunk) => {
                event.sender.send(IPC_CHANNELS.AI_STREAM_CHUNK, { chunk });
            },
            (title) => {
                event.sender.send(IPC_CHANNELS.AI_SESSION_UPDATED, { sessionId, title });
            }
        );

        // Wait for all TTS synthesis/sends to complete before signaling done
        await Promise.all(ttsPromiseChain);
        event.sender.send(IPC_CHANNELS.AI_VOICE_DONE, {});

        return { response };
    });



    // ===============================
    // STT (Speech-To-Text) Handlers
    // ===============================

    // ---------- STT START ------- ---
    ipcMain.on(IPC_CHANNELS.STT_START, () => {
        if (isRecording) {
            console.warn('[IPC] STT_START ignored (already recording)');
            return;
        }

        console.log('[IPC] STT_START received');
        resetAudio();
        isRecording = true;
    });


    // ---------- STT CHUNK ----------
    ipcMain.on(IPC_CHANNELS.STT_CHUNK, (_event, chunk: ArrayBuffer) => {
        if (!isRecording) {
            console.warn('[IPC] STT_CHUNK ignored (not recording)');
            return;
        }

        if (!chunk) {
            console.warn('[IPC] STT_CHUNK received empty chunk');
            return;
        }

        try {
            pushAudioChunk(Buffer.from(chunk));
        } catch (error) {
            console.error('[IPC] Error pushing audio chunk:', error);
        }
    });


    // ---------- STT STOP ----------
    ipcMain.on(IPC_CHANNELS.STT_STOP, async (event) => {
        if (!isRecording) {
            console.warn('[IPC] STT_STOP ignored (not recording)');
            return;
        }

        console.log('[IPC] STT_STOP received');
        isRecording = false;

        try {
            // Prevent blocking event loop starvation
            const result = await processAudio();

            resetAudio();

            if (result && result.trim().length > 0) {
                console.log('[IPC] Sending STT_FINAL result');
                event.reply(IPC_CHANNELS.STT_FINAL, result.trim());
            } else {
                console.log('[IPC] No transcript generated');
                event.reply(IPC_CHANNELS.STT_FINAL, '');
            }

        } catch (error) {
            console.error('[IPC] STT processing failed:', error);
            event.reply(IPC_CHANNELS.STT_FINAL, '');
            resetAudio();
        }
    });



    // ===============================
    // TTS (Text-To-Speech) Handlers
    // ===============================

    ipcMain.handle(IPC_CHANNELS.TTS_SPEAK, async (_event, data) => {
        const { text } = data;
        console.log('[IPC] TTS_SPEAK received:', text?.substring(0, 50));
        try {
            const audioBuffer = await ttsSpeak(text);
            if (audioBuffer) {
                // Convert Node Buffer to base64 string for reliable IPC transfer
                // (raw ArrayBuffer gets corrupted during Electron's structured clone across context bridge)
                const base64 = audioBuffer.toString('base64');
                return { audio: base64, fallback: false };
            }
            return { audio: null, fallback: true };
        } catch (error) {
            console.error('[IPC] TTS_SPEAK error:', error);
            return { audio: null, fallback: true };
        }
    });

    ipcMain.handle(IPC_CHANNELS.TTS_STOP, async () => {
        console.log('[IPC] TTS_STOP received');
        ttsStop();
    });

    ipcMain.handle(IPC_CHANNELS.TTS_STATUS, async () => {
        return { available: ttsIsAvailable() };
    });


    console.log('✓ All IPC handlers registered');
}
