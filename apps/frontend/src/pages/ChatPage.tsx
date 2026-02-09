import { useEffect, useState, useRef, useCallback } from 'react';
import { MessageSquare, Send, FolderOpen, Settings, ChevronDown, ChevronRight, Wrench, Brain, CheckCircle, XCircle, Loader2, ArrowUp, Folder, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useStore } from '@/store';
import type { ChatStep } from '@/store';
import { browseDirectories, type BrowseEntry } from '@/api/http-client';

// ---------------------------------------------------------------------------
// CollapsibleSteps
// ---------------------------------------------------------------------------

function CollapsibleSteps({ steps, defaultOpen = false }: { steps: ChatStep[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  const toolCalls = steps.filter(s => s.type === 'tool_call');
  const toolNames = [...new Set(toolCalls.map(s => s.toolName).filter(Boolean))];
  const allResults = steps.filter(s => s.type === 'tool_result');
  const allSuccess = allResults.length > 0 && allResults.every(s => s.success);
  const hasErrors = allResults.some(s => s.success === false);

  const summary = toolNames.length > 0
    ? `Used ${toolNames.length} tool${toolNames.length > 1 ? 's' : ''}: ${toolNames.join(', ')}`
    : `${steps.length} step${steps.length > 1 ? 's' : ''}`;

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <Wrench className="w-3.5 h-3.5" />
        <span>{summary}</span>
        {allSuccess && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
        {hasErrors && <XCircle className="w-3.5 h-3.5 text-red-500" />}
      </button>

      {open && (
        <div className="mt-1.5 ml-5 space-y-1 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
          {steps.map((step) => (
            <div key={step.id} className="text-xs">
              {step.type === 'thinking' && (
                <div className="flex items-start gap-1.5 text-purple-600 dark:text-purple-400">
                  <Brain className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400 line-clamp-2">{step.content}</span>
                </div>
              )}
              {step.type === 'tool_call' && (
                <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                  <Wrench className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-medium">{step.toolName}</span>
                  {step.toolArgs && Object.keys(step.toolArgs).length > 0 && (
                    <span className="text-gray-400 dark:text-gray-500 truncate max-w-xs">
                      ({Object.entries(step.toolArgs).map(([k, v]) =>
                        `${k}: ${typeof v === 'string' ? v.slice(0, 40) : JSON.stringify(v).slice(0, 40)}`
                      ).join(', ')})
                    </span>
                  )}
                </div>
              )}
              {step.type === 'tool_result' && (
                <div className="flex items-center gap-1.5">
                  {step.success ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  )}
                  <span className="text-gray-500 dark:text-gray-400">{step.toolName}</span>
                  {step.durationMs !== undefined && (
                    <span className="text-gray-400 dark:text-gray-500">{step.durationMs}ms</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FolderBrowser
// ---------------------------------------------------------------------------

function FolderBrowser({ onSelect }: { onSelect: (path: string) => void }) {
  const [currentPath, setCurrentPath] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [entries, setEntries] = useState<BrowseEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualPath, setManualPath] = useState('');

  const browse = useCallback(async (dirPath?: string) => {
    setLoading(true);
    setError('');
    try {
      const result = await browseDirectories(dirPath);
      setCurrentPath(result.path);
      setParentPath(result.parent);
      setEntries(result.entries);
      setManualPath(result.path);
    } catch (err: any) {
      setError(err?.body?.error || err?.message || 'Failed to browse');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    browse();
  }, [browse]);

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Path input + Go */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={manualPath}
          onChange={(e) => setManualPath(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              browse(manualPath);
            }
          }}
          placeholder="/path/to/folder"
          className="input flex-1 font-mono text-sm"
        />
        <button
          onClick={() => browse(manualPath)}
          disabled={loading}
          className="btn-secondary text-sm px-3"
        >
          Go
        </button>
      </div>

      {/* Directory listing */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-y-auto bg-white dark:bg-gray-900">
        {/* Up button */}
        {currentPath !== parentPath && (
          <button
            onClick={() => browse(parentPath)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800"
          >
            <ArrowUp className="w-4 h-4" />
            <span>..</span>
          </button>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}

        {!loading && entries.length === 0 && (
          <div className="text-center py-6 text-sm text-gray-400">
            No subdirectories
          </div>
        )}

        {!loading && entries.map((entry) => (
          <button
            key={entry.path}
            onClick={() => browse(entry.path)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
          >
            <Folder className="w-4 h-4 text-blue-500 flex-shrink-0" />
            <span className="truncate">{entry.name}</span>
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-500 mt-2">{error}</p>
      )}

      {/* Current path display + Select button */}
      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
          {currentPath}
        </div>
        <button
          onClick={() => onSelect(currentPath)}
          disabled={!currentPath || loading}
          className="btn-primary text-sm whitespace-nowrap"
        >
          Select Folder
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatSidebar
// ---------------------------------------------------------------------------

interface ChatSidebarProps {
  sessions: Array<{ id: string; title: string; createdAt: string; messageCount: number }>;
  loading: boolean;
  activeSessionId: string | null;
  onFetch: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNewChat: () => void;
}

function ChatSidebar({ sessions, loading, activeSessionId, onFetch, onSelect, onDelete, onNewChat }: ChatSidebarProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    onFetch();
  }, [onFetch]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-64 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* New chat button */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Sessions list */}
      <div className="flex-1 overflow-y-auto">
        {loading && sessions.length === 0 && (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="text-center py-8 text-xs text-gray-400 dark:text-gray-500 px-3">
            No previous sessions
          </div>
        )}

        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`w-full text-left px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 group transition-colors ${
              activeSessionId === session.id
                ? 'bg-primary-50 dark:bg-primary-900/20 border-l-2 border-l-primary-500'
                : 'hover:bg-gray-100 dark:hover:bg-gray-900'
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate flex-1">
                {session.title}
              </p>
              <button
                onClick={(e) => handleDelete(e, session.id)}
                disabled={deletingId === session.id}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                title="Delete session"
              >
                {deletingId === session.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {new Date(session.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {session.messageCount} msg{session.messageCount !== 1 ? 's' : ''}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
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

  const chatSessions = useStore((s) => s.chatSessions);
  const chatSessionsLoading = useStore((s) => s.chatSessionsLoading);
  const fetchChatSessions = useStore((s) => s.fetchChatSessions);
  const deleteChatSession = useStore((s) => s.deleteChatSession);
  const selectChatSession = useStore((s) => s.selectChatSession);
  const startNewChatSession = useStore((s) => s.startNewChatSession);

  const systemStatus = useStore((s) => s.systemStatus);
  const globalSettings = useStore((s) => s.globalSettings);
  const openProject = useStore((s) => s.openProject);
  const fetchSystemStatus = useStore((s) => s.fetchSystemStatus);
  const fetchGlobalSettings = useStore((s) => s.fetchGlobalSettings);

  const [input, setInput] = useState('');
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const handleSelectFolder = (dir: string) => {
    if (!dir) return;
    setProjectLoading(true);
    setProjectError('');
    openProject(dir)
      .catch((err: any) => {
        setProjectError(
          err?.body?.error || err?.message || 'Failed to open project'
        );
      })
      .finally(() => setProjectLoading(false));
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Gate 1: No working directory selected
  if (!systemStatus?.workDir) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900">
        <div className="text-center max-w-lg mx-auto px-4">
          <FolderOpen className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Select a project folder
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Choose a working directory for agents to operate in.
          </p>

          {projectLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Opening project...</span>
            </div>
          ) : (
            <FolderBrowser onSelect={handleSelectFolder} />
          )}

          {projectError && (
            <p className="text-sm text-red-500 mt-3">{projectError}</p>
          )}
        </div>
      </div>
    );
  }

  // Gate 2: No LLM providers configured
  if (providers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-white dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto px-4">
          <Settings className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Configure an LLM provider
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Add at least one LLM provider to start chatting with agents.
          </p>
          <Link to="/settings" className="btn-primary inline-flex items-center gap-1.5">
            <Settings className="w-4 h-4" />
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  // Gate 3: Normal chat
  return (
    <div className="flex h-full bg-white dark:bg-gray-900">
      {/* Sidebar */}
      <ChatSidebar
        sessions={chatSessions}
        loading={chatSessionsLoading}
        activeSessionId={chatSessionId}
        onFetch={fetchChatSessions}
        onSelect={selectChatSession}
        onDelete={deleteChatSession}
        onNewChat={startNewChatSession}
      />

      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <MessageSquare className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Chat with Master Agent
          </span>
          {chatSessionId && (
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
              {chatSessionId.slice(0, 12)}...
            </span>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingContent && (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Start a conversation</p>
              <p className="text-sm mt-1">Type a message below to begin chatting with agents.</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {msg.role === 'assistant' && Array.isArray(msg.metadata?.agenticSteps) && (
              <div className="flex justify-start mb-1">
                <div className="max-w-2xl">
                  <CollapsibleSteps steps={msg.metadata.agenticSteps as ChatStep[]} />
                </div>
              </div>
            )}
            <div
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-2xl rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-code:text-primary-700 dark:prose-code:text-primary-300 prose-pre:bg-gray-200 dark:prose-pre:bg-gray-700 prose-pre:rounded-lg">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
                <p
                  className={`text-xs mt-1.5 ${
                    msg.role === 'user'
                      ? 'text-primary-200'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}

        {/* Active agentic steps (during streaming) */}
        {isStreaming && agenticSteps.length > 0 && (
          <div className="flex justify-start">
            <div className="max-w-2xl">
              <CollapsibleSteps steps={agenticSteps} defaultOpen={true} />
            </div>
          </div>
        )}

        {/* Streaming indicator when agent is working */}
        {isStreaming && !streamingContent && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm px-4 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{agenticSteps.length > 0 ? 'Working...' : 'Thinking...'}</span>
            </div>
          </div>
        )}

        {/* Streaming content */}
        {streamingContent && (
          <div className="flex justify-start">
            <div className="max-w-2xl rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-code:text-primary-700 dark:prose-code:text-primary-300 prose-pre:bg-gray-200 dark:prose-pre:bg-gray-700 prose-pre:rounded-lg">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {streamingContent}
                </ReactMarkdown>
              </div>
              <span className="inline-block w-2 h-4 bg-gray-400 dark:bg-gray-500 animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

        {/* Input area */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-end gap-3 max-w-4xl mx-auto">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows={1}
              className="input resize-none min-h-[42px] max-h-40"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              className="btn-primary flex items-center gap-1.5 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
              {isStreaming ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
