// apps/renderer/src/components/AITutor.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { ipc } from '../lib/ipc.ts';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export default function AITutor() {
    const location = useLocation();

    // Extract IDs from current URL using React Router location
    const getContextFromUrl = () => {
        const parts = location.pathname.split('/');
        let sId = '';
        let mId = undefined;

        if (parts[1] === 'dashboard' || parts[1] === 'modules' || parts[1] === 'module') {
            sId = parts[2] || '';
        }

        if (parts[1] === 'module') {
            mId = parts[3] || undefined;
        }

        return { studentIdFromUrl: sId, moduleIdFromUrl: mId };
    };

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeLessonId, setActiveLessonId] = useState<string | undefined>(undefined);
    const [activeModuleId, setActiveModuleId] = useState<string | undefined>(undefined);

    // Update context from events
    useEffect(() => {
        const handleSetLesson = (e: any) => {
            console.log('DEBUG: AITutor set-ai-lesson event:', e.detail?.lessonId);
            setActiveLessonId(e.detail?.lessonId);
        };
        const handleSetModule = (e: any) => {
            console.log('DEBUG: AITutor set-ai-module event:', e.detail?.moduleId);
            setActiveModuleId(e.detail?.moduleId);
        };

        window.addEventListener('set-ai-lesson', handleSetLesson);
        window.addEventListener('set-ai-module', handleSetModule);

        return () => {
            window.removeEventListener('set-ai-lesson', handleSetLesson);
            window.removeEventListener('set-ai-module', handleSetModule);
        };
    }, []);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const { studentIdFromUrl, moduleIdFromUrl } = getContextFromUrl();
        if (moduleIdFromUrl) setActiveModuleId(moduleIdFromUrl);

        if (isOpen && studentIdFromUrl) {
            // Load messages for a default session
            loadHistory(studentIdFromUrl);
        }
    }, [isOpen, location.pathname]);

    useEffect(() => {
        const cleanup = ipc.onAIStreamChunk((chunk) => {
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    const newMessages = prev.slice(0, -1);
                    return [...newMessages, {
                        ...lastMsg,
                        content: lastMsg.content + chunk
                    }];
                }
                return prev;
            });
        });
        return cleanup;
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    async function loadHistory(sId: string) {
        try {
            const sessions = await ipc.getAISessions(sId);
            const helpSession = sessions.find(s => s.title === 'General Help');
            if (helpSession) {
                const history = await ipc.getAISessionHistory(helpSession.id);
                setMessages(history.map(m => ({
                    id: m.id,
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp
                })));
            } else {
                setMessages([]);
            }
        } catch (error) {
            console.error('Failed to load chat history', error);
        }
    }

    async function handleSend() {
        if (!input.trim() || loading) return;

        const { studentIdFromUrl } = getContextFromUrl();

        if (!studentIdFromUrl) return;

        try {
            setLoading(true);

            // Get or create session
            const sessions = await ipc.getAISessions(studentIdFromUrl);
            let session = sessions.find(s => s.title === 'General Help');
            if (!session) {
                session = await ipc.createAISession(studentIdFromUrl, 'General Help', 'chat');
            }

            const userMsg: ChatMessage = {
                id: Date.now().toString(),
                role: 'user',
                content: input,
                timestamp: new Date().toISOString()
            };

            const botPlaceholder: ChatMessage = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: '',
                timestamp: new Date().toISOString()
            };

            setMessages(prev => [...prev, userMsg, botPlaceholder]);
            setInput('');

            const response = await ipc.sendAIMessage(studentIdFromUrl, userMsg.content, session.id);

            // Sync final response
            setMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.role === 'assistant') {
                    const newMessages = prev.slice(0, -1);
                    return [...newMessages, {
                        ...lastMsg,
                        content: response.response
                    }];
                }
                return prev;
            });

        } catch (error) {
            console.error('Failed to send message', error);
        } finally {
            setLoading(false);
        }
    }

    if (location.pathname.startsWith('/ai-tutor')) return null;

    const { studentIdFromUrl } = getContextFromUrl();

    if (!studentIdFromUrl) return null;

    return (
        <>
            {/* Floating Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    position: 'fixed',
                    bottom: '2rem',
                    right: '2rem',
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary)',
                    color: 'white',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    zIndex: 1000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {isOpen ? '✕' : '🤖'}
            </button>

            {/* Chat Window */}
            {isOpen && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '7rem',
                        right: '2rem',
                        width: '350px',
                        height: '500px',
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        display: 'flex',
                        flexDirection: 'column',
                        zIndex: 1000,
                        border: '1px solid var(--color-border)',
                        overflow: 'hidden'
                    }}
                >
                    <div className="chat-header" style={{ padding: '1rem', backgroundColor: 'var(--color-primary)', color: 'white' }}>
                        <h3 style={{ margin: 0, fontSize: '1rem' }}>AI Tutor</h3>
                    </div>

                    <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                        {messages.length === 0 && (
                            <p style={{ textAlign: 'center', color: '#888', marginTop: '2rem' }}>
                                Hi! I'm your AI Tutor. Ask me anything about this lesson!
                            </p>
                        )}
                        {messages.map((msg) => (
                            (msg.role === 'user' || msg.content !== '') && (
                                <div
                                    key={msg.id}
                                    style={{
                                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                        backgroundColor: msg.role === 'user' ? 'var(--color-primary)' : '#f0f0f0',
                                        color: msg.role === 'user' ? 'white' : 'black',
                                        padding: '0.6rem 1rem',
                                        borderRadius: '12px',
                                        maxWidth: '80%',
                                        wordBreak: 'break-word'
                                    }}
                                >
                                    {msg.content}
                                </div>
                            )
                        ))}
                        {loading && messages[messages.length - 1]?.content === '' && (
                            <div style={{ alignSelf: 'flex-start', backgroundColor: '#f0f0f0', padding: '0.6rem 1rem', borderRadius: '12px' }}>
                                Thinking...
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="chat-input" style={{ padding: '1rem', borderTop: '1px solid #eee', display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Ask a question..."
                            disabled={loading}
                            style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={loading || !input.trim()}
                            className="btn btn-primary"
                            style={{ padding: '0.5rem 1rem' }}
                        >
                            ➤
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
