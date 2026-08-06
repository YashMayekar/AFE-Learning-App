import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import BeginLearning from './pages/BeginLearning.js';
import AvatarSelection from './pages/AvatarSelection.js';
import StudentDashboard from './pages/StudentDashboard.js';
import ModuleDetail from './pages/ModuleDetail.js';
import AILearningCenter from './pages/AILearningCenter.js';
import { FeedbackSurveyModal } from './components/FeedbackSurveyModal.tsx';
import { ConfirmModal } from './components/ConfirmModal.tsx';
import { ipc } from './lib/ipc.ts';
import { exitPictureInPictureAndCleanup } from './lib/mediaCleanup.ts';

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
    const [isExitModalOpen, setIsExitModalOpen] = useState(false);

    useEffect(() => {
        if (!window.electronAPI?.on) return;

        const unsubscribeLogout = window.electronAPI.on('app:request-logout', async () => {
            console.log('[App] Received app:request-logout event from main process');
            await exitPictureInPictureAndCleanup();
            try {
                const metThreshold = await ipc.hasMetEngagementThreshold();
                if (metThreshold) {
                    setIsFeedbackOpen(true);
                } else {
                    await ipc.endSession(null, null);
                    navigate('/');
                }
            } catch (e) {
                await ipc.endSession(null, null);
                navigate('/');
            }
        });

        const unsubscribeExit = window.electronAPI.on('app:request-exit', () => {
            console.log('[App] Received app:request-exit event from main process');
            const isSessionPage = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/module') || location.pathname.startsWith('/ai-tutor');
            if (!isSessionPage) {
                ipc.exitImmediately();
            } else {
                setIsExitModalOpen(true);
            }
        });

        return () => {
            if (typeof unsubscribeLogout === 'function') unsubscribeLogout();
            if (typeof unsubscribeExit === 'function') unsubscribeExit();
        };
    }, [location.pathname, navigate]);

    const handleFeedbackSubmit = async (
        csat: number,
        itp: number,
        overallRating: number,
        exploreCareerRating: number,
        seeMoreToursRating: number
    ) => {
        try {
            await exitPictureInPictureAndCleanup();
            await ipc.endSession(csat, itp, overallRating, exploreCareerRating, seeMoreToursRating);
            setIsFeedbackOpen(false);
            navigate('/');
        } catch (error) {
            console.error('Failed to end session on global exit:', error);
            navigate('/');
        }
    };

    const handleExitLogOut = async () => {
        setIsExitModalOpen(false);
        await exitPictureInPictureAndCleanup();
        // Only trigger feedback if user is inside a session (not on BeginLearning/AvatarSelection)
        if (location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/module') || location.pathname.startsWith('/ai-tutor')) {
            await ipc.setCloseOnSessionEnd();
            try {
                const metThreshold = await ipc.hasMetEngagementThreshold();
                if (metThreshold) {
                    setIsFeedbackOpen(true);
                } else {
                    await ipc.endSession(null, null);
                }
            } catch (e) {
                await ipc.endSession(null, null);
            }
        } else {
            await ipc.exitImmediately();
        }
    };

    const handleExitImmediately = async () => {
        setIsExitModalOpen(false);
        await exitPictureInPictureAndCleanup();
        await ipc.exitImmediately();
    };

    return (
        <div className="app">
            <Routes>
                <Route path="/" element={<BeginLearning />} />
                <Route path="/avatar-selection" element={<AvatarSelection />} />
                <Route path="/dashboard/:studentId" element={<StudentDashboard />} />
                <Route path="/module/:studentId/:moduleId" element={<ModuleDetail />} />
                <Route path="/ai-tutor/:studentId" element={<AILearningCenter />} />
            </Routes>

            <ConfirmModal
                isOpen={isExitModalOpen}
                title="Confirm Exit"
                message="Do you want to log out and give your feedback before exiting? Logging out saves your learning progress and opens the feedback survey."
                confirmText="Log Out & Exit"
                cancelText="Exit Immediately"
                onConfirm={handleExitLogOut}
                onCancel={handleExitImmediately}
            />

            <FeedbackSurveyModal
                isOpen={isFeedbackOpen}
                onClose={() => setIsFeedbackOpen(false)}
                onSubmit={handleFeedbackSubmit}
            />
        </div>
    );
}

export default App;
