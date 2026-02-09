import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type {
  LLMUsageRecord,
  LLMPerformanceStats,
  AgentMetrics,
  MetricsTimeRange,
  TokenUsageTimeSeries,
} from '@mailgent/shared';

interface UsageRow {
  id: string;
  agent_id: string;
  agent_name: string;
  group_id: string | null;
  model_id: string;
  provider_id: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
  task_type: string;
  duration_ms: number;
  success: number;
  quality_score: number | null;
  project_id: string | null;
  timestamp: string;
}

function rowToUsageRecord(row: UsageRow): LLMUsageRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    groupId: row.group_id ?? undefined,
    modelId: row.model_id,
    providerId: row.provider_id,
    promptTokens: row.prompt_tokens,
    completionTokens: row.completion_tokens,
    totalTokens: row.total_tokens,
    costUsd: row.cost_usd,
    taskType: row.task_type,
    durationMs: row.duration_ms,
    success: row.success === 1,
    qualityScore: row.quality_score ?? undefined,
    timestamp: row.timestamp,
  };
}

export class MetricsRepository {
  constructor(private db: Database.Database) {}

  recordUsage(record: Omit<LLMUsageRecord, 'id' | 'timestamp'> & { projectId?: string }): LLMUsageRecord {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO llm_usage_records (id, agent_id, agent_name, group_id, model_id, provider_id,
        prompt_tokens, completion_tokens, total_tokens, cost_usd, task_type, duration_ms,
        success, quality_score, project_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      record.agentId,
      record.agentName,
      record.groupId ?? null,
      record.modelId,
      record.providerId,
      record.promptTokens,
      record.completionTokens,
      record.totalTokens,
      record.costUsd,
      record.taskType,
      record.durationMs,
      record.success ? 1 : 0,
      record.qualityScore ?? null,
      record.projectId ?? null,
      now,
    );

    const row = this.db.prepare('SELECT * FROM llm_usage_records WHERE id = ?').get(id) as UsageRow;
    return rowToUsageRecord(row);
  }

  getUsageByAgent(agentId: string, timeRange?: MetricsTimeRange): LLMUsageRecord[] {
    let sql = 'SELECT * FROM llm_usage_records WHERE agent_id = ?';
    const values: unknown[] = [agentId];

    if (timeRange) {
      sql += ' AND timestamp >= ? AND timestamp <= ?';
      values.push(timeRange.from, timeRange.to);
    }

    sql += ' ORDER BY timestamp DESC';

    const rows = this.db.prepare(sql).all(...values) as UsageRow[];
    return rows.map(rowToUsageRecord);
  }

  getUsageByModel(modelId: string, timeRange?: MetricsTimeRange): LLMUsageRecord[] {
    let sql = 'SELECT * FROM llm_usage_records WHERE model_id = ?';
    const values: unknown[] = [modelId];

    if (timeRange) {
      sql += ' AND timestamp >= ? AND timestamp <= ?';
      values.push(timeRange.from, timeRange.to);
    }

    sql += ' ORDER BY timestamp DESC';

    const rows = this.db.prepare(sql).all(...values) as UsageRow[];
    return rows.map(rowToUsageRecord);
  }

  getPerformanceStats(modelId?: string, taskType?: string): LLMPerformanceStats[] {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (modelId !== undefined) { conditions.push('model_id = ?'); values.push(modelId); }
    if (taskType !== undefined) { conditions.push('task_type = ?'); values.push(taskType); }

    let whereClause = '';
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const rows = this.db.prepare(`
      SELECT
        model_id,
        task_type,
        AVG(duration_ms) as avg_duration_ms,
        AVG(total_tokens) as avg_tokens,
        CAST(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as success_rate,
        AVG(CASE WHEN quality_score IS NOT NULL THEN quality_score ELSE 0 END) as avg_quality_score,
        COUNT(*) as total_calls,
        SUM(cost_usd) as total_cost_usd,
        0 as rate_limit_hits,
        MAX(timestamp) as last_used
      FROM llm_usage_records
      ${whereClause}
      GROUP BY model_id, task_type
      ORDER BY total_calls DESC
    `).all(...values) as {
      model_id: string;
      task_type: string;
      avg_duration_ms: number;
      avg_tokens: number;
      success_rate: number;
      avg_quality_score: number;
      total_calls: number;
      total_cost_usd: number;
      rate_limit_hits: number;
      last_used: string;
    }[];

    return rows.map((row) => ({
      modelId: row.model_id,
      taskType: row.task_type,
      avgDurationMs: Math.round(row.avg_duration_ms),
      avgTokens: Math.round(row.avg_tokens),
      successRate: row.success_rate,
      avgQualityScore: row.avg_quality_score,
      totalCalls: row.total_calls,
      totalCostUsd: row.total_cost_usd,
      rateLimitHits: row.rate_limit_hits,
      lastUsed: row.last_used,
    }));
  }

