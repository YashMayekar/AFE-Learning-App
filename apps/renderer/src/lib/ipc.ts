// Type-safe IPC client wrapper for renderer
// Uses window.electronAPI from preload (NO direct backend imports)

import { IPC_CHANNELS, type IPCContract } from '@afe/shared';

class IPCClient {
    private async invoke<K extends keyof IPCContract>(
        channel: K,
        data: IPCContract[K]['request']
    ): Promise<IPCContract[K]['response']> {
        if (!window.electronAPI) {
            throw new Error('Electron API not available');
        }

        return await window.electronAPI.invoke(channel, data);
    }

    // Students
    async createStudent(name: string, avatar: string) {
        return await this.invoke(IPC_CHANNELS.STUDENT_CREATE, { name, avatar });
    }

    async getAllStudents() {
        return await this.invoke(IPC_CHANNELS.STUDENT_GET_ALL, undefined);
    }

    async getStudentById(studentId: string) {
        return await this.invoke(IPC_CHANNELS.STUDENT_GET_BY_ID, { studentId });
    }

    async updateStudentLastActive(studentId: string) {
        return await this.invoke(IPC_CHANNELS.STUDENT_UPDATE_LAST_ACTIVE, { studentId });
    }

    async generateUniqueUsername(avatarName: string) {
        return await this.invoke(IPC_CHANNELS.STUDENT_GENERATE_USERNAME, { avatarName });
    }

    // Content
    async getModules() {
        return await this.invoke(IPC_CHANNELS.CONTENT_GET_MODULES, undefined);
    }

    async getModuleById(moduleId: string) {
        return await this.invoke(IPC_CHANNELS.CONTENT_GET_MODULE_BY_ID, { moduleId });
    }

    async getLessonById(lessonId: string) {
        return await this.invoke(IPC_CHANNELS.CONTENT_GET_LESSON_BY_ID, { lessonId });
    }

    // Progress
    async updateVideoProgress(
        studentId: string,
        lessonId: string,
        watchedPercentage: number,
        watchDuration: number
    ) {
        return await this.invoke(IPC_CHANNELS.PROGRESS_UPDATE_VIDEO, {
            studentId,
            lessonId,
            watchedPercentage,
            watchDuration,
        });
    }

    async getVideoProgress(studentId: string, lessonId: string) {
        return await this.invoke(IPC_CHANNELS.PROGRESS_GET_VIDEO, { studentId, lessonId });
    }

    async getAllProgressForStudent(studentId: string) {
        return await this.invoke(IPC_CHANNELS.PROGRESS_GET_ALL_FOR_STUDENT, { studentId });
    }

    async markModuleStarted(studentId: string, moduleId: string) {
        return await this.invoke(IPC_CHANNELS.PROGRESS_MARK_MODULE_STARTED, { studentId, moduleId });
    }

    async getStartedModules(studentId: string) {
        return await this.invoke(IPC_CHANNELS.PROGRESS_GET_STARTED_MODULES, { studentId });
    }

    async updateReadingProgress(
        studentId: string,
        lessonId: string,
        readPercentage: number,
        readDuration: number,
        currentPage: number
    ) {
        return await this.invoke(IPC_CHANNELS.PROGRESS_UPDATE_READING, {
            studentId,
            lessonId,
            readPercentage,
            readDuration,
            currentPage,
        });
    }

    async getReadingProgress(studentId: string, lessonId: string) {
        return await this.invoke(IPC_CHANNELS.PROGRESS_GET_READING, { studentId, lessonId });
    }

    async getAllReadingProgress(studentId: string) {
        return await this.invoke(IPC_CHANNELS.PROGRESS_GET_ALL_READING, { studentId });
    }

    // Quizzes
    async submitQuizAttempt(
        studentId: string,
        lessonId: string,
        answers: Array<{ questionId: string; selectedAnswerIndex: number }>,
        timeTaken: number
    ) {
        return await this.invoke(IPC_CHANNELS.QUIZ_SUBMIT_ATTEMPT, {
            studentId,
            lessonId,
            answers,
            timeTaken,
        });
    }

    async getQuizAttempts(studentId: string, lessonId: string) {
        return await this.invoke(IPC_CHANNELS.QUIZ_GET_ATTEMPTS, { studentId, lessonId });
    }

    async getBestQuizScore(studentId: string, lessonId: string) {
        return await this.invoke(IPC_CHANNELS.QUIZ_GET_BEST_SCORE, { studentId, lessonId });
    }

    // Analytics
    async trackEvent(studentId: string, eventType: string, metadata: Record<string, unknown>) {
        return await this.invoke(IPC_CHANNELS.ANALYTICS_TRACK_EVENT, {
            studentId,
            eventType,
            metadata,
        });
    }

