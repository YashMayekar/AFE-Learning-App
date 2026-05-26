import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ipc } from '../lib/ipc.ts';
import type { Module, Lesson, VideoProgress } from '@afe/shared';
import VideoPlayer from '../components/VideoPlayer.tsx';
import PDFViewer from '../components/PDFViewer.tsx';
import QuizViewer from '../components/QuizViewer.tsx';

function ModuleDetail() {
    const { studentId, moduleId } = useParams<{ studentId: string; moduleId: string }>();
    const navigate = useNavigate();
    const [module, setModule] = useState<Module | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
    const [videoProgress, setVideoProgress] = useState<VideoProgress | null>(null);
    const [lessonCompletionStates, setLessonCompletionStates] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (moduleId) {
            loadModule();
            // Dispatch event for global AI Tutor
            window.dispatchEvent(new CustomEvent('set-ai-module', { detail: { moduleId } }));
        }
    }, [moduleId]);

    async function loadCompletionStates(targetModule?: Module | null) {
        const currentModule = targetModule !== undefined ? targetModule : module;
        if (!currentModule || !studentId) return;

        try {
            const completions: Record<string, boolean> = {};

            // Fetch all progress
            const [videoProgressList, readingProgressList] = await Promise.all([
                ipc.getAllProgressForStudent(studentId),
                ipc.getAllReadingProgress(studentId)
            ]);

            const videoProgressMap = new Map(videoProgressList.map(p => [p.lessonId, p]));
            const readingProgressMap = new Map(readingProgressList.map(p => [p.lessonId, p]));

            // Fetch quiz scores
            const quizLessons = currentModule.lessons.filter(l => l.type === 'quiz');
            const quizScores = await Promise.all(
                quizLessons.map(async (l) => {
                    const score = await ipc.getBestQuizScore(studentId, l.id);
                    return { lessonId: l.id, score };
                })
            );
            const quizScoresMap = new Map(quizScores.map(q => [q.lessonId, q.score]));

            for (const lesson of currentModule.lessons) {
                if (lesson.type === 'video') {
                    const progress = videoProgressMap.get(lesson.id);
                    completions[lesson.id] = progress ? (progress.completed || progress.watchedPercentage >= 95) : false;
                } else if (lesson.type === 'reading') {
                    const progress = readingProgressMap.get(lesson.id);
                    completions[lesson.id] = progress ? progress.readPercentage >= 95 : false;
                } else if (lesson.type === 'quiz') {
                    const bestScore = quizScoresMap.get(lesson.id);
                    const passingScore = lesson.quizData?.passingScore || (lesson as any).data?.quizData?.passingScore || 70;
                    completions[lesson.id] = bestScore !== null && bestScore !== undefined ? bestScore >= passingScore : false;
                }
            }

            setLessonCompletionStates(completions);
        } catch (e) {
            console.error('Error loading completion states:', e);
        }
    }

    async function loadModule() {
        if (!moduleId) return;

        try {
            const moduleData = await ipc.getModuleById(moduleId);
            setModule(moduleData);

            // Track module started event
            if (studentId && moduleData) {
                await ipc.markModuleStarted(studentId, moduleId);
                await ipc.trackEvent(studentId, 'module_started', { moduleId });
                await loadCompletionStates(moduleData);
            }
        } catch (error) {
            console.error('Failed to load module:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleBackToModules() {
        navigate(`/modules/${studentId}`);
    }

    async function handleSelectLesson(lesson: Lesson) {
        setSelectedLesson(lesson);
        // Dispatch event for global AI Tutor
        window.dispatchEvent(new CustomEvent('set-ai-lesson', { detail: { lessonId: lesson.id } }));

        if (studentId) {
            try {
                if (lesson.type === 'video') {
                    // Fetch existing video progress
                    const progress = await ipc.getVideoProgress(studentId, lesson.id);
                    setVideoProgress(progress);
                } else if (lesson.type === 'reading') {
                    // Fetch existing reading progress
                    const progress = await ipc.getReadingProgress(studentId, lesson.id);
                    setVideoProgress(progress as any);
                }
            } catch (err) {
                console.error('Failed to load lesson progress', err);
            }
        }
    }

    async function checkModuleCompletion() {
        if (!module || !studentId) return;

        try {
            const sorted = [...module.lessons].sort((a, b) => a.order - b.order);
            const isComplete = sorted.every(lesson => !!lessonCompletionStates[lesson.id]);

            if (isComplete) {
                await ipc.trackEvent(studentId, 'module_completed', { moduleId: module.id });
                alert('🎉 Congratulations! You have completed this module!');
            }
        } catch (e) {
            console.error('Error checking module completion', e);
        }
    }

    async function handleLessonCompleted() {
        // Refresh progress
        if (selectedLesson && studentId) {
            try {
                if (selectedLesson.type === 'video') {
                    const p = await ipc.getVideoProgress(studentId, selectedLesson.id);
                    setVideoProgress(p);
                } else if (selectedLesson.type === 'reading') {
                    const p = await ipc.getReadingProgress(studentId, selectedLesson.id);
                    setVideoProgress(p as any);
                }
            } catch { }
        }

        await loadCompletionStates();
        await checkModuleCompletion();
    }

    function handleBackToLessonList() {
        setSelectedLesson(null);
        setVideoProgress(null);
        // Reset global AI Tutor context
        window.dispatchEvent(new CustomEvent('set-ai-lesson', { detail: { lessonId: undefined } }));
        // Refresh completions
        loadCompletionStates();
    }

    function getLessonIcon(lesson: Lesson): string {
        switch (lesson.type) {
            case 'video':
                return '🎥';
            case 'quiz':
                return '📝';
            case 'reading':
                return '📖';
            default:
                return '📄';
        }
    }

    if (loading) {
        return <div className="loading">Loading module...</div>;
    }

    if (!module) {
        return (
            <div className="container">
                <p>Module not found</p>
                <button className="btn btn-secondary" onClick={handleBackToModules}>
                    ← Back to Modules
                </button>
            </div>
        );
    }

    return (
        <div className="container">
            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <button className="btn btn-secondary" onClick={handleBackToModules}>
                    ← Back to Modules
                </button>
            </div>

            <div className="page-header">
                <h1>{module.title}</h1>
                <p style={{ fontSize: '1.125rem', color: 'var(--color-text-light)' }}>
                    {module.description}
                </p>
            </div>

            <div className="accent-bar"></div>

            {selectedLesson ? (
                <div className="lesson-viewer">
                    <button className="btn btn-secondary" onClick={handleBackToLessonList} style={{ marginBottom: '1rem' }}>
                        ← Back to Lessons
                    </button>
                    <h2>{selectedLesson.title}</h2>
                    {selectedLesson.type === 'video' && studentId && (
                        <VideoPlayer
                            key={selectedLesson.id}
                            src={`media://${selectedLesson.videoUrl}`}
                            lessonId={selectedLesson.id}
                            studentId={studentId}
                            initialProgress={videoProgress ? {
                                watchedPercentage: videoProgress.watchedPercentage,
                                totalWatchDuration: videoProgress.totalWatchDuration,
                                lastWatchedAt: videoProgress.lastWatchedAt
                            } : undefined}
                            onCompleted={handleLessonCompleted}
                        />
                    )}
                    {selectedLesson.type === 'reading' && studentId && (
                        <PDFViewer
                            key={selectedLesson.id}
                            src={`media://${selectedLesson.readingUrl}`} // Use readingUrl for PDFs
                            lessonId={selectedLesson.id}
                            studentId={studentId}
                            initialProgress={videoProgress ? {
                                readPercentage: (videoProgress as any).readPercentage,
                                currentPage: (videoProgress as any).currentPage,
                                totalReadDuration: (videoProgress as any).totalReadDuration,
                                lastReadAt: (videoProgress as any).lastReadAt
                            } : undefined}
                            onCompleted={handleLessonCompleted}
                        />
                    )}
                    {selectedLesson.type === 'quiz' && studentId && (
                        <QuizViewer
                            lessonId={selectedLesson.id}
                            studentId={studentId}
                            quizData={selectedLesson.quizData || (selectedLesson as any).data?.quizData}
                            onCompleted={handleLessonCompleted}
                        />
                    )}
                    {/* Placeholder for other types */}
                    {selectedLesson.type !== 'video' && selectedLesson.type !== 'reading' && selectedLesson.type !== 'quiz' && (
                        <div className="alert">Content type {selectedLesson.type} viewer coming soon.</div>
                    )}
                </div>
            ) : (
                <>
                    <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Lessons ({module.lessons.length})</h2>

                    <div className="grid">
                        {(() => {
                            const sortedLessons = [...module.lessons].sort((a, b) => a.order - b.order);
                            return sortedLessons.map((lesson, idx) => {
                                const isUnlocked = idx === 0 || !!lessonCompletionStates[sortedLessons[idx - 1].id];
                                const isCompleted = !!lessonCompletionStates[lesson.id];
                                const showSeparator = isUnlocked && !isCompleted && idx < sortedLessons.length - 1;
                                return (
                                    <React.Fragment key={lesson.id}>
                                        <div 
                                            className="card" 
                                            onClick={() => {
                                                if (isUnlocked) {
                                                    handleSelectLesson(lesson);
                                                } else {
                                                    alert("🔒 This lesson is locked. Please complete the previous lessons first!");
                                                }
                                            }} 
                                            style={{ 
                                                cursor: isUnlocked ? 'pointer' : 'not-allowed',
                                                opacity: isUnlocked ? 1 : 0.6,
                                                backgroundColor: isUnlocked ? 'var(--color-surface)' : '#e5e5e0',
                                                borderStyle: isUnlocked ? 'solid' : 'dashed',
                                                boxShadow: isUnlocked ? 'var(--shadow-offset) var(--shadow-offset) 0 var(--shadow-color)' : 'none',
                                                transform: 'none',
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-md)' }}>
                                                <div style={{ fontSize: '3rem', filter: isUnlocked ? 'none' : 'grayscale(100%)' }}>
                                                    {isUnlocked ? getLessonIcon(lesson) : '🔒'}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <h3 style={{ 
                                                        marginBottom: 'var(--spacing-xs)'
                                                    }}>
                                                        {lesson.title}
                                                    </h3>
                                                    <p style={{ color: 'var(--color-text-light)', marginBottom: 'var(--spacing-sm)' }}>
                                                        {lesson.description}
                                                    </p>
                                                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                                                        <span className="tag" style={{
                                                            backgroundColor: isCompleted ? 'var(--color-success)' : 'var(--color-accent)',
                                                            color: isCompleted ? 'white' : 'var(--color-text)'
                                                        }}>
                                                            {lesson.type} {isCompleted && '✓'}
                                                        </span>
                                                        {!isUnlocked && (
                                                            <span style={{ fontSize: '0.85rem', color: 'var(--color-error)', fontWeight: 800 }}>
                                                                Locked
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        {showSeparator && (
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                margin: 'var(--spacing-md) 0',
                                                width: '100%',
                                                gap: 'var(--spacing-sm)'
                                            }}>
                                                <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--color-border)', border: '1px solid var(--color-border)' }} />
                                                <span style={{
                                                    fontWeight: 800,
                                                    fontSize: '0.9rem',
                                                    color: 'var(--color-error)',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    padding: '4px 12px',
                                                    backgroundColor: 'var(--color-surface)',
                                                    border: '3px solid var(--color-border)',
                                                    borderRadius: '8px',
                                                    boxShadow: '4px 4px 0 var(--color-border)',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    🔒 Complete the previous video to move onto next lessons.
                                                </span>
                                                <div style={{ flex: 1, height: '4px', backgroundColor: 'var(--color-border)', border: '1px solid var(--color-border)' }} />
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            });
                        })()}
                    </div>
                </>
            )}
        </div>
    );
}

export default ModuleDetail;
