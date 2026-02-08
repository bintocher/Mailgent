import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Bot, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/store';
const STATUS_BADGE = {
    idle: 'badge-green',
    thinking: 'badge-yellow',
    acting: 'badge-blue',
    waiting: 'badge-yellow',
    error: 'badge-red',
    stopped: 'badge-gray',
};
export default function AgentsPage() {
    const agents = useStore((s) => s.agents);
    const groups = useStore((s) => s.groups);
    const fetchAgents = useStore((s) => s.fetchAgents);
    const fetchGroups = useStore((s) => s.fetchGroups);
    const createAgent = useStore((s) => s.createAgent);
    const updateAgent = useStore((s) => s.updateAgent);
    const [expandedId, setExpandedId] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [editPrompt, setEditPrompt] = useState('');
    // Create form state
    const [form, setForm] = useState({
        name: '',
        email: '',
        type: 'worker',
        systemPrompt: '',
        description: '',
    });
    useEffect(() => {
        fetchAgents();
        fetchGroups();
    }, [fetchAgents, fetchGroups]);
    const handleExpand = (agent) => {
        if (expandedId === agent.id) {
            setExpandedId(null);
        }
        else {
            setExpandedId(agent.id);
            setEditPrompt(agent.systemPrompt);
        }
    };
    const handleSavePrompt = (agentId) => {
        updateAgent(agentId, { systemPrompt: editPrompt });
        setExpandedId(null);
    };
    const handleCreate = () => {
        if (!form.name || !form.email)
            return;
        createAgent(form);
        setShowCreate(false);
        setForm({ name: '', email: '', type: 'worker', systemPrompt: '', description: '' });
    };
    const getGroupName = (groupId) => {
        if (!groupId)
            return null;
        return groups.find((g) => g.id === groupId)?.name ?? null;
    };
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h1", { className: "text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2", children: [_jsx(Bot, { className: "w-6 h-6" }), "Agents"] }), _jsxs("button", { onClick: () => setShowCreate(true), className: "btn-primary flex items-center gap-1.5", children: [_jsx(Plus, { className: "w-4 h-4" }), "Create Agent"] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", children: [agents.map((agent) => (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h3", { className: "font-semibold text-gray-900 dark:text-white truncate", children: agent.name }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400 truncate", children: agent.email })] }), _jsxs("div", { className: "flex items-center gap-2 flex-shrink-0 ml-2", children: [_jsx("span", { className: STATUS_BADGE[agent.status], children: agent.status }), _jsx("span", { className: "badge-gray", children: agent.type })] })] }), agent.description && (_jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2", children: agent.description })), _jsxs("div", { className: "flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400", children: [getGroupName(agent.groupId) && (_jsx("span", { className: "badge-blue", children: getGroupName(agent.groupId) })), agent.toolIds.length > 0 && (_jsxs("span", { className: "text-gray-400", children: [agent.toolIds.length, " tools"] })), agent.skillIds.length > 0 && (_jsxs("span", { className: "text-gray-400", children: [agent.skillIds.length, " skills"] }))] }), _jsx("button", { onClick: () => handleExpand(agent), className: "mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1", children: expandedId === agent.id ? (_jsxs(_Fragment, { children: [_jsx(ChevronUp, { className: "w-3.5 h-3.5" }), " Hide prompt"] })) : (_jsxs(_Fragment, { children: [_jsx(ChevronDown, { className: "w-3.5 h-3.5" }), " Show prompt"] })) }), expandedId === agent.id && (_jsxs("div", { className: "mt-3 space-y-2 border-t border-gray-200 dark:border-gray-800 pt-3", children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300", children: "System Prompt" }), _jsx("textarea", { value: editPrompt, onChange: (e) => setEditPrompt(e.target.value), rows: 6, className: "input font-mono text-sm" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => handleSavePrompt(agent.id), className: "btn-primary text-sm", children: "Save" }), _jsx("button", { onClick: () => setExpandedId(null), className: "btn-secondary text-sm", children: "Cancel" })] })] }))] }, agent.id))), agents.length === 0 && (_jsx("p", { className: "text-gray-500 dark:text-gray-400 col-span-full text-center py-12", children: "No agents yet. Create one to get started." }))] }), showCreate && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-gray-900 dark:text-white", children: "Create Agent" }), _jsx("button", { onClick: () => setShowCreate(false), className: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Name" }), _jsx("input", { type: "text", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), placeholder: "Agent name", className: "input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Email" }), _jsx("input", { type: "email", value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }), placeholder: "agent@company.local", className: "input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Type" }), _jsxs("select", { value: form.type, onChange: (e) => setForm({ ...form, type: e.target.value }), className: "input", children: [_jsx("option", { value: "worker", children: "Worker" }), _jsx("option", { value: "lead", children: "Lead" }), _jsx("option", { value: "system", children: "System" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Description" }), _jsx("input", { type: "text", value: form.description, onChange: (e) => setForm({ ...form, description: e.target.value }), placeholder: "What does this agent do?", className: "input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Group" }), _jsxs("select", { value: form.groupId || '', onChange: (e) => setForm({ ...form, groupId: e.target.value || undefined }), className: "input", children: [_jsx("option", { value: "", children: "None" }), groups.map((g) => (_jsx("option", { value: g.id, children: g.name }, g.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "System Prompt" }), _jsx("textarea", { value: form.systemPrompt, onChange: (e) => setForm({ ...form, systemPrompt: e.target.value }), rows: 4, placeholder: "Instructions for the agent...", className: "input font-mono text-sm" })] })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx("button", { onClick: () => setShowCreate(false), className: "btn-secondary", children: "Cancel" }), _jsx("button", { onClick: handleCreate, className: "btn-primary", children: "Create" })] })] }) }))] }));
}
