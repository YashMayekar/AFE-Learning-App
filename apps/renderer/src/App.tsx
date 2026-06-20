import { Routes, Route, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import BeginLearning from './pages/BeginLearning.js';
import AvatarSelection from './pages/AvatarSelection.js';
import StudentDashboard from './pages/StudentDashboard.js';
import ModuleList from './pages/ModuleList.js';
import ModuleDetail from './pages/ModuleDetail.js';
import AILearningCenter from './pages/AILearningCenter.js';
import { FeedbackSurveyModal } from './components/FeedbackSurveyModal.tsx';
import { ipc } from './lib/ipc.ts';

function App() {
    const navigate = useNavigate();
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

    useEffect(() => {
        if (!window.electronAPI?.on) return;

        const unsubscribe = window.electronAPI.on('app:request-logout', () => {
            console.log('[App] Received app:request-logout event from main process');
            setIsFeedbackOpen(true);
        });

        return unsubscribe;
    }, []);

    const handleFeedbackSubmit = async (csat: number, itp: number) => {
        try {
            await ipc.endSession(csat, itp);
            setIsFeedbackOpen(false);
            navigate('/');
        } catch (error) {
            console.error('Failed to end session on global exit:', error);
            navigate('/');
        }
    };

    return (
        <div className="app">
            <Routes>
                <Route path="/" element={<BeginLearning />} />
                <Route path="/avatar-selection" element={<AvatarSelection />} />
                <Route path="/dashboard/:studentId" element={<StudentDashboard />} />
                <Route path="/modules/:studentId" element={<ModuleList />} />
                <Route path="/module/:studentId/:moduleId" element={<ModuleDetail />} />
                <Route path="/ai-tutor/:studentId" element={<AILearningCenter />} />
            </Routes>

            <FeedbackSurveyModal
                isOpen={isFeedbackOpen}
                onClose={() => setIsFeedbackOpen(false)}
                onSubmit={handleFeedbackSubmit}
            />
        </div>
    );
}

export default App;