    async getAnalyticsSummary(studentId: string) {
        return await this.invoke(IPC_CHANNELS.ANALYTICS_GET_SUMMARY, { studentId });
    }

    // AI Tutor
    async sendAIMessage(studentId: string, message: string, sessionId: string, requestId?: string) {
        const resolvedRequestId = requestId || globalThis.crypto?.randomUUID?.() || Date.now().toString();
        return await this.invoke(IPC_CHANNELS.AI_SEND_MESSAGE, {
            studentId,
            message,
            sessionId,
            requestId: resolvedRequestId,
        });
    }

    async cancelAIMessage(requestId: string) {
        return await this.invoke(IPC_CHANNELS.AI_CANCEL_MESSAGE, { requestId });
    }

    async getAISessions(studentId: string) {
        return await this.invoke(IPC_CHANNELS.AI_SESSION_GET_ALL, { studentId });
    }

    async createAISession(studentId: string, title: string, mode: 'tutor' | 'chat', moduleId?: string) {
        return await this.invoke(IPC_CHANNELS.AI_SESSION_CREATE, { studentId, title, mode, moduleId });
    }

    async deleteAISession(sessionId: string) {
        return await this.invoke(IPC_CHANNELS.AI_SESSION_DELETE, { sessionId });
    }

    async getAISessionHistory(sessionId: string) {
        return await this.invoke(IPC_CHANNELS.AI_GET_SESSION_HISTORY, { sessionId });
    }

    async clearAIHistory(studentId: string) {
        return await this.invoke(IPC_CHANNELS.AI_CLEAR_HISTORY, { studentId });
    }

    onAIStreamChunk(callback: (chunk: string) => void) {
        if (!window.electronAPI?.on) return () => { };
        return window.electronAPI.on(IPC_CHANNELS.AI_STREAM_CHUNK, (data: { chunk: string }) => {
            callback(data.chunk);
        });
    }

    // Voice pipeline
    async sendAIVoiceMessage(studentId: string, message: string, sessionId: string) {
        return await this.invoke(IPC_CHANNELS.AI_VOICE_MESSAGE, {
            studentId,
            message,
            sessionId,
        });
    }

    onTTSSentenceReady(callback: (data: { audio: string; index: number; text: string }) => void) {
        if (!window.electronAPI?.on) return () => { };
        return window.electronAPI.on(IPC_CHANNELS.TTS_SENTENCE_READY, callback);
    }

    onAIVoiceDone(callback: () => void) {
        if (!window.electronAPI?.on) return () => { };
        return window.electronAPI.on(IPC_CHANNELS.AI_VOICE_DONE, callback);
    }


    onSessionUpdated(callback: (sessionId: string, title: string) => void) {
        if (!window.electronAPI?.on) return () => { };
        return window.electronAPI.on(IPC_CHANNELS.AI_SESSION_UPDATED, (data: { sessionId: string; title: string }) => {
            callback(data.sessionId, data.title);
        });
    }

    // STT
    // STT
    startSTT() {
        if (!window.electronAPI?.stt) {
            throw new Error("STT API not available");
        }
        window.electronAPI.stt.start();
    }

    sendSTTAudioChunk(chunk: ArrayBuffer) {
        if (!window.electronAPI?.stt) return;
        window.electronAPI.stt.sendChunk(chunk);
    }

    stopSTT() {
        if (!window.electronAPI?.stt) return;
        window.electronAPI.stt.stop();
    }

    onSTTPartialResult(callback: (text: string) => void) {
        if (!window.electronAPI?.stt) {
            return () => { };
        }
        return window.electronAPI.stt.onPartial(callback);
    }

    onSTTFinalResult(callback: (text: string) => void) {
        if (!window.electronAPI?.stt) {
            return () => { };
        }
        return window.electronAPI.stt.onFinal(callback);
    }

    // TTS
    async speakTTS(text: string): Promise<{ audio: string | null; fallback: boolean }> {
        if (!window.electronAPI?.tts) {
            return { audio: null, fallback: true };
        }
        // Audio is returned as base64 string from main process for reliable IPC transfer
        return await window.electronAPI.tts.speak(text) as unknown as { audio: string | null; fallback: boolean };
    }

    stopTTS() {
        if (!window.electronAPI?.tts) return;
        window.electronAPI.tts.stop();
    }

    async isTTSAvailable(): Promise<boolean> {
        if (!window.electronAPI?.tts) return false;
        const result = await window.electronAPI.tts.isAvailable();
        return result.available;
    }

}

export const ipc = new IPCClient();
