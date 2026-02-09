import { create } from 'zustand';
import type {
  Agent,
  AgentCreateParams,
  AgentGroup,
  Email,
  EmailFilter,
  EmailThread,
  ToolDefinition,
  SkillDefinition,
  GlobalSettings,
  ProjectSettings,
  ChatSession,
  ChatMessage,
  TokenUsage,
  TokenUsageTimeSeries,
  LLMPerformanceStats,
  AgentMetrics,
  QueueStats,
  SystemStatus,
} from '@mailgent/shared';
import * as http from '../api/http-client';
import { wsClient } from '../api/ws-client';

// ---------------------------------------------------------------------------
// Agentic step type
// ---------------------------------------------------------------------------

export interface ChatStep {
  id: string;
  type: 'thinking' | 'tool_call' | 'tool_result';
  content: string;
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolCallId?: string;
  success?: boolean;
  durationMs?: number;
  iteration: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Slice types
// ---------------------------------------------------------------------------

interface AgentsSlice {
  agents: Agent[];
  agentsLoading: boolean;
  selectedAgentId: string | null;
  fetchAgents: () => Promise<void>;
  createAgent: (params: AgentCreateParams) => Promise<Agent>;
  updateAgent: (id: string, params: Partial<AgentCreateParams>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  stopAgent: (id: string) => Promise<void>;
  startAgent: (id: string) => Promise<void>;
  setSelectedAgentId: (id: string | null) => void;
  updateAgentInList: (agent: Agent) => void;
  updateAgentStatus: (agentId: string, status: Agent['status']) => void;
  removeAgentFromList: (agentId: string) => void;
}

interface GroupsSlice {
  groups: AgentGroup[];
  groupsLoading: boolean;
  fetchGroups: () => Promise<void>;
  createGroup: (params: Omit<AgentGroup, 'id' | 'createdAt' | 'updatedAt'>) => Promise<AgentGroup>;
  updateGroup: (id: string, params: Partial<AgentGroup>) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  assignToGroup: (groupId: string, agentId: string) => Promise<void>;
}

interface EmailsSlice {
  emails: Email[];
  threads: EmailThread[];
  emailsLoading: boolean;
  selectedEmailId: string | null;
  fetchEmails: (filter?: EmailFilter) => Promise<void>;
  fetchEmailThreads: () => Promise<void>;
  fetchEmail: (id: string) => Promise<Email>;
  deleteAllEmails: () => Promise<void>;
  setSelectedEmailId: (id: string | null) => void;
  addEmail: (email: Email) => void;
  updateEmailStatus: (emailId: string, status: { isRead?: boolean; isProcessed?: boolean }) => void;
}

interface ChatSlice {
  chatMessages: ChatMessage[];
  chatSessionId: string | null;
  chatSessions: ChatSession[];
  chatSessionsLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  agenticSteps: ChatStep[];
  pendingFinalMessage: ChatMessage | null;
  fetchChatSessions: () => Promise<void>;
  fetchChatMessages: (sessionId: string) => Promise<void>;
  deleteChatSession: (sessionId: string) => Promise<void>;
  selectChatSession: (sessionId: string) => Promise<void>;
  startNewChatSession: () => void;
  setChatSessionId: (id: string | null) => void;
  addChatMessage: (message: ChatMessage) => void;
  setIsStreaming: (streaming: boolean) => void;
  appendStreamingContent: (chunk: string) => void;
  clearStreamingContent: () => void;
  sendChatMessage: (content: string) => void;
  addAgenticStep: (step: ChatStep) => void;
  clearAgenticSteps: () => void;
  setPendingFinalMessage: (msg: ChatMessage | null) => void;
  finalizeChatResponse: () => void;
}

interface ToolsSlice {
  tools: ToolDefinition[];
  toolsLoading: boolean;
  fetchTools: () => Promise<void>;
  createTool: (params: Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt'>) => Promise<ToolDefinition>;
  updateTool: (id: string, params: Partial<ToolDefinition>) => Promise<void>;
  deleteTool: (id: string) => Promise<void>;
}

interface SkillsSlice {
  skills: SkillDefinition[];
  skillsLoading: boolean;
  fetchSkills: () => Promise<void>;
  createSkill: (params: Omit<SkillDefinition, 'id' | 'createdAt' | 'updatedAt'>) => Promise<SkillDefinition>;
  updateSkill: (id: string, params: Partial<SkillDefinition>) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
}

interface MetricsSlice {
  tokenUsage: { total: TokenUsage; timeSeries: TokenUsageTimeSeries[] } | null;
  llmPerformance: LLMPerformanceStats[];
  agentMetrics: AgentMetrics[];
  queueStats: QueueStats | null;
  metricsLoading: boolean;
  fetchTokenMetrics: () => Promise<void>;
  fetchLLMPerformance: () => Promise<void>;
  fetchAgentMetrics: () => Promise<void>;
  fetchQueueStats: () => Promise<void>;
  setQueueStats: (stats: QueueStats) => void;
}

interface SettingsSlice {
  globalSettings: GlobalSettings | null;
  projectSettings: ProjectSettings | null;
  settingsLoading: boolean;
  providerTestResult: { available: boolean; error?: string; latencyMs?: number; models?: Array<{ id: string }> } | null;
  providerAvailableModels: Array<{ id: string; endpoint?: string; source?: string }> | null;
  fetchGlobalSettings: () => Promise<void>;
  updateGlobalSettings: (params: Partial<GlobalSettings>) => Promise<void>;
  fetchProjectSettings: () => Promise<void>;
  updateProjectSettings: (params: Partial<ProjectSettings>) => Promise<void>;
  addProvider: (params: Record<string, unknown>) => Promise<void>;
  removeProvider: (providerId: string) => Promise<void>;
  updateProvider: (id: string, params: Record<string, unknown>) => Promise<void>;
  testProviderConfig: (params: Record<string, unknown>) => Promise<void>;
  testProvider: (id: string) => Promise<void>;
  fetchProviderModels: (id: string) => Promise<void>;
  updateProviderModels: (id: string, models: Array<Record<string, unknown>>) => Promise<void>;
}

interface SystemSlice {
  systemStatus: SystemStatus | null;
  connected: boolean;
  fetchSystemStatus: () => Promise<void>;
  setConnected: (connected: boolean) => void;
  setSystemStatus: (status: SystemStatus) => void;
  openProject: (workDir: string) => Promise<void>;
  freezeOperations: () => Promise<void>;
  resumeOperations: () => Promise<void>;
  stopAllOperations: () => Promise<void>;
}

interface UISlice {
  sidebarOpen: boolean;
  theme: 'light' | 'dark' | 'system';
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

// ---------------------------------------------------------------------------
// Combined store type
// ---------------------------------------------------------------------------

export type AppStore = AgentsSlice &
  GroupsSlice &
  EmailsSlice &
  ChatSlice &
  ToolsSlice &
  SkillsSlice &
  MetricsSlice &
  SettingsSlice &
  SystemSlice &
  UISlice;

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useStore = create<AppStore>()((set, get) => ({
  // -----------------------------------------------------------------------
  // Agents
  // -----------------------------------------------------------------------
  agents: [],
  agentsLoading: false,
  selectedAgentId: null,

  fetchAgents: async () => {
    set({ agentsLoading: true });
    try {
      const agents = await http.fetchAgents();
      set({ agents, agentsLoading: false });
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      set({ agentsLoading: false });
    }
  },

  createAgent: async (params) => {
    const agent = await http.createAgent(params);
    set((s) => ({ agents: [...s.agents, agent] }));
    return agent;
  },

  updateAgent: async (id, params) => {
    const updated = await http.updateAgent(id, params);
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? updated : a)),
    }));
  },

