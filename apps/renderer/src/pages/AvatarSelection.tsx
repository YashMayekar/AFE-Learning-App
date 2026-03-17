import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AVATARS } from '@afe/shared';
import { ipc } from '../lib/ipc.ts';

function AvatarSelection() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [selectedAvatar, setSelectedAvatar] = useState<typeof AVATARS[number]['id']>(AVATARS[0].id);
    const [creating, setCreating] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!name.trim()) {
            alert('Please enter your name');
            return;
        }

        try {
            setCreating(true);
            const emoji = AVATARS.find((a) => a.id === selectedAvatar)?.emoji || '🎓';
            const student = await ipc.createStudent(name.trim(), emoji);
            navigate(`/modules/${student.id}`);
        } catch (error) {
            console.error('Failed to create student:', error);
            alert('Failed to create student. Please try again.');
        } finally {
            setCreating(false);
        }
    }

    return (
        <div className="container">
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <button type="button" className="btn" onClick={() => navigate(-1)}>
                    ← Back
                </button>
            </div>
            <div className="page-header">
                <h1>Choose Your Avatar</h1>
                <p style={{ fontSize: '1.25rem', color: 'var(--color-text-light)' }}>
                    Pick an animal that represents you!
                </p>
            </div>

            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <label htmlFor="name" style={{ display: 'block', fontSize: '1.25rem', fontWeight: 700, marginBottom: 'var(--spacing-sm)' }}>
                        What's your name?
                    </label>
                    <input
                        id="name"
                        type="text"
                        className="input"
                        placeholder="Enter your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={50}
                        autoFocus
                    />
                </div>

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
                            >
                                {avatar.emoji}
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ textAlign: 'center' }}>
                    <button type="submit" className="btn btn-primary btn-large" disabled={creating}>
                        {creating ? 'Creating...' : '🚀 Start Learning'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default AvatarSelection;
