export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  triggerPattern?: string; // regex or keyword that triggers this skill
  instructions: string;
  requiredToolIds: string[];
  isBuiltin: boolean;
  isEnabled: boolean;
  projectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SkillExecutionRequest {
  skillId: string;
  agentId: string;
  context: string;
  parameters?: Record<string, unknown>;
}

export interface SkillExecutionResult {
  skillId: string;
  success: boolean;
  output?: string;
  error?: string;
  toolCallsCount: number;
  durationMs: number;
}
