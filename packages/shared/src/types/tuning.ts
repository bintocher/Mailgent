export interface TuningSession {
  id: string;
  agentId: string;
  agentName: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  modelsTested: string[];       // ["providerId:modelId", ...]
  tasksCount: number;
  progress: number;             // 0-100
  completedSteps?: number;
  totalSteps?: number;
  phase?: string;               // e.g. "generating", "testing", "judging"
  recommendation?: TuningRecommendation;
  error?: string;
  startedAt: string;
  completedAt?: string;
}

export interface TuningResult {
  id: string;
  sessionId: string;
  modelId: string;
  providerId: string;
  taskIndex: number;
  taskPrompt: string;
  response: string;
  score: number;                // 1-10 from judge
  judgeComment?: string;
  tokens: number;
  costUsd: number;
  durationMs: number;
}

export interface TuningRecommendation {
  bestOverall: TuningModelSummary;    // highest avgScore
  bestValue: TuningModelSummary;      // best score/cost ratio
  bestSpeed: TuningModelSummary;      // lowest avgDurationMs
  allModels: TuningModelSummary[];
}

export interface TuningModelSummary {
  modelId: string;
  providerId: string;
  modelDisplayName: string;
  avgScore: number;
  avgTokens: number;
  totalCostUsd: number;
  avgDurationMs: number;
  successRate: number;
  scores: number[];              // per-task scores for sparkline
}

export interface TuningStartParams {
  agentId: string;
  tasksCount: number;            // 3-10
  modelIds?: string[];           // ["providerId:modelId", ...] — if empty, test all enabled
  judgeModelId?: string;         // "providerId:modelId" — if empty, auto-select most expensive
}
