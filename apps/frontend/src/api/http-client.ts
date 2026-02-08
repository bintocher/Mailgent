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
  LLMProviderConfig,
  AgentMetrics,
  QueueStats,
  SystemStatus,
  MetricsTimeRange,
} from '@mailgent/shared';

// ---------------------------------------------------------------------------
// Generic helper
// ---------------------------------------------------------------------------

const BASE_URL = '/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: unknown,
  ) {
    super(`API ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

async function api<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text().catch(() => null);
    }
    throw new ApiError(res.status, res.statusText, body);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as unknown as T;
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Agents
// ---------------------------------------------------------------------------

export function fetchAgents(): Promise<Agent[]> {
  return api<Agent[]>('/agents');
}

export function createAgent(params: AgentCreateParams): Promise<Agent> {
  return api<Agent>('/agents', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function updateAgent(
  id: string,
  params: Partial<AgentCreateParams>,
): Promise<Agent> {
  return api<Agent>(`/agents/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export function deleteAgent(id: string): Promise<void> {
  return api<void>(`/agents/${id}`, { method: 'DELETE' });
}

export function stopAgent(id: string): Promise<Agent> {
  return api<Agent>(`/agents/${id}/stop`, { method: 'POST' });
}

export function startAgent(id: string): Promise<Agent> {
  return api<Agent>(`/agents/${id}/start`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export function fetchGroups(): Promise<AgentGroup[]> {
  return api<AgentGroup[]>('/groups');
}

export function createGroup(
  params: Omit<AgentGroup, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<AgentGroup> {
  return api<AgentGroup>('/groups', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function updateGroup(
  id: string,
  params: Partial<AgentGroup>,
): Promise<AgentGroup> {
  return api<AgentGroup>(`/groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export function deleteGroup(id: string): Promise<void> {
  return api<void>(`/groups/${id}`, { method: 'DELETE' });
}

export function assignToGroup(
  groupId: string,
  agentId: string,
): Promise<AgentGroup> {
  return api<AgentGroup>(`/groups/${groupId}/agents`, {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  });
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

export function fetchEmails(filter?: EmailFilter): Promise<Email[]> {
  const params = filter
    ? '?' + new URLSearchParams(
        Object.entries(filter)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  return api<Email[]>(`/emails${params}`);
}

export function fetchEmailThreads(): Promise<EmailThread[]> {
  return api<EmailThread[]>('/emails/threads');
}

export function fetchEmail(id: string): Promise<Email> {
  return api<Email>(`/emails/${id}`);
}

export function deleteAllEmails(): Promise<{ deleted: number }> {
  return api<{ deleted: number }>('/emails', { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

export function fetchTools(): Promise<ToolDefinition[]> {
  return api<ToolDefinition[]>('/tools');
}

export function createTool(
  params: Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<ToolDefinition> {
  return api<ToolDefinition>('/tools', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function updateTool(
  id: string,
  params: Partial<ToolDefinition>,
): Promise<ToolDefinition> {
  return api<ToolDefinition>(`/tools/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export function deleteTool(id: string): Promise<void> {
  return api<void>(`/tools/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export function fetchSkills(): Promise<SkillDefinition[]> {
  return api<SkillDefinition[]>('/skills');
}

export function createSkill(
  params: Omit<SkillDefinition, 'id' | 'createdAt' | 'updatedAt'>,
): Promise<SkillDefinition> {
  return api<SkillDefinition>('/skills', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function updateSkill(
  id: string,
  params: Partial<SkillDefinition>,
): Promise<SkillDefinition> {
  return api<SkillDefinition>(`/skills/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(params),
  });
}

export function deleteSkill(id: string): Promise<void> {
  return api<void>(`/skills/${id}`, { method: 'DELETE' });
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

export function fetchProviders(): Promise<LLMProviderConfig[]> {
  return api<LLMProviderConfig[]>('/providers');
}

export function createProvider(
  params: Record<string, unknown>,
): Promise<LLMProviderConfig> {
  return api<LLMProviderConfig>('/providers', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function updateProviderApi(
  id: string,
  params: Record<string, unknown>,
): Promise<LLMProviderConfig> {
  return api<LLMProviderConfig>(`/providers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export function deleteProvider(id: string): Promise<void> {
  return api<void>(`/providers/${id}`, { method: 'DELETE' });
}

export function testProviderConfig(
  params: Record<string, unknown>,
): Promise<{ available: boolean; error?: string; latencyMs?: number; models?: Array<{ id: string }> }> {
  return api('/providers/test', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function testProviderById(
  id: string,
): Promise<{ available: boolean; error?: string; latencyMs?: number }> {
  return api(`/providers/${id}/test`, { method: 'POST' });
}

export function fetchProviderModels(
  id: string,
): Promise<{ models: Array<{ id: string; endpoint?: string; source?: string }> }> {
  return api(`/providers/${id}/models`, { method: 'POST' });
}

export function updateProviderModels(
  id: string,
  models: Array<Record<string, unknown>>,
): Promise<LLMProviderConfig> {
  return api<LLMProviderConfig>(`/providers/${id}/models`, {
    method: 'PATCH',
    body: JSON.stringify({ models }),
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export function fetchGlobalSettings(): Promise<GlobalSettings> {
  return api<GlobalSettings>('/settings/global');
}

export function updateGlobalSettings(
  params: Partial<GlobalSettings>,
): Promise<GlobalSettings> {
  return api<GlobalSettings>('/settings/global', {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

export function fetchProjectSettings(): Promise<ProjectSettings> {
  return api<ProjectSettings>('/settings/project');
}

export function updateProjectSettings(
  params: Partial<ProjectSettings>,
): Promise<ProjectSettings> {
  return api<ProjectSettings>('/settings/project', {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export function fetchChatSessions(): Promise<ChatSession[]> {
  return api<ChatSession[]>('/chat/sessions');
}

export function fetchChatMessages(sessionId: string): Promise<ChatMessage[]> {
  return api<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`);
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export function fetchTokenMetrics(
  range?: MetricsTimeRange,
): Promise<{ total: TokenUsage; timeSeries: TokenUsageTimeSeries[] }> {
  const params = range
    ? '?' + new URLSearchParams(
        Object.entries(range).map(([k, v]) => [k, String(v)]),
      ).toString()
    : '';
  return api(`/metrics/tokens${params}`);
}

export function fetchLLMPerformance(): Promise<LLMPerformanceStats[]> {
  return api<LLMPerformanceStats[]>('/metrics/llm');
}

export function fetchAgentMetrics(): Promise<AgentMetrics[]> {
  return api<AgentMetrics[]>('/metrics/agents');
}

export function fetchQueueStats(): Promise<QueueStats> {
  return api<QueueStats>('/metrics/queue');
}

// ---------------------------------------------------------------------------
// System
// ---------------------------------------------------------------------------

export function fetchHealth(): Promise<{ status: string }> {
  return api<{ status: string }>('/health');
}

export function fetchSystemStatus(): Promise<SystemStatus> {
  return api<SystemStatus>('/system/status');
}

export function freezeSystem(): Promise<{ status: string; paused: boolean }> {
  return api<{ status: string; paused: boolean }>('/system/freeze', { method: 'POST' });
}

export function resumeSystem(): Promise<{ status: string; paused: boolean }> {
  return api<{ status: string; paused: boolean }>('/system/resume', { method: 'POST' });
}

export function stopAllOperations(): Promise<{ status: string }> {
  return api<{ status: string }>('/system/stop-all', { method: 'POST' });
}

export function openProject(workDir: string): Promise<{ workDir: string; status: string }> {
  return api<{ workDir: string; status: string }>('/project/open', {
    method: 'POST',
    body: JSON.stringify({ workDir }),
  });
}

export interface BrowseEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface BrowseResult {
  path: string;
  parent: string;
  entries: BrowseEntry[];
}

export function browseDirectories(dirPath?: string): Promise<BrowseResult> {
  const params = dirPath ? '?' + new URLSearchParams({ path: dirPath }).toString() : '';
  return api<BrowseResult>(`/system/browse${params}`);
}
