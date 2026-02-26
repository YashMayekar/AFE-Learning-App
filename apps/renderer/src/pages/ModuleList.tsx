import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ipc } from '../lib/ipc.ts';
import type { Module, Student } from '@afe/shared';

function ModuleList() {
    const { studentId } = useParams<{ studentId: string }>();
    const navigate = useNavigate();
    const [modules, setModules] = useState<Module[]>([]);
    const [student, setStudent] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    // Close profile dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setProfileOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    async function loadData() {
        try {
            const [modulesData, studentData] = await Promise.all([
                ipc.getModules(),
                studentId ? ipc.getStudentById(studentId) : Promise.resolve(null),
            ]);
            setModules(modulesData);
            setStudent(studentData);
        } catch (error) {
            console.error('Failed to load modules:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleModuleClick(moduleId: string) {
        navigate(`/module/${studentId}/${moduleId}`);
    }

    function handleLogout() {
        navigate('/');
    }

    function handleGoToDashboard() {
        navigate(`/dashboard/${studentId}`);
        setProfileOpen(false);
    }

    if (loading) {
        return <div className="loading">Loading modules...</div>;
    }

    if (modules.length === 0) {
        return (
            <div className="container">
                <div className="page-header">
                    <h1>No Modules Available</h1>
                    <p>Please ensure content is installed in C:\ProgramData\OfflineLearningApp\content\</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <button className="btn btn-secondary" onClick={handleLogout}>
                        ← Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="container">
            {/* Top Bar with Profile */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--spacing-md)',
            }}>
                <div>
                    <h1 style={{ margin: 0 }}>📚 Learning Modules</h1>
                    <p style={{ fontSize: '1.125rem', color: 'var(--color-text-light)', margin: '4px 0 0 0' }}>
                        Choose a module to start learning
                    </p>
                </div>

                {/* Profile Button */}
                <div ref={profileRef} style={{ position: 'relative' }}>
                    <button
                        className="btn"
                        onClick={() => setProfileOpen(!profileOpen)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '1rem',
                            fontWeight: 700,
                            padding: '8px 16px',
                        }}
                    >
                        <span style={{ fontSize: '1.5rem' }}>{student?.avatar || '👤'}</span>
                        {student?.name || 'Student'}
                        <span style={{ fontSize: '0.7rem', marginLeft: '4px' }}>{profileOpen ? '▲' : '▼'}</span>
                    </button>

                    {/* Dropdown Menu */}
                    {profileOpen && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '4px',
                            backgroundColor: 'var(--color-surface, #fff)',
                            border: '3px solid var(--color-border, #000)',
                            boxShadow: '4px 4px 0 var(--color-border, #000)',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            zIndex: 1000,
                            minWidth: '180px',
                        }}>
                            <button
                                onClick={handleGoToDashboard}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '12px 16px',
                                    textAlign: 'left',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.95rem',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent, #f0f0f0)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                                📊 Dashboard
                            </button>
                            <button
                                onClick={() => navigate(`/ai-tutor/${studentId}`)}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '12px 16px',
                                    textAlign: 'left',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.95rem',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent, #f0f0f0)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                                🤖 Learn with AI
                            </button>
                            <div style={{ borderTop: '2px solid var(--color-border, #e0e0e0)' }} />
                            <button
                                onClick={handleLogout}
                                style={{
                                    display: 'block',
                                    width: '100%',
                                    padding: '12px 16px',
                                    textAlign: 'left',
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    fontSize: '0.95rem',
                                    color: '#ef4444',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-accent, #f0f0f0)')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                                🚪 Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="accent-bar"></div>

            <div className="grid grid-2">
                {modules.map((module) => (
                    <div
                        key={module.id}
                        className="module-card"
                        onClick={() => handleModuleClick(module.id)}
                    >
                        <div className="module-title">{module.title}</div>
                        <div className="module-description">{module.description}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                            <span className="tag">{module.lessons.length} Lessons</span>
                            <span className="tag" style={{ backgroundColor: 'var(--color-secondary)' }}>
                                v{module.version}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ModuleList;
