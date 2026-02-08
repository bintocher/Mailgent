import { useEffect, useState } from 'react';
import { Bot, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '@/store';
import type { Agent, AgentCreateParams, AgentStatus } from '@mailgent/shared';

const STATUS_BADGE: Record<AgentStatus, string> = {
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

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');

  // Create form state
  const [form, setForm] = useState<AgentCreateParams>({
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

  const handleExpand = (agent: Agent) => {
    if (expandedId === agent.id) {
      setExpandedId(null);
    } else {
      setExpandedId(agent.id);
      setEditPrompt(agent.systemPrompt);
    }
  };

  const handleSavePrompt = (agentId: string) => {
    updateAgent(agentId, { systemPrompt: editPrompt });
    setExpandedId(null);
  };

  const handleCreate = () => {
    if (!form.name || !form.email) return;
    createAgent(form);
    setShowCreate(false);
    setForm({ name: '', email: '', type: 'worker', systemPrompt: '', description: '' });
  };

  const getGroupName = (groupId?: string) => {
    if (!groupId) return null;
    return groups.find((g) => g.id === groupId)?.name ?? null;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Bot className="w-6 h-6" />
          Agents
        </h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Create Agent
        </button>
      </div>

      {/* Agent grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div key={agent.id} className="card">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {agent.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{agent.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                <span className={STATUS_BADGE[agent.status]}>{agent.status}</span>
                <span className="badge-gray">{agent.type}</span>
              </div>
            </div>

            {agent.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
                {agent.description}
              </p>
            )}

            <div className="flex items-center gap-2 mt-3 text-xs text-gray-500 dark:text-gray-400">
              {getGroupName(agent.groupId) && (
                <span className="badge-blue">{getGroupName(agent.groupId)}</span>
              )}
              {agent.toolIds.length > 0 && (
                <span className="text-gray-400">{agent.toolIds.length} tools</span>
              )}
              {agent.skillIds.length > 0 && (
                <span className="text-gray-400">{agent.skillIds.length} skills</span>
              )}
            </div>

            <button
              onClick={() => handleExpand(agent)}
              className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              {expandedId === agent.id ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" /> Hide prompt
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" /> Show prompt
                </>
              )}
            </button>

            {/* Expanded: system prompt editor */}
            {expandedId === agent.id && (
              <div className="mt-3 space-y-2 border-t border-gray-200 dark:border-gray-800 pt-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  System Prompt
                </label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  rows={6}
                  className="input font-mono text-sm"
                />
                <div className="flex gap-2">
                  <button onClick={() => handleSavePrompt(agent.id)} className="btn-primary text-sm">
                    Save
                  </button>
                  <button onClick={() => setExpandedId(null)} className="btn-secondary text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {agents.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-12">
            No agents yet. Create one to get started.
          </p>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Agent</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Agent name"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="agent@company.local"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm({ ...form, type: e.target.value as AgentCreateParams['type'] })
                  }
                  className="input"
                >
                  <option value="worker">Worker</option>
                  <option value="lead">Lead</option>
                  <option value="system">System</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this agent do?"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Group
                </label>
                <select
                  value={form.groupId || ''}
                  onChange={(e) =>
                    setForm({ ...form, groupId: e.target.value || undefined })
                  }
                  className="input"
                >
                  <option value="">None</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  System Prompt
                </label>
                <textarea
                  value={form.systemPrompt}
                  onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
                  rows={4}
                  placeholder="Instructions for the agent..."
                  className="input font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowCreate(false)} className="btn-secondary">
                Cancel
              </button>
              <button onClick={handleCreate} className="btn-primary">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
