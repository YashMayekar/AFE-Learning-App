import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AVATARS } from '@afe/shared';
import { ipc } from '../lib/ipc.ts';

function AvatarSelection() {
    const navigate = useNavigate();
    const [selectedAvatar, setSelectedAvatar] = useState<typeof AVATARS[number]['id']>(AVATARS[0].id);
    const [username, setUsername] = useState('');
    const [grade, setGrade] = useState<number>(5);
    const [generating, setGenerating] = useState(false);
    const [creating, setCreating] = useState(false);

    // Generate unique username when the selected avatar changes
    useEffect(() => {
        const avatarObj = AVATARS.find((a) => a.id === selectedAvatar);
        if (avatarObj) {
            handleGenerateUsername(avatarObj.name);
        }
    }, [selectedAvatar]);

    async function handleGenerateUsername(avatarName: string) {
        try {
            setGenerating(true);
            const name = await ipc.generateUniqueUsername(avatarName);
            setUsername(name);
        } catch (error) {
            console.error('Failed to generate username:', error);
        } finally {
            setGenerating(false);
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!username) {
            alert('Username is generating. Please wait.');
            return;
        }

        try {
            setCreating(true);
            const emoji = AVATARS.find((a) => a.id === selectedAvatar)?.emoji || '🎓';
            const student = await ipc.createStudent(username, emoji, grade);
            await ipc.startSession(student.id);
            navigate(`/modules/${student.id}`);
        } catch (error: any) {
            console.error('Failed to create student:', error);
            alert(error.message || 'Failed to create student. Please try again.');
        } finally {
            setCreating(false);
        }
    }

    const currentAvatarObj = AVATARS.find((a) => a.id === selectedAvatar);

    return (
        <div className="container">
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <button type="button" className="btn" onClick={() => navigate(-1)}>
                    ← Back
                </button>
            </div>
            <div className="page-header" style={{ padding: 'var(--spacing-lg) 0', marginBottom: 'var(--spacing-lg)' }}>
                <h1>Choose Your Avatar</h1>
                <p style={{ fontSize: '1.25rem', color: 'var(--color-text-light)' }}>
                    Pick an animal that represents you to generate your unique learning username!
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <label style={{ display: 'block', fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>
                        Choose your avatar:
                    </label>
                    <div className="avatar-grid">
                        {AVATARS.map((avatar) => (
                            <div
                                key={avatar.id}
                                className={`avatar-option ${selectedAvatar === avatar.id ? 'selected' : ''}`}
                                onClick={() => setSelectedAvatar(avatar.id)}
                                title={avatar.name}
                                style={{
                                    fontSize: '3.5rem',
                                    userSelect: 'none'
                                }}
                            >
                                {avatar.emoji}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <label style={{ display: 'block', fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--spacing-md)' }}>
                        Select your grade:
                    </label>
                    <select
                        value={grade}
                        onChange={(e) => setGrade(Number(e.target.value))}
                        className="input"
                        style={{
                            maxWidth: '300px',
                            cursor: 'pointer',
                            fontSize: '1.125rem',
                            fontWeight: 700
                        }}
                    >
                        {Array.from({ length: 8 }, (_, i) => i + 5).map((g) => (
                            <option key={g} value={g}>
                                Grade {g}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="card" style={{
                    backgroundColor: 'var(--color-accent)',
                    border: 'var(--border-width) solid var(--color-border)',
                    boxShadow: 'var(--shadow-offset) var(--shadow-offset) 0 var(--shadow-color)',
                    padding: 'var(--spacing-lg)',
                    marginBottom: 'var(--spacing-xl)',
                    textAlign: 'center',
                    transform: 'rotate(-0.5deg)'
                }}>
                    <div style={{ fontSize: '1.125rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 'var(--spacing-xs)' }}>
                        Your Unique Username
                    </div>
                    <div style={{
                        fontSize: '2.5rem',
                        fontWeight: 900,
                        backgroundColor: 'var(--color-surface)',
                        border: '3px solid var(--color-border)',
                        borderRadius: '8px',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        margin: 'var(--spacing-md) 0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--spacing-sm)',
                        minHeight: '4.5rem',
                        boxShadow: '4px 4px 0 var(--color-border)'
                    }}>
                        {generating ? (
                            <span style={{ fontSize: '1.5rem', color: 'var(--color-text-light)', fontWeight: 700 }}>
                                🎲 Generating name...
                            </span>
                        ) : (
                            <>
                                <span>{currentAvatarObj?.emoji}</span>
                                <span style={{ fontFamily: 'system-ui, sans-serif', letterSpacing: '0.02em' }}>{username}</span>
                            </>
                        )}
                    </div>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => currentAvatarObj && handleGenerateUsername(currentAvatarObj.name)}
                        disabled={generating || creating}
                        style={{
                            marginTop: 'var(--spacing-xs)',
                            gap: 'var(--spacing-xs)'
                        }}
                    >
                        🎲 Roll Another Name
                    </button>
                </div>

                <div style={{ textAlign: 'center', marginTop: 'var(--spacing-xl)' }}>
                    <button
                        type="submit"
                        className="btn btn-primary btn-large"
                        disabled={creating || generating || !username}
                    >
                        {creating ? 'Creating...' : 'Proceed 🚀'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AvatarSelection;
