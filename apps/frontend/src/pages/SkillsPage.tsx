import { useEffect, useState } from 'react';
import { Zap, Plus, X, ChevronRight } from 'lucide-react';
import { useStore } from '@/store';
import type { SkillDefinition } from '@mailgent/shared';

export default function SkillsPage() {
  const skills = useStore((s) => s.skills);
  const fetchSkills = useStore((s) => s.fetchSkills);
  const createSkill = useStore((s) => s.createSkill);
  const updateSkill = useStore((s) => s.updateSkill);

  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    triggerPattern: '',
    instructions: '',
  });

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleToggle = (skill: SkillDefinition) => {
    updateSkill(skill.id, { isEnabled: !skill.isEnabled });
  };

  const handleCreate = () => {
    if (!form.name) return;
    createSkill({
      name: form.name,
      description: form.description,
      triggerPattern: form.triggerPattern,
      instructions: form.instructions,
      requiredToolIds: [],
      isBuiltin: false,
      isEnabled: true,
    });
    setShowCreate(false);
    setForm({ name: '', description: '', triggerPattern: '', instructions: '' });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Zap className="w-6 h-6" />
          Skills
        </h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Create Skill
        </button>
      </div>

      <div className="flex gap-6">
        {/* Skills table */}
        <div className="flex-1 card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Trigger Pattern
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Tools
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Type
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Enabled
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {skills.map((skill) => (
                <tr
                  key={skill.id}
                  onClick={() => setSelectedSkill(skill)}
                  className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    selectedSkill?.id === skill.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          selectedSkill?.id === skill.id ? 'rotate-90' : ''
                        }`}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {skill.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                      {skill.triggerPattern || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-gray">{skill.requiredToolIds.length} tools</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={skill.isBuiltin ? 'badge-blue' : 'badge-yellow'}>
                      {skill.isBuiltin ? 'builtin' : 'custom'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(skill);
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        skill.isEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                          skill.isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
              {skills.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No skills available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selectedSkill && (
          <div className="w-80 card">
            <h3 className="font-semibold text-gray-900 dark:text-white">{selectedSkill.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {selectedSkill.description || 'No description.'}
            </p>

            <div className="mt-4 space-y-3">
              {selectedSkill.triggerPattern && (
                <div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Trigger Pattern
                  </span>
                  <p className="text-sm font-mono text-gray-900 dark:text-white">
                    {selectedSkill.triggerPattern}
                  </p>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Type
                </span>
                <p className="text-sm text-gray-900 dark:text-white">
                  {selectedSkill.isBuiltin ? 'Built-in' : 'Custom'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Required Tools
                </span>
                <p className="text-sm text-gray-900 dark:text-white">
                  {selectedSkill.requiredToolIds.length} tools
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Created
                </span>
                <p className="text-sm text-gray-900 dark:text-white">
                  {new Date(selectedSkill.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Instructions */}
            {selectedSkill.instructions && (
              <div className="mt-4">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Instructions
                </span>
                <pre className="mt-1 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-sans bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                  {selectedSkill.instructions}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Skill</h2>
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
                  placeholder="Skill name"
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
                  placeholder="What does this skill do?"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Trigger Pattern
                </label>
                <input
                  type="text"
                  value={form.triggerPattern}
                  onChange={(e) => setForm({ ...form, triggerPattern: e.target.value })}
                  placeholder="Regex or keyword pattern"
                  className="input font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instructions
                </label>
                <textarea
                  value={form.instructions}
                  onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  rows={6}
                  placeholder="Detailed instructions for executing this skill..."
                  className="input text-sm"
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
