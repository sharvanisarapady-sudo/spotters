import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Practice from './pages/Practice';
import PracticeSystem from './pages/PracticeSystem';
import PracticeCase from './pages/PracticeCase';
import Tests from './pages/Tests';
import TestInterface from './pages/TestInterface';
import TestResults from './pages/TestResults';
import Progress from './pages/Progress';
import NavigationAI from './pages/NavigationAI';
import NavigationAICase from './pages/NavigationAICase';
import NotFound from './pages/NotFound';
import AdminCases from './pages/AdminCases';
import RoleRoute from './components/RoleRoute';
import Profile from './pages/Profile';

function Protected({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
        <Route path="/register" element={<PublicOnlyRoute><Register /></PublicOnlyRoute>} />

        <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
        <Route path="/practice" element={<Protected><Practice /></Protected>} />
        <Route path="/practice/:slug" element={<Protected><PracticeSystem /></Protected>} />
        <Route path="/practice/:slug/:caseId" element={<Protected><PracticeCase /></Protected>} />
        <Route path="/tests" element={<Protected><Tests /></Protected>} />
        <Route path="/tests/:testId/take" element={<Protected><TestInterface /></Protected>} />
        <Route path="/tests/attempts/:attemptId/results" element={<Protected><TestResults /></Protected>} />
        <Route path="/progress" element={<Protected><Progress /></Protected>} />
        <Route path="/navigation-ai" element={<Protected><NavigationAI /></Protected>} />
        <Route path="/navigation-ai/:caseId" element={<Protected><NavigationAICase /></Protected>} />
        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/admin/cases" element={<Protected><RoleRoute roles={['admin', 'doctor']}><AdminCases /></RoleRoute></Protected>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
