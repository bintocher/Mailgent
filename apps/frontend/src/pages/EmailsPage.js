import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Mail, Search, Paperclip, Trash2 } from 'lucide-react';
import { useStore } from '@/store';
export default function EmailsPage() {
    const emails = useStore((s) => s.emails);
    const agents = useStore((s) => s.agents);
    const fetchEmails = useStore((s) => s.fetchEmails);
    const fetchAgents = useStore((s) => s.fetchAgents);
    const deleteAllEmails = useStore((s) => s.deleteAllEmails);
    const [selectedEmail, setSelectedEmail] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [agentFilter, setAgentFilter] = useState('');
    useEffect(() => {
        fetchEmails();
        fetchAgents();
    }, [fetchEmails, fetchAgents]);
    const filteredEmails = emails.filter((email) => {
        const matchesSearch = !searchQuery ||
            email.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
            email.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
            email.body.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesAgent = !agentFilter || email.agentId === agentFilter;
        return matchesSearch && matchesAgent;
    });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-96 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900", children: [_jsxs("div", { className: "p-4 border-b border-gray-200 dark:border-gray-800 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h1", { className: "text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2", children: [_jsx(Mail, { className: "w-5 h-5" }), "Emails"] }), emails.length > 0 && (_jsxs("button", { onClick: () => {
                                            if (confirm('Delete all emails? This cannot be undone.')) {
                                                deleteAllEmails();
                                            }
                                        }, className: "btn-danger text-xs flex items-center gap-1 px-2 py-1", children: [_jsx(Trash2, { className: "w-3.5 h-3.5" }), "Delete All"] }))] }), _jsxs("div", { className: "relative", children: [_jsx(Search, { className: "absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" }), _jsx("input", { type: "text", placeholder: "Search emails...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), className: "input pl-9" })] }), _jsxs("select", { value: agentFilter, onChange: (e) => setAgentFilter(e.target.value), className: "input", children: [_jsx("option", { value: "", children: "All Agents" }), agents.map((agent) => (_jsx("option", { value: agent.id, children: agent.name }, agent.id)))] })] }), _jsx("div", { className: "flex-1 overflow-y-auto", children: filteredEmails.length === 0 ? (_jsx("p", { className: "p-4 text-sm text-gray-500 dark:text-gray-400", children: "No emails found." })) : (filteredEmails.map((email) => (_jsxs("button", { onClick: () => setSelectedEmail(email), className: `w-full text-left p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedEmail?.id === email.id
                                ? 'bg-primary-50 dark:bg-primary-900/20'
                                : ''}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("span", { className: `text-sm truncate ${!email.isRead
                                                ? 'font-bold text-gray-900 dark:text-white'
                                                : 'text-gray-700 dark:text-gray-300'}`, children: email.from }), _jsxs("div", { className: "flex items-center gap-1.5 flex-shrink-0 ml-2", children: [!email.isRead && (_jsx("span", { className: "badge-blue", children: "new" })), _jsx("span", { className: "text-xs text-gray-400 dark:text-gray-500", children: formatTime(email.createdAt) })] })] }), _jsx("p", { className: `text-sm truncate ${!email.isRead
                                        ? 'font-semibold text-gray-900 dark:text-white'
                                        : 'text-gray-600 dark:text-gray-400'}`, children: email.subject }), _jsx("p", { className: "text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5", children: email.body.slice(0, 100) })] }, email.id)))) })] }), _jsx("div", { className: "flex-1 bg-white dark:bg-gray-900 overflow-y-auto", children: selectedEmail ? (_jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-gray-900 dark:text-white", children: selectedEmail.subject }), _jsxs("div", { className: "mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400", children: [_jsxs("p", { children: [_jsx("span", { className: "font-medium text-gray-700 dark:text-gray-300", children: "From:" }), ' ', selectedEmail.from] }), _jsxs("p", { children: [_jsx("span", { className: "font-medium text-gray-700 dark:text-gray-300", children: "To:" }), ' ', selectedEmail.to.join(', ')] }), selectedEmail.cc && selectedEmail.cc.length > 0 && (_jsxs("p", { children: [_jsx("span", { className: "font-medium text-gray-700 dark:text-gray-300", children: "CC:" }), ' ', selectedEmail.cc.join(', ')] })), _jsxs("p", { children: [_jsx("span", { className: "font-medium text-gray-700 dark:text-gray-300", children: "Date:" }), ' ', new Date(selectedEmail.createdAt).toLocaleString()] }), selectedEmail.agentId && (_jsxs("p", { children: [_jsx("span", { className: "font-medium text-gray-700 dark:text-gray-300", children: "Agent:" }), ' ', agents.find((a) => a.id === selectedEmail.agentId)?.name ??
                                                    selectedEmail.agentId] }))] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("span", { className: selectedEmail.isRead ? 'badge-gray' : 'badge-blue', children: selectedEmail.isRead ? 'Read' : 'Unread' }), _jsx("span", { className: selectedEmail.isProcessed ? 'badge-green' : 'badge-yellow', children: selectedEmail.isProcessed ? 'Processed' : 'Pending' }), selectedEmail.priority > 0 && (_jsxs("span", { className: "badge-red", children: ["Priority ", selectedEmail.priority] }))] }), selectedEmail.attachments && selectedEmail.attachments.length > 0 && (_jsxs("div", { className: "border border-gray-200 dark:border-gray-700 rounded-lg p-3", children: [_jsxs("p", { className: "text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5", children: [_jsx(Paperclip, { className: "w-4 h-4" }), "Attachments (", selectedEmail.attachments.length, ")"] }), _jsx("div", { className: "space-y-1", children: selectedEmail.attachments.map((att, i) => (_jsxs("div", { className: "text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2", children: [_jsx("span", { children: att.filename }), _jsxs("span", { className: "text-xs text-gray-400", children: ["(", (att.size / 1024).toFixed(1), " KB)"] })] }, i))) })] })), _jsx("div", { className: "border-t border-gray-200 dark:border-gray-800 pt-4", children: _jsx("pre", { className: "whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300 font-sans", children: selectedEmail.body }) })] })) : (_jsx("div", { className: "flex items-center justify-center h-full text-gray-400 dark:text-gray-500", children: _jsxs("div", { className: "text-center", children: [_jsx(Mail, { className: "w-12 h-12 mx-auto mb-3 opacity-50" }), _jsx("p", { children: "Select an email to view its contents" })] }) })) })] }));
}
function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    if (hours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
