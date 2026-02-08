import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { Bot, Mail, ListTodo, DollarSign, Activity } from 'lucide-react';
import { useStore } from '@/store';
export default function DashboardPage() {
    const agents = useStore((s) => s.agents);
    const emails = useStore((s) => s.emails);
    const systemStatus = useStore((s) => s.systemStatus);
    const queueStats = useStore((s) => s.queueStats);
    const agentMetrics = useStore((s) => s.agentMetrics);
    const fetchAgents = useStore((s) => s.fetchAgents);
    const fetchEmails = useStore((s) => s.fetchEmails);
    const fetchSystemStatus = useStore((s) => s.fetchSystemStatus);
    const fetchQueueStats = useStore((s) => s.fetchQueueStats);
    const fetchAgentMetrics = useStore((s) => s.fetchAgentMetrics);
    useEffect(() => {
        fetchAgents();
        fetchEmails();
        fetchSystemStatus();
        fetchQueueStats();
        fetchAgentMetrics();
    }, [fetchAgents, fetchEmails, fetchSystemStatus, fetchQueueStats, fetchAgentMetrics]);
    const activeAgents = agents.filter((a) => a.status !== 'stopped' && a.status !== 'idle').length;
    const totalEmails = emails.length;
    const queueSize = queueStats?.totalItems ?? 0;
    const totalCost = agentMetrics.reduce((sum, m) => sum + m.totalCostUsd, 0);
    const stats = [
        {
            label: 'Active Agents',
            value: activeAgents,
            icon: Bot,
            color: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
        },
        {
            label: 'Queue Size',
            value: queueSize,
            icon: ListTodo,
            color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400',
        },
        {
            label: 'Total Emails',
            value: totalEmails,
            icon: Mail,
            color: 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
        },
        {
            label: 'Total Cost',
            value: `$${totalCost.toFixed(4)}`,
            icon: DollarSign,
            color: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
        },
    ];
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-bold text-gray-900 dark:text-white", children: "Dashboard" }), systemStatus?.workDir && (_jsx("span", { className: "text-xs text-gray-400 dark:text-gray-500 font-mono bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 rounded-lg", children: systemStatus.workDir }))] }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: stats.map(({ label, value, icon: Icon, color }) => (_jsxs("div", { className: "card flex items-center gap-4", children: [_jsx("div", { className: `p-3 rounded-lg ${color}`, children: _jsx(Icon, { className: "w-6 h-6" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: label }), _jsx("p", { className: "text-2xl font-bold text-gray-900 dark:text-white", children: value })] })] }, label))) }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "card", children: [_jsxs("h2", { className: "text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2", children: [_jsx(Activity, { className: "w-5 h-5" }), "Agent Overview"] }), agents.length === 0 ? (_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "No agents running." })) : (_jsx("div", { className: "space-y-3 max-h-80 overflow-y-auto", children: agents.slice(0, 15).map((agent) => (_jsxs("div", { className: "flex items-center gap-3 text-sm border-b border-gray-100 dark:border-gray-800 pb-2 last:border-0", children: [_jsx("span", { className: `w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDotColor(agent.status)}` }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "font-medium text-gray-900 dark:text-white truncate", children: agent.name }), _jsx("p", { className: "text-gray-500 dark:text-gray-400 truncate text-xs", children: agent.email })] }), _jsx("span", { className: `badge-${statusBadge(agent.status)} flex-shrink-0`, children: agent.status })] }, agent.id))) }))] }), _jsxs("div", { className: "card", children: [_jsxs("h2", { className: "text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2", children: [_jsx(ListTodo, { className: "w-5 h-5" }), "Queue Status"] }), queueStats ? (_jsx("div", { className: "space-y-4", children: _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Pending" }), _jsx("p", { className: "text-xl font-bold text-gray-900 dark:text-white", children: queueStats.pendingItems })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Processing" }), _jsx("p", { className: "text-xl font-bold text-gray-900 dark:text-white", children: queueStats.processingItems })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Avg Wait Time" }), _jsxs("p", { className: "text-xl font-bold text-gray-900 dark:text-white", children: [(queueStats.avgWaitTimeMs / 1000).toFixed(1), "s"] })] }), _jsxs("div", { children: [_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Oldest Item" }), _jsxs("p", { className: "text-xl font-bold text-gray-900 dark:text-white", children: [(queueStats.oldestItemAge / 1000).toFixed(0), "s"] })] })] }) })) : (_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "No queue data available." })), systemStatus && (_jsxs("div", { className: "mt-6 pt-4 border-t border-gray-100 dark:border-gray-800", children: [_jsx("h3", { className: "text-sm font-medium text-gray-700 dark:text-gray-300 mb-3", children: "System" }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-sm", children: [_jsx("div", { className: "text-gray-500 dark:text-gray-400", children: "Uptime" }), _jsx("div", { className: "text-gray-900 dark:text-white font-medium", children: formatUptime(systemStatus.uptime) }), _jsx("div", { className: "text-gray-500 dark:text-gray-400", children: "Memory" }), _jsxs("div", { className: "text-gray-900 dark:text-white font-medium", children: [systemStatus.memoryUsageMb, " MB"] }), _jsx("div", { className: "text-gray-500 dark:text-gray-400", children: "SMTP" }), _jsx("div", { className: systemStatus.smtpRunning ? 'text-green-600' : 'text-red-600', children: systemStatus.smtpRunning ? 'Running' : 'Stopped' })] })] }))] })] })] }));
}
function statusBadge(status) {
    switch (status) {
        case 'idle': return 'green';
        case 'thinking': return 'yellow';
        case 'acting': return 'blue';
        case 'error': return 'red';
        case 'stopped': return 'gray';
        default: return 'gray';
    }
}
function statusDotColor(status) {
    switch (status) {
        case 'idle': return 'bg-green-500';
        case 'thinking': return 'bg-yellow-500';
        case 'acting': return 'bg-blue-500';
        case 'error': return 'bg-red-500';
        case 'stopped': return 'bg-gray-400';
        default: return 'bg-gray-400';
    }
}
function formatUptime(seconds) {
    if (seconds < 60)
        return `${seconds}s`;
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}m`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
}
