import { createChildLogger } from '../utils/logger';

const log = createChildLogger('rate-limiter');

interface SlidingWindow {
  requests: number[];
  tokens: number[];
  maxRpm: number;
  maxTpm: number;
}

interface RetryStrategy {
  shouldRetry: boolean;
  delayMs: number;
  useFallback: boolean;
}

export class RateLimiter {
  private windows = new Map<string, SlidingWindow>();
  private rateLimitHits = new Map<string, number>();

  configure(key: string, maxRpm: number, maxTpm: number): void {
    this.windows.set(key, {
      requests: [],
      tokens: [],
      maxRpm,
      maxTpm,
    });
  }

  async acquire(providerId: string, modelId: string): Promise<void> {
    const key = `${providerId}:${modelId}`;
    const window = this.windows.get(key);
    if (!window) return;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    window.requests = window.requests.filter(t => t > oneMinuteAgo);

    if (window.requests.length >= window.maxRpm) {
      const waitTime = window.requests[0] - oneMinuteAgo + 100;
      log.info({ key, waitTime, currentRpm: window.requests.length }, 'Rate limit reached, waiting');
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    window.requests.push(now);
  }

  recordTokens(providerId: string, modelId: string, tokens: number): void {
    const key = `${providerId}:${modelId}`;
    const window = this.windows.get(key);
    if (!window) return;

    const now = Date.now();
    window.tokens.push(now);
  }

  handleRateLimit(providerId: string, modelId: string, retryCount: number): RetryStrategy {
    const key = `${providerId}:${modelId}`;
    this.rateLimitHits.set(key, (this.rateLimitHits.get(key) || 0) + 1);

    const baseDelay = 1000;
    const maxDelay = 60000;
    const jitter = Math.random() * 1000;
    const delayMs = Math.min(baseDelay * Math.pow(2, retryCount) + jitter, maxDelay);

    const shouldRetry = retryCount < 5;
    const useFallback = delayMs >= maxDelay;

    log.info({ key, retryCount, delayMs, useFallback }, 'Rate limit handling');

    return { shouldRetry, delayMs, useFallback };
  }

  getHits(providerId: string, modelId?: string): number {
    if (modelId) {
      return this.rateLimitHits.get(`${providerId}:${modelId}`) || 0;
    }
    let total = 0;
    for (const [key, hits] of this.rateLimitHits) {
      if (key.startsWith(providerId + ':')) total += hits;
    }
    return total;
  }

  getStatus(providerId: string, modelId: string): { rpm: number; maxRpm: number } {
    const key = `${providerId}:${modelId}`;
    const window = this.windows.get(key);
    if (!window) return { rpm: 0, maxRpm: 0 };

    const oneMinuteAgo = Date.now() - 60000;
    const currentRpm = window.requests.filter(t => t > oneMinuteAgo).length;

    return { rpm: currentRpm, maxRpm: window.maxRpm };
  }
}
