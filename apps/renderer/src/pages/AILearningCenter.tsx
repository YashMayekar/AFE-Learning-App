import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ipc } from '../lib/ipc.ts';
import type { AISession, AIChatMessage, Module } from '@afe/shared';
import { useStreamingSTT } from './useStreamingSTT.ts';
import { useVoiceMode } from './useVoiceMode.ts';
import VoiceOrb from '../components/VoiceOrb.tsx';
// Use standard icons for neo-brutalism look
const ICON_BOT = '🤖';
const ICON_USER = '👤';
const ICON_TRASH = '🗑️';
const ICON_PLUS = '➕';
const ICON_MIC = '🎙';
function AILearningCenter() {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<AISession[]>([]);
    const [activeSession, setActiveSession] = useState<AISession | null>(null);
    const [messages, setMessages] = useState<AIChatMessage[]>([]);
    const [modules, setModules] = useState<Module[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [modulePage, setModulePage] = useState(0);
    const [isAutoSpeakEnabled, setIsAutoSpeakEnabled] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [micBusy, setMicBusy] = useState(false);
    const [voiceModeActive, setVoiceModeActive] = useState(false);

    const { isRecording, startRecording, stopRecording } = useStreamingSTT();
    const voiceMode = useVoiceMode();
    const MODULES_PER_PAGE = 5;

    useEffect(() => {
        if (studentId) {
            loadInitialData();
        }
    }, [studentId]);
    useEffect(() => {
        if (activeSession) {
            setLoading(false);
            setStreamingContent('');
            loadSessionHistory(activeSession.id);
        } else {
            setMessages([]);
        }
    }, [activeSession]);

    useEffect(() => {
        const cleanup = ipc.onAIStreamChunk((chunk) => {
            setStreamingContent(prev => prev + chunk);
        });
        return cleanup;
    }, []);

    useEffect(() => {
        const cleanup = ipc.onSessionUpdated((sessionId, title) => {
            setSessions(prev => prev.map(s =>
                s.id === sessionId ? { ...s, title } : s
            ));

            setActiveSession(prev => {
                if (prev && prev.id === sessionId) {
                    return { ...prev, title };
                }
                return prev;
            });
        });
        return cleanup;
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const newHeight = Math.min(textareaRef.current.scrollHeight, 150); // ~4-5 lines
            textareaRef.current.style.height = `${newHeight}px`;
        }
    }, [input]);


    useEffect(() => {
        const cleanup = ipc.onSTTFinalResult((text) => {
            if (!text) return;
            // Don't write to chat input while voice mode is handling the transcript
            if (voiceModeActive) return;
            setInput(prev => prev ? prev + " " + text : text);
        });

        return cleanup;
    }, [voiceModeActive]);

    useEffect(() => {
        return () => {
            if (isRecording) {
                stopRecording();
            }

            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        };
    }, [isRecording]);

    async function loadInitialData() {
        if (!studentId) return;
        try {
            const [sessionList, moduleList] = await Promise.all([
                ipc.getAISessions(studentId),
                ipc.getModules()
            ]);
            setSessions(sessionList);
            setModules(moduleList);
        } catch (error) {
            console.error('Failed to load initial AI data:', error);
        }
    }

    async function loadSessionHistory(sessionId: string) {
        try {
            const history = await ipc.getAISessionHistory(sessionId);
            setMessages(history);
        } catch (error) {
            console.error('Failed to load history:', error);
        }
    }

    async function handleCreateSession(mode: 'chat' | 'tutor', moduleId?: string) {
        if (!studentId) return;

        let title = mode === 'chat' ? 'General Conversation' : 'Learning Session';
        if (mode === 'tutor' && moduleId) {
            const mod = modules.find(m => m.id === moduleId);
            if (mod) title = mod.title;
        }

        try {
            const newSession = await ipc.createAISession(studentId, title, mode, moduleId);
            setSessions(prev => [newSession, ...prev]);
            setActiveSession(newSession);
        } catch (error) {
            console.error('Failed to create session:', error);
        }
    }

    async function handleDeleteSession(sessionId: string, e: React.MouseEvent) {
        e.stopPropagation();
        try {
            await ipc.deleteAISession(sessionId);
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            if (activeSession?.id === sessionId) {
                setActiveSession(null);
            }
        } catch (error) {
            console.error('Failed to delete session:', error);
        }
    }

    async function handleSend() {
        if (!input.trim() || !activeSession || !studentId || loading) return;

        const currentInput = input;
        setInput('');
        setLoading(true);
        setStreamingContent('');

        // Create abort controller for this request
        const controller = new AbortController();
        abortControllerRef.current = controller;

        // Reset textarea height
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        // Optimistic UI update
        const userMsg: AIChatMessage = {
            id: Date.now().toString(),
            sessionId: activeSession.id,
            role: 'user',
            content: currentInput,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMsg]);

        try {
            const result = await ipc.sendAIMessage(studentId, currentInput, activeSession.id);

            // Check if aborted – if so, streaming content was already saved by handleStopResponse
            if (controller.signal.aborted) return;

            // Final sync after stream ends
            const botMsg: AIChatMessage = {
                id: (Date.now() + 1).toString(),
                sessionId: activeSession.id,
                role: 'assistant',
                content: result.response,
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, botMsg]);

            if (isAutoSpeakEnabled) {
                speak(result.response);
            }

            setStreamingContent('');
        } catch (error) {
            if (!controller.signal.aborted) {
                console.error('Failed to send message:', error);
            }
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    }

    function handleStopResponse() {
        // Save whatever has been streamed so far
        if (streamingContent && activeSession) {
            const partialMsg: AIChatMessage = {
                id: (Date.now() + 1).toString(),
                sessionId: activeSession.id,
                role: 'assistant',
                content: streamingContent + '\n\n*(response stopped)*',
                timestamp: new Date().toISOString()
            };
            setMessages(prev => [...prev, partialMsg]);
        }

        // Stop TTS if speaking
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }

        // Abort the in-flight request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }

        setStreamingContent('');
        setLoading(false);
    }

    const paginatedModules = modules.slice(
        modulePage * MODULES_PER_PAGE,
        (modulePage + 1) * MODULES_PER_PAGE
    );
    function speak(text: string) {
        if (!window.speechSynthesis) return;

        // Cancel any current speaking
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        // Optional: configure voice, rate, pitch here
        // const voices = window.speechSynthesis.getVoices();
        // utterance.voice = voices.find(v => v.lang.startsWith('en')) || null;

        window.speechSynthesis.speak(utterance);
    }

    useEffect(() => {
        // Cleanup speech on unmount
        return () => {
            if (window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
        };
    }, []);
    async function handleSpeak() {
        if (micBusy || loading) return;

        if (!studentId) return;

        setMicBusy(true);

        try {
            // Ensure a session exists before entering voice mode
            let session = activeSession;
            if (!session) {
                session = await ipc.createAISession(studentId, 'Voice Conversation', 'chat');
                setSessions(prev => [session!, ...prev]);
                setActiveSession(session);
            }

            // Enter voice mode
            setVoiceModeActive(true);
            await voiceMode.startVoiceMode(session.id, studentId);

        } catch (err) {
            console.error("Voice mode error:", err);
            setVoiceModeActive(false);
        } finally {
            setMicBusy(false);
        }
    }

    const handleVoiceModeClose = useCallback(() => {
        voiceMode.stopVoiceMode();
        setVoiceModeActive(false);
        // Refresh chat history to show voice messages
        if (activeSession) {
            loadSessionHistory(activeSession.id);
        }
    }, [activeSession, voiceMode]);

    return (
        <div className="ai-learning-center" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* Voice Mode Overlay */}
            {voiceModeActive && (
                <VoiceOrb
                    orbState={voiceMode.orbState}
                    audioLevel={voiceMode.audioLevel}
                    transcript={voiceMode.transcript}
                    response={voiceMode.response}
                    onClose={handleVoiceModeClose}
                    onTap={voiceMode.tapOrb}
                />
            )}
            {/* Sidebar */}
            <div className="sidebar" style={{
                width: '300px',
                backgroundColor: 'var(--color-surface)',
                borderRight: 'var(--border-width) solid var(--color-border)',
                display: 'flex',
                flexDirection: 'column'
            }}>
                <div style={{ padding: 'var(--spacing-md)', borderBottom: '3px solid var(--color-border)' }}>
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setActiveSession(null)}>
                        {ICON_PLUS} New Chat
                    </button>
                    <button className="btn" style={{ width: '100%', marginTop: 'var(--spacing-sm)', fontSize: '0.9rem' }} onClick={() => navigate(`/dashboard/${studentId}`)}>
                        🏠 Back Home
                    </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-sm)' }}>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: 'var(--spacing-sm)' }}>Recent Chats</h4>
                    {sessions.map(session => (
                        <div
                            key={session.id}
                            onClick={() => setActiveSession(session)}
                            style={{
                                padding: 'var(--spacing-sm)',
                                border: '3px solid var(--color-border)',
                                borderRadius: '8px',
                                marginBottom: 'var(--spacing-xs)',
                                cursor: 'pointer',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                backgroundColor: activeSession?.id === session.id ? 'var(--color-accent)' : 'transparent',
                                boxShadow: activeSession?.id === session.id ? '2px 2px 0 var(--color-border)' : 'none'
                            }}
                        >
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {session.title}
                            </span>
                            <button
                                onClick={(e) => handleDeleteSession(session.id, e)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}
                            >
                                {ICON_TRASH}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="main-chat" style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)', position: 'relative' }}>
                {!activeSession ? (
                    /* Welcome / Setup Screen */
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'var(--spacing-xl)', alignItems: 'center', justifyContent: 'center', overflowY: 'auto' }}>
                        <div style={{ maxWidth: '800px', width: '100%', textAlign: 'center' }}>
                            <span style={{ fontSize: '5rem' }}>{ICON_BOT}</span>
                            <h1>How can I help you today?</h1>
                            <p style={{ fontSize: '1.25rem', marginBottom: 'var(--spacing-xl)' }}>Select a module to start tutoring, or jump into a general conversation.</p>

                            <div className="card" style={{ textAlign: 'left', width: '100%' }}>
                                <div className="card-header">
                                    <h3>Subject Browser</h3>
                                </div>
                                <div className="grid grid-1" style={{ gap: 'var(--spacing-sm)' }}>
                                    {paginatedModules.map(mod => (
                                        <div key={mod.id} className="module-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--spacing-sm)' }}>
                                            <div>
                                                <h4 style={{ margin: 0 }}>{mod.title}</h4>
                                                <p style={{ margin: 0, fontSize: '0.9rem' }}>{mod.lessons.length} Lessons</p>
                                            </div>
                                            <button className="btn btn-secondary" onClick={() => handleCreateSession('tutor', mod.id)}>
                                                Select
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {modules.length > MODULES_PER_PAGE && (
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'center', marginTop: 'var(--spacing-md)' }}>
                                        <button
                                            className="btn btn-xs"
                                            disabled={modulePage === 0}
                                            onClick={() => setModulePage(p => p - 1)}
                                        >
                                            Prev
                                        </button>
                                        <span style={{ alignSelf: 'center', fontWeight: 700 }}>Page {modulePage + 1} of {Math.ceil(modules.length / MODULES_PER_PAGE)}</span>
                                        <button
                                            className="btn btn-xs"
                                            disabled={(modulePage + 1) * MODULES_PER_PAGE >= modules.length}
                                            onClick={() => setModulePage(p => p + 1)}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </div>

                            <button className="btn btn-large" style={{ marginTop: 'var(--spacing-lg)' }} onClick={() => handleCreateSession('chat')}>
                                💬 Start a General Conversation
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Active Chat Screen */
                    <>
                        {/* Chat Header */}
                        <div style={{
                            padding: 'var(--spacing-md)',
                            backgroundColor: 'var(--color-surface)',
                            borderBottom: 'var(--border-width) solid var(--color-border)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <h3 style={{ margin: 0 }}>{activeSession.title}</h3>
                                <span className="tag" style={{ fontSize: '0.7rem' }}>
                                    {activeSession.mode === 'tutor' ? 'Tutor Mode' : 'Chat Mode'}
                                </span>
                            </div>
                            <button
                                className={`btn btn-sm ${isAutoSpeakEnabled ? 'btn-primary' : ''}`}
                                onClick={() => setIsAutoSpeakEnabled(!isAutoSpeakEnabled)}
                                title={isAutoSpeakEnabled ? "Disable Auto-Speak" : "Enable Auto-Speak"}
                            >
                                {isAutoSpeakEnabled ? '🔊 Auto-Speak ON' : '🔇 Auto-Speak OFF'}
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-xl)' }}>
                            <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                                {messages.map(msg => (
                                    <div
                                        key={msg.id}
                                        style={{
                                            display: 'flex',
                                            marginBottom: 'var(--spacing-lg)',
                                            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                                        }}
                                    >
                                        <div style={{ fontSize: '2rem', padding: 'var(--spacing-sm)' }}>
                                            {msg.role === 'user' ? ICON_USER : ICON_BOT}
                                        </div>
                                        <div className="card message-content" style={{
                                            maxWidth: '80%',
                                            backgroundColor: msg.role === 'user' ? 'var(--color-secondary)' : 'var(--color-surface)',
                                            color: msg.role === 'user' ? 'white' : 'inherit',
                                            padding: 'var(--spacing-md)',
                                            fontSize: '1rem'
                                        }}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                ))}

                                {loading && (
                                    <div style={{ display: 'flex', marginBottom: 'var(--spacing-lg)' }}>
                                        <div style={{ fontSize: '2rem', padding: 'var(--spacing-sm)' }}>{ICON_BOT}</div>
                                        <div className="card message-content" style={{ maxWidth: '80%', padding: 'var(--spacing-md)', fontSize: '1rem' }}>
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {streamingContent || 'Thinking...'}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Input Area */}
                        <div style={{
                            padding: 'var(--spacing-lg)',
                            backgroundColor: 'transparent',
                        }}>
                            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', gap: 'var(--spacing-md)' }}>
                                <div style={{ width: '100%', position: 'relative', border: '3px solid #000', boxShadow: '4px 4px 0px #000', background: '#fff', display: 'flex', alignItems: 'flex-end' }}>
                                    <textarea
                                        ref={textareaRef}
                                        className="input"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        placeholder="Type your question here..."
                                        style={{
                                            resize: 'none',
                                            minHeight: '56px',
                                            maxHeight: '150px',
                                            padding: '14px 56px 14px 16px', // space for mic
                                            lineHeight: '1.5',
                                            width: '100%',
                                            border: 'none',
                                            outline: 'none',
                                            fontSize: '16px',
                                            fontWeight: '600',
                                            background: 'transparent'
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        disabled={loading}
                                    />
                                    {loading ? (
                                        /* Stop Response button — swaps with mic during streaming */
                                        <button
                                            onClick={handleStopResponse}
                                            aria-label="Stop response"
                                            title="Stop generating"
                                            style={{
                                                position: 'absolute',
                                                right: '12px',
                                                bottom: '20px',
                                                width: '38px',
                                                height: '38px',
                                                fontSize: '18px',
                                                fontWeight: '900',
                                                cursor: 'pointer',
                                                transition: 'all 0.1s ease',
                                                backgroundColor: '#ef4444',
                                                border: '3px solid #b91c1c',
                                                boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.3)',
                                                borderRadius: '4px',
                                                color: 'white',
                                            }}
                                        >
                                            ⏹
                                        </button>
                                    ) : (
                                        /* Voice mode / Mic button */
                                        <button
                                            onClick={handleSpeak}
                                            disabled={micBusy}
                                            aria-label={isRecording ? "Stop recording" : "Start voice input"}
                                            title={isRecording ? "Click to stop recording" : "Click to speak"}
                                            style={{
                                                position: 'absolute',
                                                right: '12px',
                                                bottom: '20px',
                                                width: '38px',
                                                height: '38px',
                                                fontSize: '18px',
                                                fontWeight: '900',
                                                cursor: micBusy ? 'not-allowed' : 'pointer',
                                                transition: 'all 0.1s ease',
                                                backgroundColor: isRecording ? '#ff4444' : '#ffffff',
                                                border: isRecording ? '3px solid #cc0000' : '3px solid #000',
                                                boxShadow: isRecording
                                                    ? '0 0 0 4px rgba(255, 68, 68, 0.3)'
                                                    : '3px 3px 0px #000',
                                                animation: isRecording ? 'pulse 1.5s infinite' : 'none',
                                                opacity: micBusy ? 0.6 : 1
                                            }}
                                        >
                                            {isRecording ? '⏺️' : ICON_MIC}
                                        </button>
                                    )}
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSend}
                                    disabled={loading || !input.trim()}
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default AILearningCenter;
