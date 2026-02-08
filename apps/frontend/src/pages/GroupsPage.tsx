import { useEffect, useState } from 'react';
import { Users, Plus, X, UserMinus, UserPlus } from 'lucide-react';
import { useStore } from '@/store';
import type { AgentGroup } from '@mailgent/shared';

export default function GroupsPage() {
  const groups = useStore((s) => s.groups);
  const agents = useStore((s) => s.agents);
  const fetchGroups = useStore((s) => s.fetchGroups);
  const fetchAgents = useStore((s) => s.fetchAgents);
  const createGroup = useStore((s) => s.createGroup);
  const updateGroup = useStore((s) => s.updateGroup);

  const [managingGroup, setManagingGroup] = useState<AgentGroup | null>(null);
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

  const getLeadName = (leadAgentId?: string) => {
    if (!leadAgentId) return 'None';
    return agents.find((a) => a.id === leadAgentId)?.name ?? 'Unknown';
  };

  const getMemberAgents = (memberIds: string[]) => {
    return agents.filter((a) => memberIds.includes(a.id));
  };

  const getNonMembers = (group: AgentGroup) => {
    return agents.filter((a) => !group.memberAgentIds.includes(a.id));
  };

  const handleCreate = () => {
    if (!form.name || !form.email) return;
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

  const handleAddMember = (groupId: string, agentId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    updateGroup(groupId, {
      memberAgentIds: [...group.memberAgentIds, agentId],
    });
    // Update local managing state
    setManagingGroup((prev) =>
      prev ? { ...prev, memberAgentIds: [...prev.memberAgentIds, agentId] } : null
    );
  };

  const handleRemoveMember = (groupId: string, agentId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    updateGroup(groupId, {
      memberAgentIds: group.memberAgentIds.filter((id) => id !== agentId),
    });
    setManagingGroup((prev) =>
      prev
        ? { ...prev, memberAgentIds: prev.memberAgentIds.filter((id) => id !== agentId) }
        : null
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6" />
          Groups
        </h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Create Group
        </button>
      </div>

      {/* Groups grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {groups.map((group) => (
          <div key={group.id} className="card">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {group.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{group.email}</p>
              </div>
              <span className="badge-blue flex-shrink-0 ml-2">
                {group.memberAgentIds.length} members
              </span>
            </div>

            {group.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">{group.description}</p>
            )}

            {/* Specializations */}
            {group.specializations.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {group.specializations.map((spec) => (
                  <span key={spec} className="badge-gray">
                    {spec}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-700 dark:text-gray-300">Lead:</span>{' '}
              {getLeadName(group.leadAgentId)}
            </div>

            <button
              onClick={() => setManagingGroup(group)}
              className="mt-3 text-sm text-primary-600 dark:text-primary-400 hover:underline"
            >
              Manage members
            </button>
          </div>
        ))}

        {groups.length === 0 && (
          <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-12">
            No groups yet. Create one to organize your agents.
          </p>
        )}
      </div>

      {/* Manage members modal */}
      {managingGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {managingGroup.name} - Members
              </h2>
              <button
                onClick={() => setManagingGroup(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current members */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Members ({managingGroup.memberAgentIds.length})
              </h3>
              {getMemberAgents(managingGroup.memberAgentIds).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No members yet.</p>
              ) : (
                <div className="space-y-2">
                  {getMemberAgents(managingGroup.memberAgentIds).map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {agent.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{agent.email}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveMember(managingGroup.id, agent.id)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <UserMinus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available agents */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Available Agents
              </h3>
              {getNonMembers(managingGroup).length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  All agents are already members.
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {getNonMembers(managingGroup).map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {agent.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{agent.email}</p>
                      </div>
                      <button
                        onClick={() => handleAddMember(managingGroup.id, agent.id)}
                        className="text-green-500 hover:text-green-700 p-1"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setManagingGroup(null)} className="btn-secondary">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create group modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Group</h2>
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
                  placeholder="Group name"
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
                  placeholder="group@company.local"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="What does this group do?"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Specializations (comma-separated)
                </label>
                <input
                  type="text"
                  value={form.specializations}
                  onChange={(e) => setForm({ ...form, specializations: e.target.value })}
                  placeholder="coding, testing, reviews"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Members
                </label>
                <input
                  type="number"
                  value={form.maxMembers}
                  onChange={(e) => setForm({ ...form, maxMembers: Number(e.target.value) })}
                  min={1}
                  className="input"
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
