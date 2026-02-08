import { v4 as uuid } from 'uuid';
import type { ToolCallRequest, ToolCallResult } from '@mailgent/shared';
import type { ToolRegistry } from './tool-registry';
import type { EventBus } from '../utils/event-bus';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('tool-executor');

export class ToolExecutor {
  constructor(
    private registry: ToolRegistry,
    private eventBus: EventBus,
    private timeoutMs: number = 30000,
  ) {}

  async execute(request: ToolCallRequest): Promise<ToolCallResult> {
    const start = Date.now();
    const handler = this.registry.getHandler(request.toolName);

    if (!handler) {
      return {
        requestId: request.requestId,
        toolName: request.toolName,
        success: false,
        error: `Tool "${request.toolName}" not found`,
        durationMs: Date.now() - start,
      };
    }

    try {
      const result = await Promise.race([
        handler(request.parameters, request.agentId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tool execution timeout')), this.timeoutMs)
        ),
      ]);

      const toolResult: ToolCallResult = {
        requestId: request.requestId,
        toolName: request.toolName,
        success: true,
        result,
        durationMs: Date.now() - start,
      };

      this.eventBus.emit('tool:executed', { result: toolResult, agentId: request.agentId });
      return toolResult;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      log.error({ tool: request.toolName, error, agentId: request.agentId }, 'Tool execution failed');

      return {
        requestId: request.requestId,
        toolName: request.toolName,
        success: false,
        error,
        durationMs: Date.now() - start,
      };
    }
  }
}
