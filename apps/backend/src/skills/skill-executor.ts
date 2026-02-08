import type { SkillDefinition, SkillExecutionRequest, SkillExecutionResult } from '@mailgent/shared';
import type { SkillRegistry } from './skill-registry';
import type { ToolExecutor } from '../tools/tool-executor';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('skill-executor');

export class SkillExecutor {
  constructor(
    private registry: SkillRegistry,
    private toolExecutor: ToolExecutor,
  ) {}

  async execute(request: SkillExecutionRequest): Promise<SkillExecutionResult> {
    const start = Date.now();
    const skill = this.registry.get(request.skillId);

    if (!skill) {
      return {
        skillId: request.skillId,
        success: false,
        error: `Skill "${request.skillId}" not found`,
        toolCallsCount: 0,
        durationMs: Date.now() - start,
      };
    }

    try {
      log.info({ skill: skill.name, agentId: request.agentId }, 'Executing skill');

      // Skills provide instructions that become part of the agent's context
      // The actual execution happens through the agent's think-act loop
      // This executor validates and prepares the skill context
      return {
        skillId: request.skillId,
        success: true,
        output: skill.instructions,
        toolCallsCount: 0,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error({ skill: skill.name, error }, 'Skill execution failed');

      return {
        skillId: request.skillId,
        success: false,
        error,
        toolCallsCount: 0,
        durationMs: Date.now() - start,
      };
    }
  }
}
