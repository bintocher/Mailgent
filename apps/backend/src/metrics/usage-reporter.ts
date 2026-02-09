import type { AgentMetrics, TokenUsageTimeSeries, MetricsTimeRange } from '@mailgent/shared';
import type { MetricsRepository } from '../db/repositories/metrics.repo';

export class UsageReporter {
  constructor(private metricsRepo: MetricsRepository) {}

  getAgentMetrics(agentId: string): AgentMetrics | undefined {
    return this.metricsRepo.getAgentMetrics(agentId);
  }

  getAllAgentMetrics(): AgentMetrics[] {
    return this.metricsRepo.getAllAgentMetrics();
  }

  getTotalCost(timeRange?: MetricsTimeRange): number {
    return this.metricsRepo.getTotalCost(timeRange);
  }

  getUsageTimeSeries(timeRange: MetricsTimeRange, agentId?: string, modelId?: string): TokenUsageTimeSeries[] {
    return this.metricsRepo.getUsageTimeSeries(timeRange, agentId, modelId);
  }

  getSummary(timeRange?: MetricsTimeRange) {
    const cost = this.metricsRepo.getTotalCost(timeRange);
    const performance = this.metricsRepo.getPerformanceStats();

    return {
      totalCostUsd: cost,
      totalModels: new Set(performance.map(p => p.modelId)).size,
      totalCalls: performance.reduce((sum, p) => sum + p.totalCalls, 0),
      avgSuccessRate: performance.length > 0
        ? performance.reduce((sum, p) => sum + p.successRate, 0) / performance.length
        : 0,
    };
  }
}
