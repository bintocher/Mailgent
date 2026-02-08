import type { LLMPerformanceStats } from '@mailgent/shared';
import type { MetricsRepository } from '../db/repositories/metrics.repo';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('llm-performance');

export class LLMPerformanceTracker {
  constructor(private metricsRepo: MetricsRepository) {}

  getPerformanceStats(modelId?: string, taskType?: string): LLMPerformanceStats[] {
    return this.metricsRepo.getPerformanceStats(modelId, taskType);
  }

  getBestModelForTask(taskType: string): string | null {
    const stats = this.metricsRepo.getPerformanceStats(undefined, taskType);
    if (stats.length === 0) return null;

    // Sort by success rate, then by avg quality score, then by cost
    stats.sort((a, b) => {
      if (b.successRate !== a.successRate) return b.successRate - a.successRate;
      if (b.avgQualityScore !== a.avgQualityScore) return b.avgQualityScore - a.avgQualityScore;
      return a.totalCostUsd - b.totalCostUsd;
    });

    return stats[0].modelId;
  }
}