  deleteAgent: async (id) => {
    await http.deleteAgent(id);
    set((s) => ({
      agents: s.agents.filter((a) => a.id !== id),
      selectedAgentId: s.selectedAgentId === id ? null : s.selectedAgentId,
    }));
  },

  stopAgent: async (id) => {
    const updated = await http.stopAgent(id);
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? updated : a)),
    }));
  },

  startAgent: async (id) => {
    const updated = await http.startAgent(id);
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? updated : a)),
    }));
  },

  setSelectedAgentId: (id) => set({ selectedAgentId: id }),

  updateAgentInList: (agent) =>
    set((s) => ({
      agents: s.agents.some((a) => a.id === agent.id)
        ? s.agents.map((a) => (a.id === agent.id ? agent : a))
        : [...s.agents, agent],
    })),

  updateAgentStatus: (agentId, status) =>
    set((s) => ({
      agents: s.agents.map((a) =>
        a.id === agentId ? { ...a, status } : a,
      ),
    })),

  removeAgentFromList: (agentId) =>
    set((s) => ({
      agents: s.agents.filter((a) => a.id !== agentId),
      selectedAgentId:
        s.selectedAgentId === agentId ? null : s.selectedAgentId,
    })),

  // -----------------------------------------------------------------------
  // Groups
  // -----------------------------------------------------------------------
  groups: [],
  groupsLoading: false,

  fetchGroups: async () => {
    set({ groupsLoading: true });
    try {
      const groups = await http.fetchGroups();
      set({ groups, groupsLoading: false });
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      set({ groupsLoading: false });
    }
  },

  createGroup: async (params) => {
    const group = await http.createGroup(params);
    set((s) => ({ groups: [...s.groups, group] }));
    return group;
  },

  updateGroup: async (id, params) => {
    const updated = await http.updateGroup(id, params);
    set((s) => ({
      groups: s.groups.map((g) => (g.id === id ? updated : g)),
    }));
  },

  deleteGroup: async (id) => {
    await http.deleteGroup(id);
    set((s) => ({ groups: s.groups.filter((g) => g.id !== id) }));
  },

  assignToGroup: async (groupId, agentId) => {
    const updated = await http.assignToGroup(groupId, agentId);
    set((s) => ({
      groups: s.groups.map((g) => (g.id === groupId ? updated : g)),
    }));
  },

  // -----------------------------------------------------------------------
  // Emails
  // -----------------------------------------------------------------------
  emails: [],
  threads: [],
  emailsLoading: false,
  selectedEmailId: null,

  fetchEmails: async (filter?) => {
    set({ emailsLoading: true });
    try {
      const emails = await http.fetchEmails(filter);
      set({ emails, emailsLoading: false });
    } catch (err) {
      console.error('Failed to fetch emails:', err);
      set({ emailsLoading: false });
    }
  },

  fetchEmailThreads: async () => {
    set({ emailsLoading: true });
    try {
      const threads = await http.fetchEmailThreads();
      set({ threads, emailsLoading: false });
    } catch (err) {
      console.error('Failed to fetch threads:', err);
      set({ emailsLoading: false });
    }
  },

  fetchEmail: async (id) => {
    return http.fetchEmail(id);
  },

  deleteAllEmails: async () => {
    await http.deleteAllEmails();
    set({ emails: [], threads: [], selectedEmailId: null });
  },

  setSelectedEmailId: (id) => set({ selectedEmailId: id }),

  addEmail: (email) =>
    set((s) => ({ emails: [email, ...s.emails] })),

  updateEmailStatus: (emailId, status) =>
    set((s) => ({
      emails: s.emails.map(e =>
        e.id === emailId
          ? { ...e, ...(status.isRead !== undefined && { isRead: status.isRead }), ...(status.isProcessed !== undefined && { isProcessed: status.isProcessed }) }
          : e
      ),
    })),

  // -----------------------------------------------------------------------
  // Chat
  // -----------------------------------------------------------------------
  chatMessages: [],
  chatSessionId: null,
  chatSessions: [],
  chatSessionsLoading: false,
  isStreaming: false,
  streamingContent: '',
  agenticSteps: [],
  pendingFinalMessage: null,

  fetchChatSessions: async () => {
    set({ chatSessionsLoading: true });
    try {
      const sessions = await http.fetchChatSessions();
      set({ chatSessions: sessions, chatSessionsLoading: false });
    } catch (err) {
      console.error('Failed to fetch chat sessions:', err);
      set({ chatSessionsLoading: false });
    }
  },

  fetchChatMessages: async (sessionId) => {
    const messages = await http.fetchChatMessages(sessionId);
    set({ chatMessages: messages, chatSessionId: sessionId });
  },

  deleteChatSession: async (sessionId) => {
    await http.deleteChatSession(sessionId);
    const { chatSessionId } = get();
    set((s) => ({
      chatSessions: s.chatSessions.filter((ses) => ses.id !== sessionId),
      ...(chatSessionId === sessionId
        ? { chatMessages: [], chatSessionId: null, streamingContent: '', agenticSteps: [] }
        : {}),
    }));
  },

  selectChatSession: async (sessionId) => {
    const messages = await http.fetchChatMessages(sessionId);
    set({ chatMessages: messages, chatSessionId: sessionId, streamingContent: '', agenticSteps: [] });
  },

  startNewChatSession: () => {
    set({ chatMessages: [], chatSessionId: null, streamingContent: '', agenticSteps: [] });
  },

  setChatSessionId: (id) => set({ chatSessionId: id }),

  addChatMessage: (message) =>
    set((s) => ({ chatMessages: [...s.chatMessages, message] })),

  setIsStreaming: (streaming) => set({ isStreaming: streaming }),

  appendStreamingContent: (chunk) =>
    set((s) => ({ streamingContent: s.streamingContent + chunk })),

  clearStreamingContent: () => set({ streamingContent: '' }),

  sendChatMessage: (content) => {
    const sessionId = get().chatSessionId || undefined;
    wsClient.send('chat:send', { sessionId, content });
  },

  addAgenticStep: (step) =>
    set((s) => ({ agenticSteps: [...s.agenticSteps, step] })),

  clearAgenticSteps: () => set({ agenticSteps: [] }),

  setPendingFinalMessage: (msg) => set({ pendingFinalMessage: msg }),

  finalizeChatResponse: () => {
    const { pendingFinalMessage, agenticSteps } = get();
    if (pendingFinalMessage) {
      const finalMsg: ChatMessage = {
        ...pendingFinalMessage,
        metadata: {
          ...pendingFinalMessage.metadata,
          ...(agenticSteps.length > 0 ? { agenticSteps: [...agenticSteps] } : {}),
        },
      };
      set((s) => ({
        chatMessages: [...s.chatMessages, finalMsg],
        pendingFinalMessage: null,
        agenticSteps: [],
        streamingContent: '',
        isStreaming: false,
      }));
    } else {
      set({
        agenticSteps: [],
        streamingContent: '',
        isStreaming: false,
        pendingFinalMessage: null,
      });
    }
  },

  // -----------------------------------------------------------------------
  // Tools
  // -----------------------------------------------------------------------
  tools: [],
  toolsLoading: false,

  fetchTools: async () => {
    set({ toolsLoading: true });
    try {
      const tools = await http.fetchTools();
      set({ tools, toolsLoading: false });
    } catch (err) {
      console.error('Failed to fetch tools:', err);
      set({ toolsLoading: false });
    }
  },

  createTool: async (params) => {
    const tool = await http.createTool(params);
    set((s) => ({ tools: [...s.tools, tool] }));
    return tool;
  },

  updateTool: async (id, params) => {
    const updated = await http.updateTool(id, params);
    set((s) => ({
      tools: s.tools.map((t) => (t.id === id ? updated : t)),
    }));
  },

  deleteTool: async (id) => {
    await http.deleteTool(id);
    set((s) => ({ tools: s.tools.filter((t) => t.id !== id) }));
  },

  // -----------------------------------------------------------------------
  // Skills
  // -----------------------------------------------------------------------
  skills: [],
  skillsLoading: false,

  fetchSkills: async () => {
    set({ skillsLoading: true });
    try {
      const skills = await http.fetchSkills();
      set({ skills, skillsLoading: false });
    } catch (err) {
      console.error('Failed to fetch skills:', err);
      set({ skillsLoading: false });
    }
  },

  createSkill: async (params) => {
    const skill = await http.createSkill(params);
    set((s) => ({ skills: [...s.skills, skill] }));
    return skill;
  },

  updateSkill: async (id, params) => {
    const updated = await http.updateSkill(id, params);
    set((s) => ({
      skills: s.skills.map((sk) => (sk.id === id ? updated : sk)),
    }));
  },

  deleteSkill: async (id) => {
    await http.deleteSkill(id);
    set((s) => ({ skills: s.skills.filter((sk) => sk.id !== id) }));
  },

  // -----------------------------------------------------------------------
  // Metrics
  // -----------------------------------------------------------------------
  tokenUsage: null,
  llmPerformance: [],
  agentMetrics: [],
  queueStats: null,
  metricsLoading: false,

  fetchTokenMetrics: async () => {
    set({ metricsLoading: true });
    try {
      const tokenUsage = await http.fetchTokenMetrics();
      set({ tokenUsage, metricsLoading: false });
    } catch (err) {
      console.error('Failed to fetch token metrics:', err);
      set({ metricsLoading: false });
    }
  },

  fetchLLMPerformance: async () => {
    set({ metricsLoading: true });
    try {
      const llmPerformance = await http.fetchLLMPerformance();
      set({ llmPerformance, metricsLoading: false });
    } catch (err) {
      console.error('Failed to fetch LLM performance:', err);
      set({ metricsLoading: false });
    }
  },

  fetchAgentMetrics: async () => {
    set({ metricsLoading: true });
    try {
      const agentMetrics = await http.fetchAgentMetrics();
      set({ agentMetrics, metricsLoading: false });
    } catch (err) {
      console.error('Failed to fetch agent metrics:', err);
      set({ metricsLoading: false });
    }
  },

  fetchQueueStats: async () => {
    set({ metricsLoading: true });
    try {
      const queueStats = await http.fetchQueueStats();
      set({ queueStats, metricsLoading: false });
    } catch (err) {
      console.error('Failed to fetch queue stats:', err);
      set({ metricsLoading: false });
    }
  },

  setQueueStats: (stats) => set({ queueStats: stats }),

  // -----------------------------------------------------------------------
  // Settings
  // -----------------------------------------------------------------------
  globalSettings: null,
  projectSettings: null,
  settingsLoading: false,
  providerTestResult: null,
  providerAvailableModels: null,

  fetchGlobalSettings: async () => {
    set({ settingsLoading: true });
    try {
      const raw = await http.fetchGlobalSettings();
      const globalSettings: GlobalSettings = {
        providers: Array.isArray(raw.providers) ? raw.providers : [],
        smtpPort: raw.smtpPort ?? 2525,
        uiTheme: raw.uiTheme ?? 'system',
        logLevel: raw.logLevel ?? 'info',
      };
      set({ globalSettings, settingsLoading: false });
    } catch (err) {
      console.error('Failed to fetch global settings:', err);
      set({ settingsLoading: false });
    }
  },

  updateGlobalSettings: async (params) => {
    const updated = await http.updateGlobalSettings(params);
    set({ globalSettings: updated });
  },

  fetchProjectSettings: async () => {
    set({ settingsLoading: true });
    try {
      const projectSettings = await http.fetchProjectSettings();
      set({ projectSettings, settingsLoading: false });
    } catch (err) {
      console.error('Failed to fetch project settings:', err);
      set({ settingsLoading: false });
    }
  },

  updateProjectSettings: async (params) => {
    const updated = await http.updateProjectSettings(params);
    set({ projectSettings: updated });
  },

  addProvider: async (params) => {
    try {
      await http.createProvider(params);
      await get().fetchGlobalSettings();
    } catch (err) {
      console.error('Failed to add provider:', err);
      throw err;
    }
  },

  removeProvider: async (providerId) => {
    try {
      await http.deleteProvider(providerId);
      await get().fetchGlobalSettings();
    } catch (err) {
      console.error('Failed to remove provider:', err);
      throw err;
    }
  },

  updateProvider: async (id, params) => {
    try {
      await http.updateProviderApi(id, params);
      await get().fetchGlobalSettings();
    } catch (err) {
      console.error('Failed to update provider:', err);
      throw err;
    }
  },

  testProviderConfig: async (params) => {
    set({ providerTestResult: null, providerAvailableModels: null });
    try {
      const result = await http.testProviderConfig(params);
      set({ providerTestResult: result });
      if (result.models && result.models.length > 0) {
        set({ providerAvailableModels: result.models });
      }
    } catch (err) {
      set({ providerTestResult: { available: false, error: err instanceof Error ? err.message : 'Unknown error' } });
    }
  },

  testProvider: async (id) => {
    set({ providerTestResult: null });
    try {
      const result = await http.testProviderById(id);
      set({ providerTestResult: result });
    } catch (err) {
      set({ providerTestResult: { available: false, error: err instanceof Error ? err.message : 'Unknown error' } });
    }
  },

  fetchProviderModels: async (id) => {
    set({ providerAvailableModels: null });
    try {
      const result = await http.fetchProviderModels(id);
      set({ providerAvailableModels: result.models });
    } catch (err) {
      console.error('Failed to fetch provider models:', err);
    }
  },

  updateProviderModels: async (id, models) => {
    try {
      await http.updateProviderModels(id, models);
      await get().fetchGlobalSettings();
    } catch (err) {
      console.error('Failed to update provider models:', err);
      throw err;
    }
  },

  // -----------------------------------------------------------------------
  // System
  // -----------------------------------------------------------------------
  systemStatus: null,
  connected: false,

  fetchSystemStatus: async () => {
    try {
      const systemStatus = await http.fetchSystemStatus();
      set({ systemStatus });
    } catch (err) {
      console.error('Failed to fetch system status:', err);
    }
  },

  setConnected: (connected) => set({ connected }),

  setSystemStatus: (status) => set({ systemStatus: status }),

  openProject: async (workDir) => {
    try {
      await http.openProject(workDir);
      // Refresh system status and all data after project switch
      const systemStatus = await http.fetchSystemStatus();
      set({ systemStatus });
      // Reload project-level data
      await Promise.all([
        get().fetchAgents(),
        get().fetchGroups(),
        get().fetchEmails(),
        get().fetchTools(),
        get().fetchSkills(),
        get().fetchProjectSettings(),
      ]);
    } catch (err) {
      console.error('Failed to open project:', err);
      throw err;
    }
  },

  freezeOperations: async () => {
    try {
      await http.freezeSystem();
      const systemStatus = await http.fetchSystemStatus();
      set({ systemStatus });
    } catch (err) {
      console.error('Failed to freeze operations:', err);
      throw err;
    }
  },

  resumeOperations: async () => {
    try {
      await http.resumeSystem();
      const systemStatus = await http.fetchSystemStatus();
      set({ systemStatus });
    } catch (err) {
      console.error('Failed to resume operations:', err);
      throw err;
    }
  },

  stopAllOperations: async () => {
    try {
      await http.stopAllOperations();
      const systemStatus = await http.fetchSystemStatus();
      set({ systemStatus });
      // Refresh agents (their status changed)
      await get().fetchAgents();
    } catch (err) {
      console.error('Failed to stop all operations:', err);
      throw err;
    }
  },

  // -----------------------------------------------------------------------
  // UI
  // -----------------------------------------------------------------------
  sidebarOpen: true,
  theme: 'system',

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setTheme: (theme) => set({ theme }),
}));
