import { useEffect, useState } from 'react';
import { Wrench, Plus, X, ChevronRight } from 'lucide-react';
import { useStore } from '@/store';
import type { ToolDefinition } from '@mailgent/shared';

export default function ToolsPage() {
  const tools = useStore((s) => s.tools);
  const fetchTools = useStore((s) => s.fetchTools);
  const createTool = useStore((s) => s.createTool);
  const updateTool = useStore((s) => s.updateTool);

  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'system' as ToolDefinition['category'],
    code: '',
  });

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const handleToggle = (tool: ToolDefinition) => {
    updateTool(tool.id, { isEnabled: !tool.isEnabled });
  };

  const handleCreate = () => {
    if (!form.name) return;
    createTool({
      name: form.name,
      description: form.description,
      category: form.category,
      code: form.code,
      parameters: [],
      isBuiltin: false,
      isEnabled: true,
    });
    setShowCreate(false);
    setForm({ name: '', description: '', category: 'system', code: '' });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Wrench className="w-6 h-6" />
          Tools
        </h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" />
          Create Tool
        </button>
      </div>

      <div className="flex gap-6">
        {/* Tools table */}
        <div className="flex-1 card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Name
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Category
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
              {tools.map((tool) => (
                <tr
                  key={tool.id}
                  onClick={() => setSelectedTool(tool)}
                  className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    selectedTool?.id === tool.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          selectedTool?.id === tool.id ? 'rotate-90' : ''
                        }`}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {tool.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-gray">{tool.category}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={tool.isBuiltin ? 'badge-blue' : 'badge-yellow'}>
                      {tool.isBuiltin ? 'builtin' : 'custom'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(tool);
                      }}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        tool.isEnabled ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                          tool.isEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                </tr>
              ))}
              {tools.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">
                    No tools available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selectedTool && (
          <div className="w-80 card">
            <h3 className="font-semibold text-gray-900 dark:text-white">{selectedTool.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {selectedTool.description || 'No description.'}
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Category
                </span>
                <p className="text-sm text-gray-900 dark:text-white">{selectedTool.category}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Type
                </span>
                <p className="text-sm text-gray-900 dark:text-white">
                  {selectedTool.isBuiltin ? 'Built-in' : 'Custom'}
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Created
                </span>
                <p className="text-sm text-gray-900 dark:text-white">
                  {new Date(selectedTool.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Parameters */}
            {selectedTool.parameters.length > 0 && (
              <div className="mt-4">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Parameters
                </span>
                <div className="mt-2 space-y-2">
                  {selectedTool.parameters.map((param) => (
                    <div
                      key={param.name}
                      className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-medium text-gray-900 dark:text-white">
                          {param.name}
                        </span>
                        <span className="text-xs text-gray-400">{param.type}</span>
                        {param.required && <span className="badge-red text-[10px]">required</span>}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {param.description}
                      </p>
                    </div>
                  ))}
                </div>
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
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Create Tool</h2>
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
                  placeholder="tool_name"
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
                  placeholder="What does this tool do?"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value as ToolDefinition['category'] })
                  }
                  className="input"
                >
                  <option value="filesystem">Filesystem</option>
                  <option value="system">System</option>
                  <option value="git">Git</option>
                  <option value="communication">Communication</option>
                  <option value="orchestration">Orchestration</option>
                  <option value="meta">Meta</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Source Code
                </label>
                <textarea
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  rows={6}
                  placeholder="Tool implementation..."
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
