import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { ipc } from '../lib/ipc.ts';
import type { Student } from '@afe/shared';

function BeginLearning() {
    const navigate = useNavigate();
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadStudents();
    }, []);

    async function loadStudents() {
        try {
            const allStudents = await ipc.getAllStudents();
            setStudents(allStudents);
        } catch (error) {
            console.error('Failed to load students:', error);
        } finally {
            setLoading(false);
        }
    }

    function handleCreateNew() {
        navigate('/avatar-selection');
    }

    async function handleSelectStudent(studentId: string) {
        try {
            await ipc.updateStudentLastActive(studentId);
            await ipc.startSession(studentId);
            navigate(`/modules/${studentId}`);
        } catch (error) {
            console.error('Failed to update student:', error);
        }
    }

    if (loading) {
        return <div className="loading">Loading...</div>;
    }

    return (
        <div className="container">
            <div className="page-header">
                <h1>🎓 Welcome to Offline Learning</h1>
                <p style={{ fontSize: '1.25rem', color: 'var(--color-text-light)' }}>
                    Begin your learning journey!
                </p>
            </div>

            <div className="accent-bar"></div>

            {students.length > 0 ? (
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h2 style={{ textAlign: 'center' }}>Continue Learning</h2>
                    <p style={{
                        textAlign: 'center',
                        color: 'var(--color-text-light)',
                        fontSize: '1.1rem',
                        marginBottom: 'var(--spacing-lg)',
                    }}>
                        👇 Click on an account to login
                    </p>
                    <div className="grid grid-3">
                        {students.map((student) => (
                            <div
                                key={student.id}
                                className="card"
                                onClick={() => handleSelectStudent(student.id)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div style={{ fontSize: '4rem', textAlign: 'center', marginBottom: 'var(--spacing-sm)' }}>
                                    {student.avatar}
                                </div>
                                <h3 style={{ textAlign: 'center', marginBottom: 0 }}>{student.name}</h3>
                                <p style={{ textAlign: 'center', color: 'var(--color-text-light)', fontSize: '0.875rem' }}>
                                    Last active: {new Date(student.lastActiveAt).toLocaleDateString()}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-md)',
                        margin: 'var(--spacing-xl) 0',
                    }}>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-text-light)', opacity: 0.3 }} />
                        <span style={{ color: 'var(--color-text-light)', fontWeight: 600, fontSize: '1rem' }}>OR</span>
                        <div style={{ flex: 1, height: '1px', background: 'var(--color-text-light)', opacity: 0.3 }} />
                    </div>

                    <div style={{ textAlign: 'center' }}>
                        <button className="btn btn-primary btn-large" onClick={handleCreateNew}>
                            ✨ Begin the Journey!
                        </button>
                    </div>
                </div>
            ) : (
                <div style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)' }}>
                    <button className="btn btn-primary btn-large" onClick={handleCreateNew}>
                        ✨ Begin the Journey!
                    </button>
                </div>
            )}
        </div>
    );
}

export default BeginLearning;