  getAgentMetrics(agentId: string): AgentMetrics | undefined {
    const row = this.db.prepare(`
      SELECT
        agent_id,
        agent_name,
        group_id,
        SUM(total_tokens) as total_tokens_used,
        SUM(cost_usd) as total_cost_usd,
        AVG(duration_ms) as avg_response_time_ms,
        COUNT(*) as total_calls,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as tasks_completed,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as tasks_failed
      FROM llm_usage_records
      WHERE agent_id = ?
      GROUP BY agent_id
    `).get(agentId) as {
      agent_id: string;
      agent_name: string;
      group_id: string | null;
      total_tokens_used: number;
      total_cost_usd: number;
      avg_response_time_ms: number;
      total_calls: number;
      tasks_completed: number;
      tasks_failed: number;
    } | undefined;

    if (!row) return undefined;

    // Compute models used breakdown
    const modelRows = this.db.prepare(`
      SELECT model_id, COUNT(*) as usage_count
      FROM llm_usage_records
      WHERE agent_id = ?
      GROUP BY model_id
    `).all(agentId) as { model_id: string; usage_count: number }[];

    const modelsUsed: Record<string, number> = {};
    for (const mr of modelRows) {
      modelsUsed[mr.model_id] = mr.usage_count;
    }

    return {
      agentId: row.agent_id,
      agentName: row.agent_name,
      groupId: row.group_id ?? undefined,
      totalEmails: 0, // Would need to query project DB; left as 0 for global metrics
      totalTokensUsed: row.total_tokens_used,
      totalCostUsd: row.total_cost_usd,
      totalToolCalls: row.total_calls,
      avgResponseTimeMs: Math.round(row.avg_response_time_ms),
      tasksCompleted: row.tasks_completed,
      tasksFailed: row.tasks_failed,
      modelsUsed,
    };
  }

  getAllAgentMetrics(): AgentMetrics[] {
    const rows = this.db.prepare(`
      SELECT
        agent_id,
        agent_name,
        group_id,
        SUM(total_tokens) as total_tokens_used,
        SUM(cost_usd) as total_cost_usd,
        AVG(duration_ms) as avg_response_time_ms,
        COUNT(*) as total_calls,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as tasks_completed,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as tasks_failed
      FROM llm_usage_records
      GROUP BY agent_id
    `).all() as {
      agent_id: string;
      agent_name: string;
      group_id: string | null;
      total_tokens_used: number;
      total_cost_usd: number;
      avg_response_time_ms: number;
      total_calls: number;
      tasks_completed: number;
      tasks_failed: number;
    }[];

    return rows.map((row) => {
      const modelRows = this.db.prepare(`
        SELECT model_id, COUNT(*) as usage_count
        FROM llm_usage_records
        WHERE agent_id = ?
        GROUP BY model_id
      `).all(row.agent_id) as { model_id: string; usage_count: number }[];

      const modelsUsed: Record<string, number> = {};
      for (const mr of modelRows) {
        modelsUsed[mr.model_id] = mr.usage_count;
      }

      return {
        agentId: row.agent_id,
        agentName: row.agent_name,
        groupId: row.group_id ?? undefined,
        totalEmails: 0,
        totalTokensUsed: row.total_tokens_used,
        totalCostUsd: row.total_cost_usd,
        totalToolCalls: row.total_calls,
        avgResponseTimeMs: Math.round(row.avg_response_time_ms),
        tasksCompleted: row.tasks_completed,
        tasksFailed: row.tasks_failed,
        modelsUsed,
      };
    });
  }

  getUsageTimeSeries(timeRange: MetricsTimeRange, agentId?: string, modelId?: string): TokenUsageTimeSeries[] {
    const conditions: string[] = ['timestamp >= ?', 'timestamp <= ?'];
    const values: unknown[] = [timeRange.from, timeRange.to];

    if (agentId) { conditions.push('agent_id = ?'); values.push(agentId); }
    if (modelId) { conditions.push('model_id = ?'); values.push(modelId); }

    const groupBy = timeRange.granularity === 'hour'
      ? "strftime('%Y-%m-%d %H:00:00', timestamp)"
      : timeRange.granularity === 'day'
      ? "strftime('%Y-%m-%d', timestamp)"
      : timeRange.granularity === 'week'
      ? "strftime('%Y-%W', timestamp)"
      : "strftime('%Y-%m', timestamp)";

    const rows = this.db.prepare(`
      SELECT
        ${groupBy} as period,
        SUM(prompt_tokens) as prompt_tokens,
        SUM(completion_tokens) as completion_tokens,
        SUM(cost_usd) as cost_usd
      FROM llm_usage_records
      WHERE ${conditions.join(' AND ')}
      GROUP BY period
      ORDER BY period ASC
    `).all(...values) as {
      period: string;
      prompt_tokens: number;
      completion_tokens: number;
      cost_usd: number;
    }[];

    return rows.map(r => ({
      timestamp: r.period,
      promptTokens: r.prompt_tokens,
      completionTokens: r.completion_tokens,
      costUsd: r.cost_usd,
      agentId,
      modelId,
    }));
  }

  getTotalCost(timeRange?: MetricsTimeRange): number {
    let sql = 'SELECT COALESCE(SUM(cost_usd), 0) as total FROM llm_usage_records';
    const values: unknown[] = [];

    if (timeRange) {
      sql += ' WHERE timestamp >= ? AND timestamp <= ?';
      values.push(timeRange.from, timeRange.to);
    }

    const row = this.db.prepare(sql).get(...values) as { total: number };
    return row.total;
  }
}
