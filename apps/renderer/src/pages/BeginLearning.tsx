import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { ipc } from '../lib/ipc.ts';
import type { Student } from '@afe/shared';

const AVATARS: Record<string, { emoji: string, bg: string }> = {
  Lion:      { emoji: '🦁', bg: '#FFE08A' },
  Elephant:  { emoji: '🐘', bg: '#C7D2FE' },
  Tiger:     { emoji: '🐯', bg: '#FFD0A6' },
  Panda:     { emoji: '🐼', bg: '#E6E6E6' },
  Eagle:     { emoji: '🦅', bg: '#FFE0C2' },
  Parrot:    { emoji: '🦜', bg: '#A7F3D0' },
  Owl:       { emoji: '🦉', bg: '#FED7AA' },
  Penguin:   { emoji: '🐧', bg: '#BFDBFE' },
  Dolphin:   { emoji: '🐬', bg: '#99F6E4' },
  Butterfly: { emoji: '🦋', bg: '#FBCFE8' },
};

function formatLastActive(dateStr: string | number | Date) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return `${diff} days ago`;
  return `${date.toLocaleString('en', { month: 'short' })} ${date.getDate()}`;
}

function Avatar({ name, size = 54 }: { name: string, size?: number }) {
  const a = AVATARS[name] || { emoji: name || '👤', bg: '#FFE08A' };
  return <div className="neo-ava" style={{ width: size, height: size, background: a.bg, fontSize: size * 0.5, flexShrink: 0 }}>{a.emoji}</div>;
}

function Footer() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '30px 0 20px', fontSize: 14, color: '#6E6A64', fontWeight: 600 }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#3FB873', border: `2px solid #141210`, display: 'inline-block' }} />
      <span>Amazon Future Engineer · Works offline</span>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean, onClick: () => void, children: React.ReactNode }) {
  return <button className={`neo-chip${active ? ' neo-chip--on' : ''}`} onClick={onClick}>{children}</button>;
}

function ProfileCard({ profile, onClick }: { profile: Student, onClick: () => void }) {
  return (
    <button className="neo-card neo-tap" onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 14px 18px', cursor: 'pointer', width: '100%', background: 'transparent', outline: 'none' }}>
      <Avatar name={profile.avatar} size={60} />
      <span style={{ fontSize: 18, fontWeight: 700, color: '#141210', margin: '14px 0 5px', textAlign: 'center', lineHeight: 1.2, wordBreak: 'break-word' }}>{profile.name}</span>
      <span style={{ fontSize: 13, color: '#9A958E', fontWeight: 600 }}>{formatLastActive(profile.lastActiveAt)}</span>
    </button>
  );
}

function NewProfileCard({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '22px 14px',
        background: 'transparent', border: `2.5px dashed #141210`, borderRadius: 12, cursor: 'pointer', width: '100%', minHeight: 176, fontFamily: 'inherit' }}>
      <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#FFE6D6', border: `2.5px solid #141210`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, marginBottom: 12 }}>+</div>
      <span style={{ fontSize: 16, fontWeight: 700, color: '#141210' }}>New profile</span>
    </button>
  );
}

function BeginLearning() {
    const navigate = useNavigate();
    const [students, setStudents] = useState<Student[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

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
            navigate(`/dashboard/${studentId}`);
        } catch (error) {
            console.error('Failed to update student:', error);
        }
    }

    const filteredStudents = useMemo(() => {
        if (!searchTerm) return students;
        return students.filter(student => 
            student.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [students, searchTerm]);

    if (loading) {
        return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', fontSize: 20, fontWeight: 700 }}>Loading...</div>;
    }

    if (students.length === 0) {
        return (
            <div className="neo-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
                    <div className="neo-chip" style={{ cursor: 'default', marginBottom: 30, fontWeight: 700, fontSize: 15, padding: '9px 18px' }}>
                    🚀 Amazon Future Engineer
                    </div>
                    <h1 className="h-hero" style={{ fontSize: 'clamp(42px, 8vw, 82px)', margin: '0 0 26px', maxWidth: 900 }}>
                    Learn how the <span className="hl">future</span> gets built.
                    </h1>
                    <p style={{ fontSize: 20, color: '#141210', fontWeight: 500, margin: '0 0 10px', maxWidth: 540, lineHeight: 1.5 }}>
                    Go inside data centers, warehouses, and the machines that run them — one short video at a time.
                    </p>
                    <p style={{ fontSize: 15, color: '#6E6A64', fontWeight: 600, margin: '0 0 36px' }}>
                    Works fully offline. No internet needed.
                    </p>
                    <button className="neo-btn neo-btn--primary neo-btn--lg" onClick={handleCreateNew}>Make my profile →</button>
                </div>
                <Footer />
            </div>
        );
    }

    return (
        <div className="neo-root" style={{ display: 'flex', flexDirection: 'column', padding: '44px 24px 0' }}>
            <div style={{ maxWidth: 940, margin: '0 auto', width: '100%', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
                    <h1 className="h-hero" style={{ fontSize: 'clamp(32px,5vw,46px)', margin: 0 }}>Who's learning today?</h1>
                    <button className="neo-btn neo-btn--primary" onClick={handleCreateNew}>+ New profile</button>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 26, alignItems: 'center' }}>
                    <input 
                        type="text" 
                        placeholder="🔍 Search for your profile..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="neo-input"
                        style={{ padding: '8px 16px', flex: '1 1 300px', maxWidth: 400 }} 
                    />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 16 }}>
                    {filteredStudents.map(p => <ProfileCard key={p.id} profile={p} onClick={() => handleSelectStudent(p.id)} />)}
                    {searchTerm === '' && <NewProfileCard onClick={handleCreateNew} />}
                </div>
                {searchTerm && filteredStudents.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#6E6A64', fontWeight: 600 }}>
                        No profiles found matching "{searchTerm}"
                    </div>
                )}
            </div>
            <Footer />
        </div>
    );
}

export default BeginLearning;
