import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ipc } from '../lib/ipc.ts';
import type { Student, Module, StartedModule, VideoProgress, ReadingProgress, QuizAttempt } from '@afe/shared';

interface ModuleProgress {
    module: Module;
    startedModule: StartedModule;
    progress: number; // 0-100
    completedLessons: number;
    totalLessons: number;
}

interface AnalyticsSummary {
    totalWatchTime: number;
    totalReadTime: number;
    modulesStarted: number;
    modulesCompleted: number;
    quizzesTaken: number;
    averageQuizScore: number;
}

function StudentDashboard() {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const [student, setStudent] = useState<Student | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
    const [moduleProgressList, setModuleProgressList] = useState<ModuleProgress[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (studentId) {
            loadDashboard();
        }
    }, [studentId]);

    async function loadDashboard() {
        if (!studentId) return;

        try {
            const [studentData, analyticsData, modulesData, startedModulesData, allVideoProgress, allReadingProgress] = await Promise.all([
                ipc.getStudentById(studentId),
                ipc.getAnalyticsSummary(studentId),
                ipc.getModules(),
                ipc.getStartedModules(studentId),
                ipc.getAllProgressForStudent(studentId),
                ipc.getAllReadingProgress(studentId),
            ]);

            setStudent(studentData);
            setAnalytics(analyticsData);

            // Calculate per-module progress
            const progressList = computeModuleProgressList(
                modulesData,
                startedModulesData,
                allVideoProgress,
                allReadingProgress
            );
            setModuleProgressList(progressList);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
        } finally {
            setLoading(false);
        }
    }

    function computeModuleProgressList(
        modules: Module[],
        startedModules: StartedModule[],
        videoProgressArr: VideoProgress[],
        readingProgressArr: ReadingProgress[]
    ): ModuleProgress[] {
        const videoMap = new Map<string, VideoProgress>();
        for (const vp of videoProgressArr) {
            videoMap.set(vp.lessonId, vp);
        }

        const readingMap = new Map<string, ReadingProgress>();
        for (const rp of readingProgressArr) {
            readingMap.set(rp.lessonId, rp);
        }

        const results: ModuleProgress[] = [];

        for (const sm of startedModules) {
            const mod = modules.find(m => m.id === sm.moduleId);
            if (!mod) continue;

            let completedLessons = 0;
            const totalLessons = mod.lessons.length;

            for (const lesson of mod.lessons) {
                if (lesson.type === 'video') {
                    const vp = videoMap.get(lesson.id);
                    if (vp) {
                        const minDuration = lesson.minVideoLength || 0;
                        if (minDuration > 0) {
                            if (vp.totalWatchDuration >= minDuration) completedLessons++;
                        } else if (vp.watchedPercentage >= 90) {
                            completedLessons++;
                        }
                    }
                } else if (lesson.type === 'reading') {
                    const rp = readingMap.get(lesson.id);
                    if (rp) {
                        const minDuration = lesson.minReadingTime || 0;
                        if (minDuration > 0) {
                            if (rp.totalReadDuration >= minDuration) completedLessons++;
                        } else if (rp.readPercentage >= 90) {
                            completedLessons++;
                        }
                    }
                } else if (lesson.type === 'quiz') {
                    // Quiz is "completed" if at least one attempt exists
                    // We don't have quiz attempts per-lesson readily available here,
                    // so we check analytics for quiz-completed events or a simple heuristic.
                    // For now, we assume quiz progress is tracked separately.
                    // This can be refined with a dedicated IPC call.
                }
            }

            const progress = totalLessons > 0
                ? Math.round((completedLessons / totalLessons) * 100)
                : 0;

            results.push({
                module: mod,
                startedModule: sm,
                progress,
                completedLessons,
                totalLessons,
            });
        }

        return results;
    }

    function handleViewModules() {
        navigate(`/modules/${studentId}`);
    }

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    if (!student) {
        return <div className="container"><p>Student not found</p></div>;
    }

    function formatTime(seconds: number) {
        if (seconds < 60) return `${seconds}s`;
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}m ${secs}s`;
    }

    const watchTime = formatTime(Math.round(analytics?.totalWatchTime || 0));
    const readTime = formatTime(Math.round(analytics?.totalReadTime || 0));

    // Filter active modules (not yet 100%)
    const activeModules = moduleProgressList.filter(mp => mp.progress < 100);
    const completedModules = moduleProgressList.filter(mp => mp.progress >= 100);

    return (
        <div className="container">
            <div className="page-header">
                <div style={{ fontSize: '5rem', marginBottom: 'var(--spacing-sm)' }}>
                    {student.avatar}
                </div>
                <h1>Welcome back, {student.name}!</h1>
                <p style={{ fontSize: '1.125rem', color: 'var(--color-text-light)' }}>
                    Keep up the great work 🌟
                </p>
            </div>

            <div className="accent-bar"></div>

            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>Your Progress</h2>
            <div className="grid grid-5" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div className="stat-card">
                    <span className="stat-value" style={{ fontSize: '3rem' }}>⏱️</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>{watchTime}</span>
                    <span className="stat-label">Time Watched</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value" style={{ fontSize: '3rem' }}>📖</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>{readTime}</span>
                    <span className="stat-label">Time Read</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value" style={{ fontSize: '3rem' }}>📚</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>{analytics?.modulesStarted || 0}</span>
                    <span className="stat-label">Modules Started</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value" style={{ fontSize: '3rem' }}>✅</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>{analytics?.modulesCompleted || 0}</span>
                    <span className="stat-label">Modules Completed</span>
                </div>

                <div className="stat-card">
                    <span className="stat-value" style={{ fontSize: '3rem' }}>🎯</span>
                    <span className="stat-value" style={{ fontSize: '2rem' }}>
                        {analytics?.averageQuizScore ? analytics.averageQuizScore.toFixed(0) : 0}%
                    </span>
                    <span className="stat-label">Avg Quiz Score</span>
                </div>
            </div>

            {/* Active Module Progress Bars */}
            {activeModules.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h2 style={{ marginBottom: 'var(--spacing-md)' }}>📈 Active Modules</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        {activeModules.map(mp => (
                            <div
                                key={mp.module.id}
                                className="card"
                                style={{ cursor: 'pointer', padding: 'var(--spacing-md)' }}
                                onClick={() => navigate(`/module/${studentId}/${mp.module.id}`)}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
                                    <h3 style={{ margin: 0 }}>{mp.module.title}</h3>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{mp.progress}%</span>
                                </div>
                                <div style={{
                                    width: '100%',
                                    height: '12px',
                                    backgroundColor: 'var(--color-border, #e0e0e0)',
                                    borderRadius: '6px',
                                    overflow: 'hidden',
                                    border: '2px solid var(--color-border, #000)',
                                }}>
                                    <div style={{
                                        width: `${mp.progress}%`,
                                        height: '100%',
                                        backgroundColor: 'var(--color-primary, #6366f1)',
                                        borderRadius: '4px',
                                        transition: 'width 0.5s ease-in-out',
                                    }} />
                                </div>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
                                    {mp.completedLessons} / {mp.totalLessons} lessons completed
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Completed Modules */}
            {completedModules.length > 0 && (
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h2 style={{ marginBottom: 'var(--spacing-md)' }}>🏆 Completed Modules</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                        {completedModules.map(mp => (
                            <div key={mp.module.id} className="card" style={{ padding: 'var(--spacing-sm) var(--spacing-md)', opacity: 0.8 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700 }}>{mp.module.title}</span>
                                    <span className="tag" style={{ backgroundColor: 'var(--color-success, #22c55e)', color: 'white' }}>✅ Complete</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ textAlign: 'center', display: 'flex', gap: 'var(--spacing-md)', justifyContent: 'center' }}>
                <button className="btn btn-primary btn-large" onClick={handleViewModules}>
                    📖 Browse Modules
                </button>
                {/* <button
                    className="btn btn-ai btn-large"
                    onClick={() => navigate(`/ai-tutor/${studentId}`)}
                >
                    🤖 Learn with AI
                </button> */}
            </div>
        </div>
    );
}

export default StudentDashboard;
