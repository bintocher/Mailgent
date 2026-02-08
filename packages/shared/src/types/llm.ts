export type LLMProviderType = 'openai' | 'anthropic' | 'openai-compatible' | 'z.ai';

export interface ZaiEndpoints {
  general: string;
  coding: string;
  anthropic: string;
}

export interface LLMProviderConfig {
  id: string;
  name: string;
  type: LLMProviderType;
  apiKey: string;
  baseUrl: string;
  models: LLMModel[];
  isEnabled: boolean;
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LLMModel {
  id: string;
  displayName: string;
  providerId: string;
  contextWindow: number;
  costPerInputToken: number;
  costPerOutputToken: number;
  capabilities: string[];
  isEnabled: boolean;
}

export interface LLMChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: LLMToolCall[];
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: string; // JSON string
}

export interface LLMCompletionRequest {
  messages: LLMChatMessage[];
  modelId: string;
  providerId: string;
  temperature?: number;
  maxTokens?: number;
  tools?: LLMToolDefinition[];
  stream?: boolean;
}

export interface LLMToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface LLMCompletionResponse {
  content: string;
  toolCalls?: LLMToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  modelId: string;
  providerId: string;
  durationMs: number;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface LLMUsageRecord {
  id: string;
  agentId: string;
  agentName: string;
  groupId?: string;
  modelId: string;
  providerId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  taskType: string;
  durationMs: number;
  success: boolean;
  qualityScore?: number;
  timestamp: string;
}

export interface LLMRoutingRule {
  id: string;
  name: string;
  taskType: string;
  preferredModelId: string;
  preferredProviderId: string;
  fallbackModelId?: string;
  fallbackProviderId?: string;
  maxCostPerCall?: number;
  priority: number;
  isEnabled: boolean;
}
