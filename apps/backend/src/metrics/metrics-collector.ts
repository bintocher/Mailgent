import type { LLMUsageRecord } from '@mailgent/shared';
import type { EventBus } from '../utils/event-bus';
import type { MetricsRepository } from '../db/repositories/metrics.repo';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('metrics-collector');

export class MetricsCollector {
  constructor(
    private metricsRepo: MetricsRepository,
    private eventBus: EventBus,
  ) {
    this.setupListeners();
  }

  private setupListeners(): void {
    this.eventBus.on('metrics:usage', (record: LLMUsageRecord) => {
      try {
        this.metricsRepo.recordUsage(record);
        this.eventBus.emit('metrics:update', { type: 'usage', data: record });
      } catch (err) {
        log.error({ error: err }, 'Failed to record usage');
      }
    });
  }

  recordUsage(record: LLMUsageRecord): void {
    this.metricsRepo.recordUsage(record);
    this.eventBus.emit('metrics:update', { type: 'usage', data: record });
  }
}
