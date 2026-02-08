export type AgentStatus = 'idle' | 'thinking' | 'acting' | 'waiting' | 'error' | 'stopped';

export type AgentType = 'system' | 'worker' | 'lead';

export interface Agent {
  id: string;
  name: string;
  email: string;
  type: AgentType;
  status: AgentStatus;
  systemPrompt: string;
  description: string;
  groupId?: string;
  parentAgentId?: string;
  modelId?: string;
  providerId?: string;
  toolIds: string[];
  skillIds: string[];
  maxConcurrentTasks: number;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentGroup {
  id: string;
  name: string;
  description: string;
  email: string;
  leadAgentId?: string;
  memberAgentIds: string[];
  maxMembers: number;
  specializations: string[];
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentCreateParams {
  name: string;
  email: string;
  type: AgentType;
  systemPrompt: string;
  description: string;
  groupId?: string;
  parentAgentId?: string;
  modelId?: string;
  providerId?: string;
  toolIds?: string[];
  skillIds?: string[];
  maxConcurrentTasks?: number;
}

export interface AgentLog {
  id: string;
  agentId: string;
  type: 'think' | 'act' | 'tool_call' | 'tool_result' | 'error' | 'email_sent' | 'email_received';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}
