import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Mail, MessageSquare, Bot, Users, Wrench, Zap, BarChart3, Settings, ChevronLeft, ChevronRight, Circle, Pause, Play, Square, } from 'lucide-react';
import { useStore } from '@/store';
import { useWebSocket } from '@/hooks/useWebSocket';
const navItems = [
    { to: '/', label: 'Chat', icon: MessageSquare },
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/emails', label: 'Emails', icon: Mail },
    { to: '/agents', label: 'Agents', icon: Bot },
    { to: '/groups', label: 'Groups', icon: Users },
    { to: '/tools', label: 'Tools', icon: Wrench },
    { to: '/skills', label: 'Skills', icon: Zap },
    { to: '/metrics', label: 'Metrics', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
];
export default function Layout() {
    useWebSocket();
    const [collapsed, setCollapsed] = useState(false);
    const connected = useStore((s) => s.connected);
    const systemStatus = useStore((s) => s.systemStatus);
    const freezeOperations = useStore((s) => s.freezeOperations);
    const resumeOperations = useStore((s) => s.resumeOperations);
    const stopAllOperations = useStore((s) => s.stopAllOperations);
    const isPaused = systemStatus?.queuePaused ?? false;
    return (_jsxs("div", { className: "flex h-screen bg-gray-100 dark:bg-gray-950", children: [_jsxs("aside", { className: `flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 transition-all duration-200 ${collapsed ? 'w-16' : 'w-60'}`, children: [_jsxs("div", { className: "flex items-center h-14 px-4 border-b border-gray-200 dark:border-gray-800", children: [_jsx(Bot, { className: "w-6 h-6 text-primary-600 flex-shrink-0" }), !collapsed && (_jsx("span", { className: "ml-3 text-lg font-bold text-gray-900 dark:text-white truncate", children: "Mailgent" }))] }), _jsx("nav", { className: "flex-1 py-4 space-y-1 overflow-y-auto", children: navItems.map(({ to, label, icon: Icon }) => (_jsxs(NavLink, { to: to, end: to === '/', className: ({ isActive }) => `flex items-center px-4 py-2.5 mx-2 rounded-lg transition-colors ${isActive
                                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium'
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'}`, children: [_jsx(Icon, { className: "w-5 h-5 flex-shrink-0" }), !collapsed && _jsx("span", { className: "ml-3 truncate", children: label })] }, to))) }), _jsxs("div", { className: "border-t border-gray-200 dark:border-gray-800 p-3 space-y-2", children: [_jsxs("div", { className: `flex ${collapsed ? 'flex-col' : ''} gap-1`, children: [isPaused ? (_jsxs("button", { onClick: () => resumeOperations(), className: `flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 ${collapsed ? 'px-1.5' : 'flex-1 px-2'}`, title: "Resume operations", children: [_jsx(Play, { className: "w-3.5 h-3.5 flex-shrink-0" }), !collapsed && _jsx("span", { children: "Resume" })] })) : (_jsxs("button", { onClick: () => freezeOperations(), className: `flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 ${collapsed ? 'px-1.5' : 'flex-1 px-2'}`, title: "Freeze \u2014 pause queue (running tasks finish)", children: [_jsx(Pause, { className: "w-3.5 h-3.5 flex-shrink-0" }), !collapsed && _jsx("span", { children: "Freeze" })] })), _jsxs("button", { onClick: () => {
                                            if (confirm('Stop ALL agents and clear the queue?')) {
                                                stopAllOperations();
                                            }
                                        }, className: `flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50 ${collapsed ? 'px-1.5' : 'flex-1 px-2'}`, title: "Stop All \u2014 abort agents & clear queue", children: [_jsx(Square, { className: "w-3.5 h-3.5 flex-shrink-0" }), !collapsed && _jsx("span", { children: "Stop All" })] })] }), _jsxs("div", { className: "flex items-center px-1", children: [_jsx(Circle, { className: `w-3 h-3 flex-shrink-0 ${connected
                                            ? isPaused
                                                ? 'text-yellow-500 fill-yellow-500'
                                                : 'text-green-500 fill-green-500'
                                            : 'text-red-500 fill-red-500'}` }), !collapsed && (_jsx("span", { className: "ml-2 text-xs text-gray-500 dark:text-gray-400", children: !connected ? 'Disconnected' : isPaused ? 'Paused' : 'Connected' }))] }), _jsx("button", { onClick: () => setCollapsed(!collapsed), className: "flex items-center justify-center w-full py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors", children: collapsed ? (_jsx(ChevronRight, { className: "w-4 h-4" })) : (_jsx(ChevronLeft, { className: "w-4 h-4" })) })] })] }), _jsx("main", { className: "flex-1 overflow-auto", children: _jsx(Outlet, {}) })] }));
}
