import { Routes, Route } from 'react-router-dom';
import BeginLearning from './pages/BeginLearning.js';
import AvatarSelection from './pages/AvatarSelection.js';
import StudentDashboard from './pages/StudentDashboard.js';
import ModuleList from './pages/ModuleList.js';
import ModuleDetail from './pages/ModuleDetail.js';
import AILearningCenter from './pages/AILearningCenter.js';
import AITutor from './components/AITutor.js';

function App() {
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
            {/* <AITutor /> */}
        </div>
    );
}

export default App;
