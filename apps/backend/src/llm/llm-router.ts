import type { LLMRoutingRule, LLMCompletionRequest, LLMCompletionResponse } from '@mailgent/shared';
import type { LLMProvider } from './llm-provider';
import type { LLMFactory } from './llm-factory';
import type { RateLimiter } from './rate-limiter';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('llm-router');

export class LLMRouter {
  private rules: LLMRoutingRule[] = [];

  constructor(
    private factory: LLMFactory,
    private rateLimiter: RateLimiter,
  ) {}

  setRules(rules: LLMRoutingRule[]): void {
    this.rules = rules.filter(r => r.isEnabled).sort((a, b) => b.priority - a.priority);
  }

  async route(
    request: LLMCompletionRequest,
    taskType: string = 'general',
  ): Promise<LLMCompletionResponse> {
    const rule = this.rules.find(r => r.taskType === taskType || r.taskType === '*');

    let providerId = rule?.preferredProviderId || request.providerId;
    let modelId = rule?.preferredModelId || request.modelId;

    let provider = providerId ? this.factory.getProvider(providerId) : undefined;

    // Fallback: if no provider found, use the first available one
    if (!provider) {
      const allProviders = this.factory.getAllProviders();
      const first = allProviders.entries().next();
      if (!first.done) {
        providerId = first.value[0];
        provider = first.value[1];
        log.warn({ requestedProviderId: request.providerId, fallbackProviderId: providerId }, 'Requested provider not found, using fallback');
      }
    }

    if (!provider) {
      throw new Error('Provider not found');
    }

    const req = { ...request, providerId, modelId };
    let retryCount = 0;

    while (retryCount < 5) {
      try {
        await this.rateLimiter.acquire(providerId, modelId);
        const response = await provider.complete(req);
        this.rateLimiter.recordTokens(providerId, modelId, response.usage.totalTokens);
        return response;
      } catch (err: any) {
        const isRateLimit = err?.status === 429 || err?.message?.includes('rate_limit');
        if (!isRateLimit) throw err;

        const strategy = this.rateLimiter.handleRateLimit(providerId, modelId, retryCount);

        if (strategy.useFallback && rule?.fallbackProviderId && rule?.fallbackModelId) {
          log.info({ fallbackProvider: rule.fallbackProviderId, fallbackModel: rule.fallbackModelId }, 'Switching to fallback');
          const fallbackProvider = this.factory.getProvider(rule.fallbackProviderId);
          if (fallbackProvider) {
            provider = fallbackProvider;
            req.providerId = rule.fallbackProviderId;
            req.modelId = rule.fallbackModelId;
            retryCount = 0;
            continue;
          }
        }

        if (!strategy.shouldRetry) throw err;

        log.info({ delayMs: strategy.delayMs, retryCount }, 'Retrying after rate limit');
        await new Promise(resolve => setTimeout(resolve, strategy.delayMs));
        retryCount++;
      }
    }

    throw new Error('Max retries exceeded');
  }

  async routeStream(
    request: LLMCompletionRequest,
    onChunk: (chunk: string) => void,
    taskType: string = 'general',
  ): Promise<LLMCompletionResponse> {
    const rule = this.rules.find(r => r.taskType === taskType || r.taskType === '*');

    let providerId = rule?.preferredProviderId || request.providerId;
    let modelId = rule?.preferredModelId || request.modelId;

    let provider = providerId ? this.factory.getProvider(providerId) : undefined;

    // Fallback: if no provider found, use the first available one
    if (!provider) {
      const allProviders = this.factory.getAllProviders();
      const first = allProviders.entries().next();
      if (!first.done) {
        providerId = first.value[0];
        provider = first.value[1];
        log.warn({ requestedProviderId: request.providerId, fallbackProviderId: providerId }, 'Requested provider not found, using fallback');
      }
    }

    if (!provider) {
      throw new Error('Provider not found');
    }

    await this.rateLimiter.acquire(providerId, modelId);
    const response = await provider.completeStream(
      { ...request, providerId, modelId },
      onChunk,
    );
    this.rateLimiter.recordTokens(providerId, modelId, response.usage.totalTokens);
    return response;
  }
}
