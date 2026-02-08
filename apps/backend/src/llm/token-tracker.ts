import { v4 as uuid } from 'uuid';
import type { LLMUsageRecord, LLMCompletionResponse, LLMModel } from '@mailgent/shared';
import type { EventBus } from '../utils/event-bus';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('token-tracker');

export class TokenTracker {
  private models = new Map<string, LLMModel>();

  constructor(private eventBus: EventBus) {}

  registerModel(model: LLMModel): void {
    this.models.set(`${model.providerId}:${model.id}`, model);
  }

  track(
    response: LLMCompletionResponse,
    agentId: string,
    agentName: string,
    taskType: string,
    groupId?: string,
    projectId?: string,
  ): LLMUsageRecord {
    const modelKey = `${response.providerId}:${response.modelId}`;
    const model = this.models.get(modelKey);

    const costUsd = model
      ? response.usage.promptTokens * model.costPerInputToken +
        response.usage.completionTokens * model.costPerOutputToken
      : 0;

    const record: LLMUsageRecord = {
      id: uuid(),
      agentId,
      agentName,
      groupId,
      modelId: response.modelId,
      providerId: response.providerId,
      promptTokens: response.usage.promptTokens,
      completionTokens: response.usage.completionTokens,
      totalTokens: response.usage.totalTokens,
      costUsd,
      taskType,
      durationMs: response.durationMs,
      success: response.finishReason !== 'error',
      timestamp: new Date().toISOString(),
    };

    log.debug({
      agentId,
      model: response.modelId,
      tokens: response.usage.totalTokens,
      cost: costUsd.toFixed(6),
    }, 'Token usage tracked');

    this.eventBus.emit('metrics:usage', record);
    return record;
  }
}
