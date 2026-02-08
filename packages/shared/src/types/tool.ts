export type ToolCategory = 'filesystem' | 'system' | 'git' | 'communication' | 'orchestration' | 'meta';

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: unknown;
  enum?: string[];
}

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: ToolCategory;
  parameters: ToolParameter[];
  isBuiltin: boolean;
  isEnabled: boolean;
  code?: string; // Custom tool source code
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolCallRequest {
  toolId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  agentId: string;
  requestId: string;
}

export interface ToolCallResult {
  requestId: string;
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
}
