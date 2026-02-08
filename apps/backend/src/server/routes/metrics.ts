import { Router } from 'express';
import type { MetricsTimeRange } from '@mailgent/shared';
import type { MetricsRepository } from '../../db/repositories/metrics.repo';
import type { UsageReporter } from '../../metrics/usage-reporter';
import type { MailQueue } from '../../mail/mail-queue';

interface MetricsRoutesDeps {
  metricsRepo: MetricsRepository;
  usageReporter: UsageReporter;
  mailQueue: MailQueue;
}

export function createMetricsRoutes(deps: MetricsRoutesDeps): Router {
  const router = Router();
  const { metricsRepo, usageReporter, mailQueue } = deps;

  // GET /metrics/tokens - Token usage time series with optional filters
  router.get('/tokens', (req, res) => {
    try {
      const agentId = typeof req.query.agentId === 'string' ? req.query.agentId : undefined;
      const modelId = typeof req.query.modelId === 'string' ? req.query.modelId : undefined;
      const from = typeof req.query.from === 'string' ? req.query.from : undefined;
      const to = typeof req.query.to === 'string' ? req.query.to : undefined;
      const granularity = typeof req.query.granularity === 'string'
        ? req.query.granularity as MetricsTimeRange['granularity']
        : 'day';

      if (!from || !to) {
        // Default to last 30 days
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const timeRange: MetricsTimeRange = {
          from: from ?? thirtyDaysAgo.toISOString(),
          to: to ?? now.toISOString(),
          granularity,
        };

        const data = usageReporter.getUsageTimeSeries(timeRange, agentId, modelId);
        res.json(data);
        return;
      }

      const timeRange: MetricsTimeRange = { from, to, granularity };
      const data = usageReporter.getUsageTimeSeries(timeRange, agentId, modelId);
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // GET /metrics/llm-performance - LLM performance stats
  router.get('/llm-performance', (req, res) => {
    try {
      const modelId = typeof req.query.modelId === 'string' ? req.query.modelId : undefined;
      const taskType = typeof req.query.taskType === 'string' ? req.query.taskType : undefined;

      const stats = metricsRepo.getPerformanceStats(modelId, taskType);
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // GET /metrics/agents/:agentId - Get metrics for a specific agent
  router.get('/agents/:agentId', (req, res) => {
    try {
      const metrics = usageReporter.getAgentMetrics(req.params.agentId);
      if (!metrics) {
        res.status(404).json({ error: 'No metrics found for this agent' });
        return;
      }
      res.json(metrics);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // GET /metrics/queue - Get current mail queue statistics
  router.get('/queue', (_req, res) => {
    try {
      const stats = mailQueue.getStats();
      res.json(stats);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  return router;
}
