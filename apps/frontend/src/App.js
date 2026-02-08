import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
    return (_jsx(Routes, { children: _jsxs(Route, { element: _jsx(Layout, {}), children: [_jsx(Route, { path: "/", element: _jsx(ChatPage, {}) }), _jsx(Route, { path: "/chat", element: _jsx(ChatPage, {}) }), _jsx(Route, { path: "/dashboard", element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "/emails", element: _jsx(EmailsPage, {}) }), _jsx(Route, { path: "/agents", element: _jsx(AgentsPage, {}) }), _jsx(Route, { path: "/groups", element: _jsx(GroupsPage, {}) }), _jsx(Route, { path: "/tools", element: _jsx(ToolsPage, {}) }), _jsx(Route, { path: "/skills", element: _jsx(SkillsPage, {}) }), _jsx(Route, { path: "/metrics", element: _jsx(MetricsPage, {}) }), _jsx(Route, { path: "/settings", element: _jsx(SettingsPage, {}) })] }) }));
}
