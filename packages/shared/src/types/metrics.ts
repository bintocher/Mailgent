export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

export interface LLMPerformanceStats {
  modelId: string;
  taskType: string;
  avgDurationMs: number;
  avgTokens: number;
  successRate: number;
  avgQualityScore: number;
  totalCalls: number;
  totalCostUsd: number;
  rateLimitHits: number;
  lastUsed: string;
}

export interface AgentMetrics {
  agentId: string;
  agentName: string;
  groupId?: string;
  totalEmails: number;
  totalTokensUsed: number;
  totalCostUsd: number;
  totalToolCalls: number;
  avgResponseTimeMs: number;
  tasksCompleted: number;
  tasksFailed: number;
  modelsUsed: Record<string, number>;
}

export interface QueueStats {
  totalItems: number;
  pendingItems: number;
  processingItems: number;
  avgWaitTimeMs: number;
  oldestItemAge: number;
}

export interface SystemStatus {
  uptime: number;
  activeAgents: number;
  totalAgents: number;
  queueSize: number;
  queuePaused: boolean;
  smtpRunning: boolean;
  connectedClients: number;
  memoryUsageMb: number;
  workDir: string;
}

export interface MetricsTimeRange {
  from: string;
  to: string;
  granularity: 'hour' | 'day' | 'week' | 'month';
}

export interface TokenUsageTimeSeries {
  timestamp: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  modelId?: string;
  agentId?: string;
}
