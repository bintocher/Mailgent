import { Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout';
import DashboardPage from './pages/DashboardPage';
import EmailsPage from './pages/EmailsPage';
import ChatPage from './pages/ChatPage';
import AgentsPage from './pages/AgentsPage';
import GroupsPage from './pages/GroupsPage';
import ToolsPage from './pages/ToolsPage';
import SkillsPage from './pages/SkillsPage';
import MetricsPage from './pages/MetricsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<ChatPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/emails" element={<EmailsPage />} />
        <Route path="/agents" element={<AgentsPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route path="/skills" element={<SkillsPage />} />
        <Route path="/metrics" element={<MetricsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
