import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Settings, Plus, X, Eye, EyeOff, Trash2, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, Zap, FolderOpen, ArrowUp, Folder } from 'lucide-react';
import { useStore } from '@/store';
import { browseDirectories } from '@/api/http-client';
const DEFAULT_URLS = {
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
    const [tab, setTab] = useState('global');
    const [switchingProject, setSwitchingProject] = useState(false);
    const [switchError, setSwitchError] = useState(null);
    const [showFolderBrowser, setShowFolderBrowser] = useState(false);
    const [browseData, setBrowseData] = useState(null);
    const [browseLoading, setBrowseLoading] = useState(false);
    const [browseError, setBrowseError] = useState(null);
    const [showAddProvider, setShowAddProvider] = useState(false);
    const [providerStep, setProviderStep] = useState('form');
    const [savedProviderId, setSavedProviderId] = useState(null);
    const [revealedKeys, setRevealedKeys] = useState(new Set());
    const [testingConnection, setTestingConnection] = useState(false);
    const [connectionTested, setConnectionTested] = useState(false);
    const [savingProvider, setSavingProvider] = useState(false);
    const [fetchingModels, setFetchingModels] = useState(false);
    const [savingModels, setSavingModels] = useState(false);
    const [modelSelection, setModelSelection] = useState({});
    const [expandedProviders, setExpandedProviders] = useState(new Set());
    const [testingProviders, setTestingProviders] = useState(new Set());
    const [providerTestResults, setProviderTestResults] = useState({});
    // Provider form
    const [providerForm, setProviderForm] = useState({
        name: '',
        type: 'openai',
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
        }
        catch (err) {
            setBrowseError(err instanceof Error ? err.message : 'Failed to browse');
        }
        setBrowseLoading(false);
    };
    const handleBrowseNavigate = async (dirPath) => {
        setBrowseLoading(true);
        setBrowseError(null);
        try {
            const result = await browseDirectories(dirPath);
            setBrowseData(result);
        }
        catch (err) {
            setBrowseError(err instanceof Error ? err.message : 'Failed to browse');
        }
        setBrowseLoading(false);
    };
    const handleSelectFolder = async () => {
        if (!browseData)
            return;
        setSwitchingProject(true);
        setSwitchError(null);
        setShowFolderBrowser(false);
        try {
            await openProject(browseData.path);
            await fetchProjectSettings();
            await fetchSystemStatus();
        }
        catch (err) {
            setSwitchError(err instanceof Error ? err.message : 'Failed to switch project');
        }
        setSwitchingProject(false);
    };
    const toggleKeyVisibility = (providerId) => {
        setRevealedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(providerId)) {
                next.delete(providerId);
            }
            else {
                next.add(providerId);
            }
            return next;
        });
    };
    const maskApiKey = (key) => {
        if (key.length <= 8)
            return '****';
        return key.slice(0, 4) + '****' + key.slice(-4);
    };
    const handleTypeChange = (type) => {
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
        if (!providerForm.name || !providerForm.apiKey)
            return;
        setSavingProvider(true);
        const params = {
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
            const newProvider = settings?.providers?.find((p) => p.name === providerForm.name);
            if (newProvider) {
                setSavedProviderId(newProvider.id);
                // Models already fetched during test — go straight to selection
                setProviderStep('models');
            }
        }
        catch {
            // error handled in store
        }
        setSavingProvider(false);
    };
    // When providerAvailableModels changes, initialize selection
    useEffect(() => {
        if (providerAvailableModels) {
            const selection = {};
            for (const m of providerAvailableModels) {
                selection[m.id] = true;
            }
            setModelSelection(selection);
        }
    }, [providerAvailableModels]);
    const handleSaveModels = async () => {
        if (!savedProviderId)
            return;
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
        }
        catch {
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
    const handleTestSavedProvider = async (id) => {
        setTestingProviders((prev) => new Set(prev).add(id));
        try {
            await testProvider(id);
            const result = useStore.getState().providerTestResult;
            if (result) {
                setProviderTestResults((prev) => ({ ...prev, [id]: result }));
            }
        }
        catch {
            setProviderTestResults((prev) => ({ ...prev, [id]: { available: false, error: 'Test failed' } }));
        }
        setTestingProviders((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };
    const toggleProviderExpanded = (id) => {
        setExpandedProviders((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            }
            else {
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
    const allModels = (globalSettings?.providers ?? []).flatMap((p) => p.models.map((m) => ({ ...m, providerName: p.name })));
    const showBaseUrl = providerForm.type !== 'anthropic' && providerForm.type !== 'z.ai';
    const showZaiSelect = providerForm.type === 'z.ai';
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("h1", { className: "text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2", children: [_jsx(Settings, { className: "w-6 h-6" }), "Settings"] }), _jsxs("div", { className: "flex gap-1 border-b border-gray-200 dark:border-gray-800", children: [_jsx("button", { onClick: () => setTab('global'), className: `px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'global'
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`, children: "Global" }), _jsx("button", { onClick: () => setTab('project'), className: `px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${tab === 'project'
                            ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'}`, children: "Project" })] }), tab === 'global' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900 dark:text-white", children: "LLM Providers" }), _jsxs("button", { onClick: () => setShowAddProvider(true), className: "btn-primary flex items-center gap-1.5", children: [_jsx(Plus, { className: "w-4 h-4" }), "Add Provider"] })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [(globalSettings?.providers ?? []).map((provider) => (_jsxs("div", { className: "card", children: [_jsxs("div", { className: "flex items-start justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-semibold text-gray-900 dark:text-white", children: provider.name }), _jsx("span", { className: "badge-blue mt-1", children: provider.type })] }), _jsxs("div", { className: "flex items-center gap-2", children: [providerTestResults[provider.id] && (providerTestResults[provider.id].available ? (_jsx(CheckCircle, { className: "w-4 h-4 text-green-500" })) : (_jsx(XCircle, { className: "w-4 h-4 text-red-500" }))), _jsx("span", { className: provider.isEnabled ? 'badge-green' : 'badge-red', children: provider.isEnabled ? 'Active' : 'Disabled' }), _jsx("button", { onClick: () => handleTestSavedProvider(provider.id), disabled: testingProviders.has(provider.id), className: "text-gray-400 hover:text-blue-500 p-1", title: "Test Connection", children: testingProviders.has(provider.id) ? (_jsx(Loader2, { className: "w-4 h-4 animate-spin" })) : (_jsx(Zap, { className: "w-4 h-4" })) }), _jsx("button", { onClick: () => removeProvider(provider.id), className: "text-gray-400 hover:text-red-500 p-1", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }), _jsxs("div", { className: "mt-3 space-y-2 text-sm", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "text-gray-500 dark:text-gray-400", children: "API Key:" }), _jsx("span", { className: "font-mono text-gray-700 dark:text-gray-300", children: revealedKeys.has(provider.id)
                                                            ? provider.apiKey
                                                            : maskApiKey(provider.apiKey) }), _jsx("button", { onClick: () => toggleKeyVisibility(provider.id), className: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300", children: revealedKeys.has(provider.id) ? (_jsx(EyeOff, { className: "w-3.5 h-3.5" })) : (_jsx(Eye, { className: "w-3.5 h-3.5" })) })] }), provider.baseUrl && (_jsxs("p", { className: "text-gray-500 dark:text-gray-400", children: ["Base URL: ", _jsx("span", { className: "text-gray-700 dark:text-gray-300", children: provider.baseUrl })] })), _jsxs("p", { className: "text-gray-500 dark:text-gray-400", children: ["Rate limits:", ' ', _jsxs("span", { className: "text-gray-700 dark:text-gray-300", children: [provider.rateLimits.requestsPerMinute, " req/min,", ' ', provider.rateLimits.tokensPerMinute.toLocaleString(), " tok/min"] })] }), _jsxs("button", { onClick: () => toggleProviderExpanded(provider.id), className: "flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300", children: [expandedProviders.has(provider.id) ? (_jsx(ChevronDown, { className: "w-3.5 h-3.5" })) : (_jsx(ChevronRight, { className: "w-3.5 h-3.5" })), "Models (", provider.models.length, ")"] }), expandedProviders.has(provider.id) && (_jsx("div", { className: "ml-4 space-y-1", children: provider.models.length === 0 ? (_jsx("p", { className: "text-gray-400 dark:text-gray-500 italic text-xs", children: "No models configured" })) : (provider.models.map((m) => (_jsxs("div", { className: "flex items-center gap-2 text-xs", children: [_jsx("span", { className: `w-2 h-2 rounded-full ${m.isEnabled ? 'bg-green-500' : 'bg-gray-400'}` }), _jsx("span", { className: "font-mono text-gray-700 dark:text-gray-300", children: m.id }), _jsxs("span", { className: "text-gray-400", children: ["(", m.displayName, ")"] })] }, m.id)))) }))] })] }, provider.id))), (!globalSettings || !globalSettings.providers || globalSettings.providers.length === 0) && (_jsx("p", { className: "text-gray-500 dark:text-gray-400 col-span-full text-center py-8", children: "No providers configured. Add one to get started." }))] }), showAddProvider && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-gray-900 dark:text-white", children: providerStep === 'form' ? 'Add Provider' : 'Select Models' }), _jsx("button", { onClick: handleCloseModal, className: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300", children: _jsx(X, { className: "w-5 h-5" }) })] }), providerStep === 'form' && (_jsxs("div", { className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Name" }), _jsx("input", { type: "text", value: providerForm.name, onChange: (e) => {
                                                        setProviderForm({ ...providerForm, name: e.target.value });
                                                        setConnectionTested(false);
                                                    }, placeholder: "My OpenAI Provider", className: "input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Type" }), _jsxs("select", { value: providerForm.type, onChange: (e) => handleTypeChange(e.target.value), className: "input", children: [_jsx("option", { value: "openai", children: "OpenAI" }), _jsx("option", { value: "anthropic", children: "Anthropic" }), _jsx("option", { value: "openai-compatible", children: "OpenAI Compatible" }), _jsx("option", { value: "z.ai", children: "z.ai" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "API Key" }), _jsx("input", { type: "password", value: providerForm.apiKey, onChange: (e) => {
                                                        setProviderForm({ ...providerForm, apiKey: e.target.value });
                                                        setConnectionTested(false);
                                                    }, placeholder: "sk-...", className: "input" })] }), showBaseUrl && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Base URL" }), _jsx("input", { type: "text", value: providerForm.baseUrl, onChange: (e) => {
                                                        setProviderForm({ ...providerForm, baseUrl: e.target.value });
                                                        setConnectionTested(false);
                                                    }, placeholder: "https://api.openai.com/v1", className: "input" })] })), showZaiSelect && (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Endpoint" }), _jsx("select", { value: providerForm.baseUrl, onChange: (e) => {
                                                        setProviderForm({ ...providerForm, baseUrl: e.target.value });
                                                        setConnectionTested(false);
                                                    }, className: "input", children: ZAI_ENDPOINTS.map((ep) => (_jsxs("option", { value: ep.url, children: [ep.label, " \u2014 ", ep.url] }, ep.url))) })] })), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Requests/min" }), _jsx("input", { type: "number", value: providerForm.requestsPerMinute, onChange: (e) => setProviderForm({
                                                                ...providerForm,
                                                                requestsPerMinute: Number(e.target.value),
                                                            }), className: "input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Tokens/min" }), _jsx("input", { type: "number", value: providerForm.tokensPerMinute, onChange: (e) => setProviderForm({
                                                                ...providerForm,
                                                                tokensPerMinute: Number(e.target.value),
                                                            }), className: "input" })] })] }), connectionTested && providerTestResult && (_jsxs("div", { className: `flex items-center gap-2 p-3 rounded-lg text-sm ${providerTestResult.available
                                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`, children: [providerTestResult.available ? (_jsx(CheckCircle, { className: "w-4 h-4 flex-shrink-0" })) : (_jsx(XCircle, { className: "w-4 h-4 flex-shrink-0" })), _jsx("span", { children: providerTestResult.available
                                                        ? `OK — ${providerTestResult.models?.length ?? 0} models found${providerTestResult.latencyMs ? ` (${providerTestResult.latencyMs}ms)` : ''}`
                                                        : `Connection failed: ${providerTestResult.error || 'Unknown error'}` })] })), _jsxs("div", { className: "flex justify-end gap-2 pt-2", children: [_jsx("button", { onClick: handleCloseModal, className: "btn-secondary", children: "Cancel" }), _jsxs("button", { onClick: handleTestConnection, disabled: testingConnection || !providerForm.apiKey, className: "btn-secondary flex items-center gap-1.5", children: [testingConnection && _jsx(Loader2, { className: "w-4 h-4 animate-spin" }), "Test Connection"] }), _jsxs("button", { onClick: handleSaveProvider, disabled: savingProvider || !connectionTested || !providerTestResult?.available || !providerForm.name, className: "btn-primary flex items-center gap-1.5", children: [savingProvider && _jsx(Loader2, { className: "w-4 h-4 animate-spin" }), "Save Provider"] })] })] })), providerStep === 'models' && (_jsx("div", { className: "space-y-3", children: fetchingModels ? (_jsxs("div", { className: "flex items-center justify-center py-8 gap-2 text-gray-500", children: [_jsx(Loader2, { className: "w-5 h-5 animate-spin" }), "Fetching available models..."] })) : providerAvailableModels && providerAvailableModels.length > 0 ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Select which models to enable:" }), _jsx("div", { className: "max-h-60 overflow-y-auto space-y-1", children: providerAvailableModels.map((m) => (_jsxs("label", { className: "flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: modelSelection[m.id] ?? true, onChange: (e) => setModelSelection((prev) => ({
                                                                ...prev,
                                                                [m.id]: e.target.checked,
                                                            })), className: "rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" }), _jsx("span", { className: "font-mono text-sm text-gray-700 dark:text-gray-300", children: m.id }), m.source && (_jsx("span", { className: "badge-blue text-xs", children: m.source }))] }, m.id))) }), _jsxs("div", { className: "flex justify-between pt-2", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => {
                                                                    const all = {};
                                                                    for (const m of providerAvailableModels)
                                                                        all[m.id] = true;
                                                                    setModelSelection(all);
                                                                }, className: "text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400", children: "Select All" }), _jsx("button", { onClick: () => {
                                                                    const none = {};
                                                                    for (const m of providerAvailableModels)
                                                                        none[m.id] = false;
                                                                    setModelSelection(none);
                                                                }, className: "text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400", children: "Deselect All" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: handleCloseModal, className: "btn-secondary", children: "Skip" }), _jsxs("button", { onClick: handleSaveModels, disabled: savingModels, className: "btn-primary flex items-center gap-1.5", children: [savingModels && _jsx(Loader2, { className: "w-4 h-4 animate-spin" }), "Save Models"] })] })] })] })) : (_jsxs("div", { className: "text-center py-8 space-y-3", children: [_jsx("p", { className: "text-gray-500 dark:text-gray-400", children: "No models found or failed to fetch models." }), _jsxs("div", { className: "flex justify-center gap-2", children: [_jsx("button", { onClick: handleCloseModal, className: "btn-secondary", children: "Close" }), _jsx("button", { onClick: async () => {
                                                            if (savedProviderId) {
                                                                setFetchingModels(true);
                                                                await fetchProviderModels(savedProviderId);
                                                                setFetchingModels(false);
                                                            }
                                                        }, className: "btn-primary", children: "Retry" })] })] })) }))] }) }))] })), tab === 'project' && (_jsxs("div", { className: "max-w-2xl space-y-6", children: [_jsxs("div", { className: "card space-y-3", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900 dark:text-white", children: "Working Directory" }), _jsx("p", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Absolute path to the project folder. Switching will reload all project data." }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex-1 flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700", children: [_jsx(FolderOpen, { className: "w-4 h-4 text-gray-400 flex-shrink-0" }), _jsx("span", { className: "font-mono text-sm text-gray-700 dark:text-gray-300 truncate", children: systemStatus?.workDir || 'Not set' })] }), _jsxs("button", { disabled: switchingProject, onClick: handleOpenFolderBrowser, className: "btn-primary flex items-center gap-1.5 whitespace-nowrap", children: [switchingProject && _jsx(Loader2, { className: "w-4 h-4 animate-spin" }), "Change"] })] }), switchError && (_jsx("p", { className: "text-sm text-red-600 dark:text-red-400", children: switchError }))] }), showFolderBrowser && (_jsx("div", { className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4", children: _jsxs("div", { className: "bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[80vh] flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-bold text-gray-900 dark:text-white", children: "Select Folder" }), _jsx("button", { onClick: () => setShowFolderBrowser(false), className: "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300", children: _jsx(X, { className: "w-5 h-5" }) })] }), _jsxs("div", { className: "flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm", children: [_jsx(FolderOpen, { className: "w-4 h-4 text-primary-500 flex-shrink-0" }), _jsx("span", { className: "font-mono text-gray-700 dark:text-gray-300 truncate", children: browseData?.path || '...' })] }), browseData && browseData.parent !== browseData.path && (_jsxs("button", { onClick: () => handleBrowseNavigate(browseData.parent), disabled: browseLoading, className: "flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors w-full text-left", children: [_jsx(ArrowUp, { className: "w-4 h-4" }), _jsx("span", { children: ".." })] })), _jsx("div", { className: "flex-1 overflow-y-auto min-h-0 space-y-0.5", children: browseLoading ? (_jsxs("div", { className: "flex items-center justify-center py-8 gap-2 text-gray-500", children: [_jsx(Loader2, { className: "w-5 h-5 animate-spin" }), "Loading..."] })) : browseError ? (_jsx("div", { className: "text-center py-8", children: _jsx("p", { className: "text-sm text-red-500", children: browseError }) })) : browseData && browseData.entries.length > 0 ? (browseData.entries.map((entry) => (_jsxs("button", { onClick: () => handleBrowseNavigate(entry.path), className: "flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors w-full text-left", children: [_jsx(Folder, { className: "w-4 h-4 text-yellow-500 flex-shrink-0" }), _jsx("span", { className: "truncate", children: entry.name })] }, entry.path)))) : (_jsx("p", { className: "text-sm text-gray-400 dark:text-gray-500 text-center py-8", children: "Empty directory" })) }), _jsxs("div", { className: "flex justify-end gap-2 pt-2 border-t border-gray-200 dark:border-gray-800", children: [_jsx("button", { onClick: () => setShowFolderBrowser(false), className: "btn-secondary", children: "Cancel" }), _jsxs("button", { onClick: handleSelectFolder, disabled: !browseData || browseData.path === systemStatus?.workDir, className: "btn-primary flex items-center gap-1.5", children: [_jsx(FolderOpen, { className: "w-4 h-4" }), "Select This Folder"] })] })] }) })), _jsxs("div", { className: "card space-y-4", children: [_jsx("h2", { className: "text-lg font-semibold text-gray-900 dark:text-white", children: "Project Settings" }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Company Name" }), _jsx("input", { type: "text", value: projectForm.companyName, onChange: (e) => setProjectForm({ ...projectForm, companyName: e.target.value }), className: "input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Domain" }), _jsx("input", { type: "text", value: projectForm.domain, onChange: (e) => setProjectForm({ ...projectForm, domain: e.target.value }), placeholder: "company.local", className: "input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Max Agents" }), _jsx("input", { type: "number", value: projectForm.maxAgents, onChange: (e) => setProjectForm({ ...projectForm, maxAgents: Number(e.target.value) }), min: 1, className: "input" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1", children: "Shell Timeout (ms)" }), _jsx("input", { type: "number", value: projectForm.shellTimeout, onChange: (e) => setProjectForm({ ...projectForm, shellTimeout: Number(e.target.value) }), min: 1000, step: 1000, className: "input" })] })] }), _jsxs("div", { className: "border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3", children: [_jsx("h3", { className: "text-sm font-medium text-gray-700 dark:text-gray-300", children: "Git Settings" }), _jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300", children: [_jsx("input", { type: "checkbox", checked: projectForm.gitEnabled, onChange: (e) => setProjectForm({ ...projectForm, gitEnabled: e.target.checked }), className: "rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" }), "Git Enabled"] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300", children: [_jsx("input", { type: "checkbox", checked: projectForm.gitAutoCommit, onChange: (e) => setProjectForm({ ...projectForm, gitAutoCommit: e.target.checked }), className: "rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500" }), "Auto Commit"] })] })] }), _jsxs("div", { className: "border-t border-gray-200 dark:border-gray-800 pt-4 space-y-3", children: [_jsx("h3", { className: "text-sm font-medium text-gray-700 dark:text-gray-300", children: "Default Model" }), _jsxs("select", { value: projectForm.defaultProviderId && projectForm.defaultModelId
                                            ? `${projectForm.defaultProviderId}:${projectForm.defaultModelId}`
                                            : '', onChange: (e) => {
                                            const val = e.target.value;
                                            if (!val) {
                                                setProjectForm({
                                                    ...projectForm,
                                                    defaultProviderId: '',
                                                    defaultModelId: '',
                                                });
                                            }
                                            else {
                                                const [providerId, modelId] = val.split(':');
                                                setProjectForm({
                                                    ...projectForm,
                                                    defaultProviderId: providerId,
                                                    defaultModelId: modelId,
                                                });
                                            }
                                        }, className: "input", children: [_jsx("option", { value: "", children: "No default" }), allModels.map((m) => (_jsxs("option", { value: `${m.providerId}:${m.id}`, children: [m.providerName, " / ", m.displayName] }, `${m.providerId}:${m.id}`)))] })] }), _jsx("div", { className: "pt-2", children: _jsx("button", { onClick: handleSaveProject, className: "btn-primary", children: "Save Settings" }) })] })] }))] }));
}
