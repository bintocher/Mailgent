import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useRef, useCallback } from 'react';
import { MessageSquare, Send, FolderOpen, Settings, ChevronDown, ChevronRight, Wrench, Brain, CheckCircle, XCircle, Loader2, ArrowUp, Folder } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore } from '@/store';
import { browseDirectories } from '@/api/http-client';
// ---------------------------------------------------------------------------
// CollapsibleSteps
// ---------------------------------------------------------------------------
function CollapsibleSteps({ steps, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    const toolCalls = steps.filter(s => s.type === 'tool_call');
    const toolNames = [...new Set(toolCalls.map(s => s.toolName).filter(Boolean))];
    const allResults = steps.filter(s => s.type === 'tool_result');
    const allSuccess = allResults.length > 0 && allResults.every(s => s.success);
    const hasErrors = allResults.some(s => s.success === false);
    const summary = toolNames.length > 0
        ? `Used ${toolNames.length} tool${toolNames.length > 1 ? 's' : ''}: ${toolNames.join(', ')}`
        : `${steps.length} step${steps.length > 1 ? 's' : ''}`;
    return (_jsxs("div", { className: "mb-2", children: [_jsxs("button", { onClick: () => setOpen(!open), className: "flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors", children: [open ? _jsx(ChevronDown, { className: "w-3.5 h-3.5" }) : _jsx(ChevronRight, { className: "w-3.5 h-3.5" }), _jsx(Wrench, { className: "w-3.5 h-3.5" }), _jsx("span", { children: summary }), allSuccess && _jsx(CheckCircle, { className: "w-3.5 h-3.5 text-green-500" }), hasErrors && _jsx(XCircle, { className: "w-3.5 h-3.5 text-red-500" })] }), open && (_jsx("div", { className: "mt-1.5 ml-5 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-3", children: steps.map((step) => (_jsxs("div", { className: "text-xs", children: [step.type === 'thinking' && (_jsxs("div", { className: "flex items-start gap-1.5 text-purple-600 dark:text-purple-400", children: [_jsx(Brain, { className: "w-3.5 h-3.5 mt-0.5 flex-shrink-0" }), _jsx("span", { className: "text-gray-600 dark:text-gray-400 line-clamp-2", children: step.content })] })), step.type === 'tool_call' && (_jsxs("div", { className: "flex items-center gap-1.5 text-blue-600 dark:text-blue-400", children: [_jsx(Wrench, { className: "w-3.5 h-3.5 flex-shrink-0" }), _jsx("span", { className: "font-medium", children: step.toolName }), step.toolArgs && Object.keys(step.toolArgs).length > 0 && (_jsxs("span", { className: "text-gray-400 dark:text-gray-500 truncate max-w-xs", children: ["(", Object.entries(step.toolArgs).map(([k, v]) => `${k}: ${typeof v === 'string' ? v.slice(0, 40) : JSON.stringify(v).slice(0, 40)}`).join(', '), ")"] }))] })), step.type === 'tool_result' && (_jsxs("div", { className: "flex items-center gap-1.5", children: [step.success ? (_jsx(CheckCircle, { className: "w-3.5 h-3.5 text-green-500 flex-shrink-0" })) : (_jsx(XCircle, { className: "w-3.5 h-3.5 text-red-500 flex-shrink-0" })), _jsx("span", { className: "text-gray-500 dark:text-gray-400", children: step.toolName }), step.durationMs !== undefined && (_jsxs("span", { className: "text-gray-400 dark:text-gray-500", children: [step.durationMs, "ms"] }))] }))] }, step.id))) }))] }));
}
// ---------------------------------------------------------------------------
// FolderBrowser
// ---------------------------------------------------------------------------
function FolderBrowser({ onSelect }) {
    const [currentPath, setCurrentPath] = useState('');
    const [parentPath, setParentPath] = useState('');
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [manualPath, setManualPath] = useState('');
    const browse = useCallback(async (dirPath) => {
        setLoading(true);
        setError('');
        try {
            const result = await browseDirectories(dirPath);
            setCurrentPath(result.path);
            setParentPath(result.parent);
            setEntries(result.entries);
            setManualPath(result.path);
        }
        catch (err) {
            setError(err?.body?.error || err?.message || 'Failed to browse');
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        browse();
    }, [browse]);
    return (_jsxs("div", { className: "w-full max-w-lg mx-auto", children: [_jsxs("div", { className: "flex gap-2 mb-3", children: [_jsx("input", { type: "text", value: manualPath, onChange: (e) => setManualPath(e.target.value), onKeyDown: (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                browse(manualPath);
                            }
                        }, placeholder: "/path/to/folder", className: "input flex-1 font-mono text-sm" }), _jsx("button", { onClick: () => browse(manualPath), disabled: loading, className: "btn-secondary text-sm px-3", children: "Go" })] }), _jsxs("div", { className: "border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto bg-white dark:bg-gray-900", children: [currentPath !== parentPath && (_jsxs("button", { onClick: () => browse(parentPath), className: "w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800", children: [_jsx(ArrowUp, { className: "w-4 h-4" }), _jsx("span", { children: ".." })] })), loading && (_jsx("div", { className: "flex items-center justify-center py-8 text-gray-400", children: _jsx(Loader2, { className: "w-5 h-5 animate-spin" }) })), !loading && entries.length === 0 && (_jsx("div", { className: "text-center py-6 text-sm text-gray-400", children: "No subdirectories" })), !loading && entries.map((entry) => (_jsxs("button", { onClick: () => browse(entry.path), className: "w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0", children: [_jsx(Folder, { className: "w-4 h-4 text-blue-500 flex-shrink-0" }), _jsx("span", { className: "truncate", children: entry.name })] }, entry.path)))] }), error && (_jsx("p", { className: "text-sm text-red-500 mt-2", children: error })), _jsxs("div", { className: "mt-3 flex items-center gap-2", children: [_jsx("div", { className: "flex-1 text-xs text-gray-500 dark:text-gray-400 font-mono truncate", children: currentPath }), _jsx("button", { onClick: () => onSelect(currentPath), disabled: !currentPath || loading, className: "btn-primary text-sm whitespace-nowrap", children: "Select Folder" })] })] }));
}
// ---------------------------------------------------------------------------
// ChatPage
// ---------------------------------------------------------------------------
export default function ChatPage() {
    const messages = useStore((s) => s.chatMessages);
    const streamingContent = useStore((s) => s.streamingContent);
    const isStreaming = useStore((s) => s.isStreaming);
    const agenticSteps = useStore((s) => s.agenticSteps);
    const chatSessionId = useStore((s) => s.chatSessionId);
    const addChatMessage = useStore((s) => s.addChatMessage);
    const setIsStreaming = useStore((s) => s.setIsStreaming);
    const clearStreamingContent = useStore((s) => s.clearStreamingContent);
    const sendChatMessage = useStore((s) => s.sendChatMessage);
    const systemStatus = useStore((s) => s.systemStatus);
    const globalSettings = useStore((s) => s.globalSettings);
    const openProject = useStore((s) => s.openProject);
    const fetchSystemStatus = useStore((s) => s.fetchSystemStatus);
    const fetchGlobalSettings = useStore((s) => s.fetchGlobalSettings);
    const [input, setInput] = useState('');
    const [projectLoading, setProjectLoading] = useState(false);
    const [projectError, setProjectError] = useState('');
    const messagesEndRef = useRef(null);
    useEffect(() => {
        fetchSystemStatus();
        fetchGlobalSettings();
    }, [fetchSystemStatus, fetchGlobalSettings]);
    // Note: chat messages persist in Zustand store across tab switches.
    // fetchChatMessages is only used for loading historical sessions, not on every mount.
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent, agenticSteps]);
    const providers = globalSettings?.providers ?? [];
    const handleSelectFolder = (dir) => {
        if (!dir)
            return;
        setProjectLoading(true);
        setProjectError('');
        openProject(dir)
            .catch((err) => {
            setProjectError(err?.body?.error || err?.message || 'Failed to open project');
        })
            .finally(() => setProjectLoading(false));
    };
    const handleSend = () => {
        const text = input.trim();
        if (!text || isStreaming)
            return;
        addChatMessage({
            id: `temp-${Date.now()}`,
            sessionId: chatSessionId || '',
            role: 'user',
            content: text,
            timestamp: new Date().toISOString(),
        });
        setInput('');
        setIsStreaming(true);
        clearStreamingContent();
        sendChatMessage(text);
    };
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };
    // Gate 1: No working directory selected
    if (!systemStatus?.workDir) {
        return (_jsx("div", { className: "flex items-center justify-center h-full bg-white dark:bg-gray-900", children: _jsxs("div", { className: "text-center max-w-lg mx-auto px-4", children: [_jsx(FolderOpen, { className: "w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" }), _jsx("h2", { className: "text-xl font-semibold text-gray-900 dark:text-white mb-2", children: "Select a project folder" }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400 mb-6", children: "Choose a working directory for agents to operate in." }), projectLoading ? (_jsxs("div", { className: "flex items-center justify-center gap-2 text-gray-500", children: [_jsx(Loader2, { className: "w-5 h-5 animate-spin" }), _jsx("span", { children: "Opening project..." })] })) : (_jsx(FolderBrowser, { onSelect: handleSelectFolder })), projectError && (_jsx("p", { className: "text-sm text-red-500 mt-3", children: projectError }))] }) }));
    }
    // Gate 2: No LLM providers configured
    if (providers.length === 0) {
        return (_jsx("div", { className: "flex items-center justify-center h-full bg-white dark:bg-gray-900", children: _jsxs("div", { className: "text-center max-w-md mx-auto px-4", children: [_jsx(Settings, { className: "w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" }), _jsx("h2", { className: "text-xl font-semibold text-gray-900 dark:text-white mb-2", children: "Configure an LLM provider" }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400 mb-6", children: "Add at least one LLM provider to start chatting with agents." }), _jsxs(Link, { to: "/settings", className: "btn-primary inline-flex items-center gap-1.5", children: [_jsx(Settings, { className: "w-4 h-4" }), "Go to Settings"] })] }) }));
    }
    // Gate 3: Normal chat
    return (_jsxs("div", { className: "flex flex-col h-full bg-white dark:bg-gray-900", children: [_jsxs("div", { className: "flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800", children: [_jsx(MessageSquare, { className: "w-5 h-5 text-gray-500" }), _jsx("span", { className: "text-sm font-medium text-gray-700 dark:text-gray-300", children: "Chat with Master Agent" }), chatSessionId && (_jsxs("span", { className: "text-xs text-gray-400 dark:text-gray-500 font-mono", children: [chatSessionId.slice(0, 12), "..."] }))] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4 space-y-4", children: [messages.length === 0 && !streamingContent && (_jsx("div", { className: "flex items-center justify-center h-full text-gray-400 dark:text-gray-500", children: _jsxs("div", { className: "text-center", children: [_jsx(MessageSquare, { className: "w-12 h-12 mx-auto mb-3 opacity-50" }), _jsx("p", { children: "Start a conversation" }), _jsx("p", { className: "text-sm mt-1", children: "Type a message below to begin chatting with agents." })] }) })), messages.map((msg) => (_jsxs("div", { children: [msg.role === 'assistant' && Array.isArray(msg.metadata?.agenticSteps) && (_jsx("div", { className: "flex justify-start mb-1", children: _jsx("div", { className: "max-w-2xl", children: _jsx(CollapsibleSteps, { steps: msg.metadata.agenticSteps }) }) })), _jsx("div", { className: `flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`, children: _jsxs("div", { className: `max-w-2xl rounded-2xl px-4 py-3 ${msg.role === 'user'
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}`, children: [msg.role === 'user' ? (_jsx("p", { className: "text-sm whitespace-pre-wrap", children: msg.content })) : (_jsx("div", { className: "prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-code:text-primary-700 dark:prose-code:text-primary-300 prose-pre:bg-gray-200 dark:prose-pre:bg-gray-700 prose-pre:rounded-lg", children: _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], children: msg.content }) })), _jsx("p", { className: `text-xs mt-1.5 ${msg.role === 'user'
                                                ? 'text-primary-200'
                                                : 'text-gray-400 dark:text-gray-500'}`, children: new Date(msg.timestamp).toLocaleTimeString([], {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            }) })] }) })] }, msg.id))), isStreaming && agenticSteps.length > 0 && (_jsx("div", { className: "flex justify-start", children: _jsx("div", { className: "max-w-2xl", children: _jsx(CollapsibleSteps, { steps: agenticSteps, defaultOpen: true }) }) })), isStreaming && !streamingContent && (_jsx("div", { className: "flex justify-start", children: _jsxs("div", { className: "flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm px-4 py-2", children: [_jsx(Loader2, { className: "w-4 h-4 animate-spin" }), _jsx("span", { children: agenticSteps.length > 0 ? 'Working...' : 'Thinking...' })] }) })), streamingContent && (_jsx("div", { className: "flex justify-start", children: _jsxs("div", { className: "max-w-2xl rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100", children: [_jsx("div", { className: "prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-code:text-primary-700 dark:prose-code:text-primary-300 prose-pre:bg-gray-200 dark:prose-pre:bg-gray-700 prose-pre:rounded-lg", children: _jsx(ReactMarkdown, { remarkPlugins: [remarkGfm], children: streamingContent }) }), _jsx("span", { className: "inline-block w-2 h-4 bg-gray-400 dark:bg-gray-500 animate-pulse ml-0.5" })] }) })), _jsx("div", { ref: messagesEndRef })] }), _jsx("div", { className: "border-t border-gray-200 dark:border-gray-800 p-4", children: _jsxs("div", { className: "flex items-end gap-3 max-w-4xl mx-auto", children: [_jsx("textarea", { value: input, onChange: (e) => setInput(e.target.value), onKeyDown: handleKeyDown, placeholder: "Type a message...", rows: 1, className: "input resize-none min-h-[42px] max-h-40" }), _jsxs("button", { onClick: handleSend, disabled: !input.trim() || isStreaming, className: "btn-primary flex items-center gap-1.5 flex-shrink-0", children: [_jsx(Send, { className: "w-4 h-4" }), isStreaming ? '...' : 'Send'] })] }) })] }));
}
