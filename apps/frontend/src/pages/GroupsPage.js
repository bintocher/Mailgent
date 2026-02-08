import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Users, Plus, X, UserMinus, UserPlus } from 'lucide-react';
import { useStore } from '@/store';
export default function GroupsPage() {
    const groups = useStore((s) => s.groups);
    const agents = useStore((s) => s.agents);
    const fetchGroups = useStore((s) => s.fetchGroups);
    const fetchAgents = useStore((s) => s.fetchAgents);
    const createGroup = useStore((s) => s.createGroup);
    const updateGroup = useStore((s) => s.updateGroup);
    const [managingGroup, setManagingGroup] = useState(null);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        name: '',
        description: '',
        email: '',
        specializations: '',
        maxMembers: 10,
    });
    useEffect(() => {
        fetchGroups();
        fetchAgents();
    }, [fetchGroups, fetchAgents]);
    const getLeadName = (leadAgentId) => {
        if (!leadAgentId)
            return 'None';
        return agents.find((a) => a.id === leadAgentId)?.name ?? 'Unknown';
    };
    const getMemberAgents = (memberIds) => {
        return agents.filter((a) => memberIds.includes(a.id));
    };
    const getNonMembers = (group) => {
        return agents.filter((a) => !group.memberAgentIds.includes(a.id));
    };
    const handleCreate = () => {
        if (!form.name || !form.email)
            return;
        createGroup({
            name: form.name,
            description: form.description,
            email: form.email,
            specializations: form.specializations
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            maxMembers: form.maxMembers,
            memberAgentIds: [],
            projectId: 'default',
        });
        setShowCreate(false);
        setForm({ name: '', description: '', email: '', specializations: '', maxMembers: 10 });
    };
    const handleAddMember = (groupId, agentId) => {
        const group = groups.find((g) => g.id === groupId);
        if (!group)
            return;
        updateGroup(groupId, {
            memberAgentIds: [...group.memberAgentIds, agentId],
        });
        // Update local managing state
        setManagingGroup((prev) => prev ? { ...prev, memberAgentIds: [...prev.memberAgentIds, agentId] } : null);
    };
    const handleRemoveMember = (groupId, agentId) => {
        const group = groups.find((g) => g.id === groupId);
        if (!group)
            return;
        updateGroup(groupId, {
            memberAgentIds: group.memberAgentIds.filter((id) => id !== agentId),
        });
        setManagingGroup((prev) => prev
            ? { ...prev, memberAgentIds: prev.memberAgentIds.filter((id) => id !== agentId) }
            : null);
    };
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h1", { className: "text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2", children: [_jsx(Users, { className: "w-6 h-6" }), "Groups"] }), _jsxs("button", { onClick: () => setShowCreate(true), className: "btn-primary flex items-center gap-1.5", children: [_jsx(Plus, { className: "w-4 h-4" }), "Create Group"] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4", children: [groups.map((group) => (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("h3", { className: "font-semibold text-gray-900 dark:text-white truncate", children: group.name }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400 truncate", children: group.email })] }), _jsxs("span", { className: "badge-blue flex-shrink-0 ml-2", children: [group.memberAgentIds.length, " members"] })] }), group.description && (_jsx("p", { className: "text-sm text-gray-600 dark:text-gray-400 mt-2", children: group.description })), group.specializations.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5 mt-3", children: group.specializations.map((spec) => (_jsx("span", { className: "badge-gray", children: spec }, spec))) })), _jsxs("div", { className: "mt-3 text-sm text-gray-500 dark:text-gray-400", children: [_jsx("span", { className: "font-medium text-gray-700 dark:text-gray-300", children: "Lead:" }), ' ', getLeadName(group.leadAgentId)] }), _jsx("button", { onClick: () => setManagingGroup(group), className: "mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline", children: "Manage members" })] }, group.id))), groups.length === 0 && (_jsx("p", { className: "text-gray-500 dark:text-gray-400 col-span-full text-center py-12", children: "No groups yet. Create one to organize your agents." }))] }), managingGroup && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h2", { className: "text-lg font-bold text-gray-900 dark:text-white", children: [managingGroup.name, " - Members"] }), _jsx("button", { onClick: () => setManagingGroup(null), className: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { children: [_jsxs("h3", { className: "text-sm font-medium text-gray-700 dark:text-gray-300 mb-2", children: ["Current Members (", managingGroup.memberAgentIds.length, ")"] }), getMemberAgents(managingGroup.memberAgentIds).length === 0 ? (_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "No members yet." })) : (_jsx("div", { className: "space-y-2", children: getMemberAgents(managingGroup.memberAgentIds).map((agent) => (_jsxs("div", { className: "flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-900 dark:text-white", children: agent.name }), _jsx("p", { className: "text-xs text-gray-500 dark:text-gray-400", children: agent.email })] }), _jsx("button", { onClick: () => handleRemoveMember(managingGroup.id, agent.id), className: "text-red-500 hover:text-red-700 p-1", children: _jsx(UserMinus, { className: "w-4 h-4" }) })] }, agent.id))) }))] }), _jsxs("div", { children: [_jsx("h3", { className: "text-sm font-medium text-gray-700 dark:text-gray-300 mb-2", children: "Available Agents" }), getNonMembers(managingGroup).length === 0 ? (_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "All agents are already members." })) : (_jsx("div", { className: "space-y-2 max-h-48 overflow-y-auto", children: getNonMembers(managingGroup).map((agent) => (_jsxs("div", { className: "flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-gray-900 dark:text-white", children: agent.name }), _jsx("p", { className: "text-xs text-gray-500 dark:text-gray-400", children: agent.email })] }), _jsx("button", { onClick: () => handleAddMember(managingGroup.id, agent.id), className: "text-green-500 hover:text-green-700 p-1", children: _jsx(UserPlus, { className: "w-4 h-4" }) })] }, agent.id))) }))] }), _jsx("div", { className: "flex justify-end pt-2", children: _jsx("button", { onClick: () => setManagingGroup(null), className: "btn-secondary", children: "Done" }) })] }) })), showCreate && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-gray-900 dark:text-white", children: "Create Group" }), _jsx("button", { onClick: () => setShowCreate(false), className: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Name" }), _jsx("input", { type: "text", value: form.name, onChange: (e) => setForm({ ...form, name: e.target.value }), placeholder: "Group name", className: "input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Email" }), _jsx("input", { type: "email", value: form.email, onChange: (e) => setForm({ ...form, email: e.target.value }), placeholder: "group@company.local", className: "input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Description" }), _jsx("input", { type: "text", value: form.description, onChange: (e) => setForm({ ...form, description: e.target.value }), placeholder: "What does this group do?", className: "input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Specializations (comma-separated)" }), _jsx("input", { type: "text", value: form.specializations, onChange: (e) => setForm({ ...form, specializations: e.target.value }), placeholder: "coding, testing, reviews", className: "input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Max Members" }), _jsx("input", { type: "number", value: form.maxMembers, onChange: (e) => setForm({ ...form, maxMembers: Number(e.target.value) }), min: 1, className: "input" })] })] }), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx("button", { onClick: () => setShowCreate(false), className: "btn-secondary", children: "Cancel" }), _jsx("button", { onClick: handleCreate, className: "btn-primary", children: "Create" })] })] }) }))] }));
}
