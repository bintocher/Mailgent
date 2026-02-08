import { useEffect, useState } from 'react';
import { Settings, Plus, X, Eye, EyeOff, Trash2, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, Zap, FolderOpen, ArrowUp, Folder } from 'lucide-react';
import { useStore } from '@/store';
import { browseDirectories, type BrowseEntry, type BrowseResult } from '@/api/http-client';
import type { LLMProviderType, LLMProviderConfig } from '@mailgent/shared';

type Tab = 'global' | 'project';

type ProviderStep = 'form' | 'models';

const DEFAULT_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: '',
  'openai-compatible': '',
  'z.ai': 'https://api.z.ai/api/paas/v4',
};

const ZAI_ENDPOINTS = [
  { label: 'General', url: 'https://api.z.ai/api/paas/v4' },
  { label: 'Coding', url: 'https://api.z.ai/api/coding/paas/v4' },
  { label: 'Anthropic', url: 'https://api.z.ai/api/anthropic' },
];

export default function SettingsPage() {
  const globalSettings = useStore((s) => s.globalSettings);
  const projectSettings = useStore((s) => s.projectSettings);
  const systemStatus = useStore((s) => s.systemStatus);
  const fetchGlobalSettings = useStore((s) => s.fetchGlobalSettings);
  const fetchProjectSettings = useStore((s) => s.fetchProjectSettings);
  const fetchSystemStatus = useStore((s) => s.fetchSystemStatus);
  const updateProjectSettings = useStore((s) => s.updateProjectSettings);
  const addProvider = useStore((s) => s.addProvider);
  const removeProvider = useStore((s) => s.removeProvider);
  const testProviderConfig = useStore((s) => s.testProviderConfig);
  const testProvider = useStore((s) => s.testProvider);
  const fetchProviderModels = useStore((s) => s.fetchProviderModels);
  const updateProviderModels = useStore((s) => s.updateProviderModels);
  const providerTestResult = useStore((s) => s.providerTestResult);
  const providerAvailableModels = useStore((s) => s.providerAvailableModels);
  const openProject = useStore((s) => s.openProject);

  const [tab, setTab] = useState<Tab>('global');
  const [switchingProject, setSwitchingProject] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [showFolderBrowser, setShowFolderBrowser] = useState(false);
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [providerStep, setProviderStep] = useState<ProviderStep>('form');
  const [savedProviderId, setSavedProviderId] = useState<string | null>(null);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionTested, setConnectionTested] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);
  const [savingModels, setSavingModels] = useState(false);
  const [modelSelection, setModelSelection] = useState<Record<string, boolean>>({});
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());
  const [testingProviders, setTestingProviders] = useState<Set<string>>(new Set());
  const [providerTestResults, setProviderTestResults] = useState<Record<string, { available: boolean; error?: string }>>({});

  // Provider form
  const [providerForm, setProviderForm] = useState({
    name: '',
    type: 'openai' as LLMProviderType,
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
  });

  // Project form (local edits)
  const [projectForm, setProjectForm] = useState({
    companyName: '',
    domain: '',
    maxAgents: 20,
    gitEnabled: true,
    gitAutoCommit: false,
    shellTimeout: 30000,
    defaultModelId: '',
    defaultProviderId: '',
  });

  useEffect(() => {
    fetchGlobalSettings();
    fetchProjectSettings();
    fetchSystemStatus();
  }, [fetchGlobalSettings, fetchProjectSettings, fetchSystemStatus]);

  useEffect(() => {
    if (projectSettings) {
      setProjectForm({
        companyName: projectSettings.companyName,
        domain: projectSettings.domain,
        maxAgents: projectSettings.maxAgents,
        gitEnabled: projectSettings.gitEnabled,
        gitAutoCommit: projectSettings.gitAutoCommit,
        shellTimeout: projectSettings.shellTimeout,
        defaultModelId: projectSettings.defaultModelId ?? '',
        defaultProviderId: projectSettings.defaultProviderId ?? '',
      });
    }
  }, [projectSettings]);

  const handleOpenFolderBrowser = async () => {
    setShowFolderBrowser(true);
    setBrowseError(null);
    setBrowseLoading(true);
    try {
      const result = await browseDirectories(systemStatus?.workDir || '/');
      setBrowseData(result);
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : 'Failed to browse');
    }
    setBrowseLoading(false);
  };

  const handleBrowseNavigate = async (dirPath: string) => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const result = await browseDirectories(dirPath);
      setBrowseData(result);
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : 'Failed to browse');
    }
    setBrowseLoading(false);
  };

  const handleSelectFolder = async () => {
    if (!browseData) return;
    setSwitchingProject(true);
    setSwitchError(null);
    setShowFolderBrowser(false);
    try {
      await openProject(browseData.path);
      await fetchProjectSettings();
      await fetchSystemStatus();
    } catch (err) {
      setSwitchError(err instanceof Error ? err.message : 'Failed to switch project');
    }
    setSwitchingProject(false);
  };

  const toggleKeyVisibility = (providerId: string) => {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  };

  const handleTypeChange = (type: LLMProviderType) => {
    setProviderForm({
      ...providerForm,
      type,
      baseUrl: DEFAULT_URLS[type] || '',
    });
    setConnectionTested(false);
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionTested(false);

    await testProviderConfig({
      type: providerForm.type,
      apiKey: providerForm.apiKey,
      baseUrl: providerForm.baseUrl,
    });
    setTestingConnection(false);
    setConnectionTested(true);
  };

  const handleSaveProvider = async () => {
    if (!providerForm.name || !providerForm.apiKey) return;
    setSavingProvider(true);

    const params: Record<string, unknown> = {
      name: providerForm.name,
      type: providerForm.type,
      apiKey: providerForm.apiKey,
      baseUrl: providerForm.baseUrl,
      rateLimits: {
        requestsPerMinute: providerForm.requestsPerMinute,
        tokensPerMinute: providerForm.tokensPerMinute,
      },
    };

    try {
      await addProvider(params);
      // Find the newly created provider
      const settings = useStore.getState().globalSettings;
      const newProvider = settings?.providers?.find(
        (p: LLMProviderConfig) => p.name === providerForm.name
      );
      if (newProvider) {
        setSavedProviderId(newProvider.id);
        // Models already fetched during test — go straight to selection
        setProviderStep('models');
      }
    } catch {
      // error handled in store
    }
    setSavingProvider(false);
  };

  // When providerAvailableModels changes, initialize selection
  useEffect(() => {
    if (providerAvailableModels) {
      const selection: Record<string, boolean> = {};
      for (const m of providerAvailableModels) {
        selection[m.id] = true;
      }
      setModelSelection(selection);
    }
  }, [providerAvailableModels]);

  const handleSaveModels = async () => {
    if (!savedProviderId) return;
    setSavingModels(true);

    const models = (providerAvailableModels || [])
      .filter((m) => modelSelection[m.id])
      .map((m) => ({
        id: m.id,
        displayName: m.id,
        contextWindow: 128000,
        costPerInputToken: 0,
        costPerOutputToken: 0,
        capabilities: [],
        isEnabled: true,
      }));

    try {
      await updateProviderModels(savedProviderId, models);
      handleCloseModal();
    } catch {
      // error handled in store
    }
    setSavingModels(false);
  };

  const handleCloseModal = () => {
    setShowAddProvider(false);
    setProviderStep('form');
    setSavedProviderId(null);
    setConnectionTested(false);
    setProviderForm({
      name: '',
      type: 'openai',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
    });
  };

  const handleTestSavedProvider = async (id: string) => {
    setTestingProviders((prev) => new Set(prev).add(id));
    try {
      await testProvider(id);
      const result = useStore.getState().providerTestResult;
      if (result) {
        setProviderTestResults((prev) => ({ ...prev, [id]: result }));
      }
    } catch {
      setProviderTestResults((prev) => ({ ...prev, [id]: { available: false, error: 'Test failed' } }));
    }
    setTestingProviders((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const toggleProviderExpanded = (id: string) => {
    setExpandedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSaveProject = () => {
    updateProjectSettings({
      companyName: projectForm.companyName,
      domain: projectForm.domain,
      maxAgents: projectForm.maxAgents,
      gitEnabled: projectForm.gitEnabled,
      gitAutoCommit: projectForm.gitAutoCommit,
      shellTimeout: projectForm.shellTimeout,
      defaultModelId: projectForm.defaultModelId || undefined,
      defaultProviderId: projectForm.defaultProviderId || undefined,
    });
  };

  // Gather all models from all providers for the model selector
  const allModels = (globalSettings?.providers ?? []).flatMap((p) =>
    p.models.map((m) => ({ ...m, providerName: p.name }))
  );

  const showBaseUrl = providerForm.type !== 'anthropic' && providerForm.type !== 'z.ai';
  const showZaiSelect = providerForm.type === 'z.ai';

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <Settings className="w-6 h-6" />
        Settings
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setTab('global')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'global'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Global
        </button>
        <button
          onClick={() => setTab('project')}
          className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
            tab === 'project'
              ? 'border-primary-600 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Project
        </button>
      </div>

      {/* Global tab */}
      {tab === 'global' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">LLM Providers</h2>
            <button
              onClick={() => setShowAddProvider(true)}
              className="btn-primary flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Provider
            </button>
          </div>

          {/* Provider cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {(globalSettings?.providers ?? []).map((provider) => (
              <div key={provider.id} className="card">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{provider.name}</h3>
                    <span className="badge-blue mt-1">{provider.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {providerTestResults[provider.id] && (
                      providerTestResults[provider.id].available ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )
                    )}
                    <span
                      className={provider.isEnabled ? 'badge-green' : 'badge-red'}
                    >
                      {provider.isEnabled ? 'Active' : 'Disabled'}
                    </span>
                    <button
                      onClick={() => handleTestSavedProvider(provider.id)}
                      disabled={testingProviders.has(provider.id)}
                      className="text-gray-400 hover:text-blue-500 p-1"
                      title="Test Connection"
                    >
                      {testingProviders.has(provider.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Zap className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => removeProvider(provider.id)}
                      className="text-gray-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 dark:text-gray-400">API Key:</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300">
                      {revealedKeys.has(provider.id)
                        ? provider.apiKey
                        : maskApiKey(provider.apiKey)}
                    </span>
                    <button
                      onClick={() => toggleKeyVisibility(provider.id)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {revealedKeys.has(provider.id) ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                  {provider.baseUrl && (
                    <p className="text-gray-500 dark:text-gray-400">
                      Base URL: <span className="text-gray-700 dark:text-gray-300">{provider.baseUrl}</span>
                    </p>
                  )}
                  <p className="text-gray-500 dark:text-gray-400">
                    Rate limits:{' '}
                    <span className="text-gray-700 dark:text-gray-300">
                      {provider.rateLimits.requestsPerMinute} req/min,{' '}
                      {provider.rateLimits.tokensPerMinute.toLocaleString()} tok/min
                    </span>
                  </p>

                  {/* Models toggle */}
                  <button
                    onClick={() => toggleProviderExpanded(provider.id)}
                    className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    {expandedProviders.has(provider.id) ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                    Models ({provider.models.length})
                  </button>

                  {expandedProviders.has(provider.id) && (
                    <div className="ml-4 space-y-1">
                      {provider.models.length === 0 ? (
                        <p className="text-gray-400 dark:text-gray-500 italic text-xs">No models configured</p>
                      ) : (
                        provider.models.map((m) => (
                          <div key={m.id} className="flex items-center gap-2 text-xs">
                            <span
                              className={`w-2 h-2 rounded-full ${m.isEnabled ? 'bg-green-500' : 'bg-gray-400'}`}
                            />
                            <span className="font-mono text-gray-700 dark:text-gray-300">{m.id}</span>
                            <span className="text-gray-400">({m.displayName})</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {(!globalSettings || !globalSettings.providers || globalSettings.providers.length === 0) && (
              <p className="text-gray-500 dark:text-gray-400 col-span-full text-center py-8">
                No providers configured. Add one to get started.
              </p>
            )}
          </div>

          {/* Add provider modal */}
          {showAddProvider && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    {providerStep === 'form' ? 'Add Provider' : 'Select Models'}
                  </h2>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {providerStep === 'form' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Name
                      </label>
                      <input
                        type="text"
                        value={providerForm.name}
                        onChange={(e) => {
                          setProviderForm({ ...providerForm, name: e.target.value });
                          setConnectionTested(false);
                        }}
                        placeholder="My OpenAI Provider"
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Type
                      </label>
                      <select
                        value={providerForm.type}
                        onChange={(e) => handleTypeChange(e.target.value as LLMProviderType)}
                        className="input"
                      >
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="openai-compatible">OpenAI Compatible</option>
                        <option value="z.ai">z.ai</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        API Key
                      </label>
                      <input
                        type="password"
                        value={providerForm.apiKey}
                        onChange={(e) => {
                          setProviderForm({ ...providerForm, apiKey: e.target.value });
                          setConnectionTested(false);
                        }}
                        placeholder="sk-..."
                        className="input"
                      />
                    </div>

                    {showBaseUrl && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Base URL
                        </label>
                        <input
                          type="text"
                          value={providerForm.baseUrl}
                          onChange={(e) => {
                            setProviderForm({ ...providerForm, baseUrl: e.target.value });
                            setConnectionTested(false);
                          }}
                          placeholder="https://api.openai.com/v1"
                          className="input"
                        />
                      </div>
                    )}

                    {showZaiSelect && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Endpoint
                        </label>
                        <select
                          value={providerForm.baseUrl}
                          onChange={(e) => {
                            setProviderForm({ ...providerForm, baseUrl: e.target.value });
                            setConnectionTested(false);
                          }}
                          className="input"
                        >
                          {ZAI_ENDPOINTS.map((ep) => (
                            <option key={ep.url} value={ep.url}>
                              {ep.label} — {ep.url}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Requests/min
                        </label>
                        <input
                          type="number"
                          value={providerForm.requestsPerMinute}
                          onChange={(e) =>
                            setProviderForm({
                              ...providerForm,
                              requestsPerMinute: Number(e.target.value),
                            })
                          }
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Tokens/min
                        </label>
                        <input
                          type="number"
                          value={providerForm.tokensPerMinute}
                          onChange={(e) =>
                            setProviderForm({
                              ...providerForm,
                              tokensPerMinute: Number(e.target.value),
                            })
                          }
                          className="input"
                        />
                      </div>
                    </div>

                    {/* Test result */}
                    {connectionTested && providerTestResult && (
                      <div
                        className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                          providerTestResult.available
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                        }`}
                      >
                        {providerTestResult.available ? (
                          <CheckCircle className="w-4 h-4 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 flex-shrink-0" />
                        )}
                        <span>
                          {providerTestResult.available
                            ? `OK — ${providerTestResult.models?.length ?? 0} models found${providerTestResult.latencyMs ? ` (${providerTestResult.latencyMs}ms)` : ''}`
                            : `Connection failed: ${providerTestResult.error || 'Unknown error'}`}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button onClick={handleCloseModal} className="btn-secondary">
                        Cancel
                      </button>
                      <button
                        onClick={handleTestConnection}
                        disabled={testingConnection || !providerForm.apiKey}
                        className="btn-secondary flex items-center gap-1.5"
                      >
                        {testingConnection && <Loader2 className="w-4 h-4 animate-spin" />}
                        Test Connection
                      </button>
                      <button
                        onClick={handleSaveProvider}
                        disabled={savingProvider || !connectionTested || !providerTestResult?.available || !providerForm.name}
                        className="btn-primary flex items-center gap-1.5"
                      >
                        {savingProvider && <Loader2 className="w-4 h-4 animate-spin" />}
                        Save Provider
                      </button>
                    </div>
                  </div>
                )}

                {providerStep === 'models' && (
                  <div className="space-y-3">
                    {fetchingModels ? (
                      <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Fetching available models...
                      </div>
                    ) : providerAvailableModels && providerAvailableModels.length > 0 ? (
                      <>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Select which models to enable:
                        </p>
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {providerAvailableModels.map((m) => (
                            <label
                              key={m.id}
                              className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={modelSelection[m.id] ?? true}
                                onChange={(e) =>
                                  setModelSelection((prev) => ({
                                    ...prev,
                                    [m.id]: e.target.checked,
                                  }))
                                }
                                className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                              />
                              <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                                {m.id}
                              </span>
                              {m.source && (
                                <span className="badge-blue text-xs">{m.source}</span>
                              )}
                            </label>
                          ))}
                        </div>
                        <div className="flex justify-between pt-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const all: Record<string, boolean> = {};
                                for (const m of providerAvailableModels) all[m.id] = true;
                                setModelSelection(all);
                              }}
                              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
                            >
                              Select All
                            </button>
                            <button
                              onClick={() => {
                                const none: Record<string, boolean> = {};
                                for (const m of providerAvailableModels) none[m.id] = false;
                                setModelSelection(none);
                              }}
                              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
                            >
                              Deselect All
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={handleCloseModal} className="btn-secondary">
                              Skip
                            </button>
                            <button
                              onClick={handleSaveModels}
                              disabled={savingModels}
                              className="btn-primary flex items-center gap-1.5"
                            >
                              {savingModels && <Loader2 className="w-4 h-4 animate-spin" />}
                              Save Models
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 space-y-3">
                        <p className="text-gray-500 dark:text-gray-400">
                          No models found or failed to fetch models.
                        </p>
                        <div className="flex justify-center gap-2">
                          <button onClick={handleCloseModal} className="btn-secondary">
                            Close
                          </button>
                          <button
                            onClick={async () => {
                              if (savedProviderId) {
                                setFetchingModels(true);
                                await fetchProviderModels(savedProviderId);
                                setFetchingModels(false);
                              }
                            }}
                            className="btn-primary"
                          >
                            Retry
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Project tab */}
      {tab === 'project' && (
        <div className="max-w-2xl space-y-6">
          {/* Working Directory */}
          <div className="card space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Working Directory
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Absolute path to the project folder. Switching will reload all project data.
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <FolderOpen className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="font-mono text-sm text-gray-700 dark:text-gray-300 truncate">
                  {systemStatus?.workDir || 'Not set'}
                </span>
              </div>
              <button
                disabled={switchingProject}
                onClick={handleOpenFolderBrowser}
                className="btn-primary flex items-center gap-1.5 whitespace-nowrap"
              >
                {switchingProject && <Loader2 className="w-4 h-4 animate-spin" />}
                Change
              </button>
            </div>
            {switchError && (
              <p className="text-sm text-red-600 dark:text-red-400">{switchError}</p>
            )}
          </div>

          {/* Folder browser modal */}
          {showFolderBrowser && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                    Select Folder
                  </h2>
                  <button
                    onClick={() => setShowFolderBrowser(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Current path */}
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                  <FolderOpen className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  <span className="font-mono text-gray-700 dark:text-gray-300 truncate">
                    {browseData?.path || '...'}
                  </span>
                </div>

                {/* Parent directory button */}
                {browseData && browseData.parent !== browseData.path && (
                  <button
                    onClick={() => handleBrowseNavigate(browseData.parent)}
                    disabled={browseLoading}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors w-full text-left"
                  >
                    <ArrowUp className="w-4 h-4" />
                    <span>..</span>
                  </button>
                )}

                {/* Directory listing */}
                <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5">
                  {browseLoading ? (
                    <div className="flex items-center justify-center py-8 gap-2 text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Loading...
                    </div>
                  ) : browseError ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-red-500">{browseError}</p>
                    </div>
                  ) : browseData && browseData.entries.length > 0 ? (
                    browseData.entries.map((entry) => (
                      <button
                        key={entry.path}
                        onClick={() => handleBrowseNavigate(entry.path)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors w-full text-left"
                      >
                        <Folder className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        <span className="truncate">{entry.name}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">
                      Empty directory
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                  <button
                    onClick={() => setShowFolderBrowser(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSelectFolder}
                    disabled={!browseData || browseData.path === systemStatus?.workDir}
                    className="btn-primary flex items-center gap-1.5"
                  >
                    <FolderOpen className="w-4 h-4" />
                    Select This Folder
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="card space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Project Settings
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={projectForm.companyName}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, companyName: e.target.value })
                  }
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Domain
                </label>
                <input
                  type="text"
                  value={projectForm.domain}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, domain: e.target.value })
                  }
                  placeholder="company.local"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Max Agents
                </label>
                <input
                  type="number"
                  value={projectForm.maxAgents}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, maxAgents: Number(e.target.value) })
                  }
                  min={1}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Shell Timeout (ms)
                </label>
                <input
                  type="number"
                  value={projectForm.shellTimeout}
                  onChange={(e) =>
                    setProjectForm({ ...projectForm, shellTimeout: Number(e.target.value) })
                  }
                  min={1000}
                  step={1000}
                  className="input"
                />
              </div>
            </div>

            {/* Git settings */}
            <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Git Settings
              </h3>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={projectForm.gitEnabled}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, gitEnabled: e.target.checked })
                    }
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  Git Enabled
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={projectForm.gitAutoCommit}
                    onChange={(e) =>
                      setProjectForm({ ...projectForm, gitAutoCommit: e.target.checked })
                    }
                    className="rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500"
                  />
                  Auto Commit
                </label>
              </div>
            </div>

            {/* Default model */}
            <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Default Model
              </h3>
              <select
                value={
                  projectForm.defaultProviderId && projectForm.defaultModelId
                    ? `${projectForm.defaultProviderId}:${projectForm.defaultModelId}`
                    : ''
                }
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) {
                    setProjectForm({
                      ...projectForm,
                      defaultProviderId: '',
                      defaultModelId: '',
                    });
                  } else {
                    const [providerId, modelId] = val.split(':');
                    setProjectForm({
                      ...projectForm,
                      defaultProviderId: providerId,
                      defaultModelId: modelId,
                    });
                  }
                }}
                className="input"
              >
                <option value="">No default</option>
                {allModels.map((m) => (
                  <option key={`${m.providerId}:${m.id}`} value={`${m.providerId}:${m.id}`}>
                    {m.providerName} / {m.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-2">
              <button onClick={handleSaveProject} className="btn-primary">
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
