import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { TuningSession, TuningResult, TuningRecommendation } from '@mailgent/shared';

interface SessionRow {
  id: string;
  agent_id: string;
  agent_name: string;
  status: string;
  models_tested: string;
  tasks_count: number;
  progress: number;
  recommendation: string | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

interface ResultRow {
  id: string;
  session_id: string;
  model_id: string;
  provider_id: string;
  task_index: number;
  task_prompt: string;
  response: string;
  score: number;
  judge_comment: string | null;
  tokens: number;
  cost_usd: number;
  duration_ms: number;
}

function rowToSession(row: SessionRow): TuningSession {
  return {
    id: row.id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    status: row.status as TuningSession['status'],
    modelsTested: JSON.parse(row.models_tested),
    tasksCount: row.tasks_count,
    progress: row.progress,
    recommendation: row.recommendation ? JSON.parse(row.recommendation) : undefined,
    error: row.error ?? undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? undefined,
  };
}

function rowToResult(row: ResultRow): TuningResult {
  return {
    id: row.id,
    sessionId: row.session_id,
    modelId: row.model_id,
    providerId: row.provider_id,
    taskIndex: row.task_index,
    taskPrompt: row.task_prompt,
    response: row.response,
    score: row.score,
    judgeComment: row.judge_comment ?? undefined,
    tokens: row.tokens,
    costUsd: row.cost_usd,
    durationMs: row.duration_ms,
  };
}

export class TuningRepository {
  constructor(private db: Database.Database) {}

  swapDb(db: Database.Database): void {
    this.db = db;
  }

  createSession(params: {
    agentId: string;
    agentName: string;
    modelsTested: string[];
    tasksCount: number;
  }): TuningSession {
    const id = uuidv4();
    const now = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO tuning_sessions (id, agent_id, agent_name, status, models_tested, tasks_count, progress, started_at)
      VALUES (?, ?, ?, 'pending', ?, ?, 0, ?)
    `).run(
      id,
      params.agentId,
      params.agentName,
      JSON.stringify(params.modelsTested),
      params.tasksCount,
      now,
    );

    return this.getSession(id)!;
  }

  updateSession(id: string, updates: {
    status?: TuningSession['status'];
    progress?: number;
    recommendation?: TuningRecommendation;
    error?: string;
    completedAt?: string;
    modelsTested?: string[];
  }): TuningSession | undefined {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }
    if (updates.progress !== undefined) { fields.push('progress = ?'); values.push(updates.progress); }
    if (updates.recommendation !== undefined) { fields.push('recommendation = ?'); values.push(JSON.stringify(updates.recommendation)); }
    if (updates.error !== undefined) { fields.push('error = ?'); values.push(updates.error); }
    if (updates.completedAt !== undefined) { fields.push('completed_at = ?'); values.push(updates.completedAt); }
    if (updates.modelsTested !== undefined) { fields.push('models_tested = ?'); values.push(JSON.stringify(updates.modelsTested)); }

    if (fields.length === 0) return this.getSession(id) ?? undefined;

    values.push(id);
    this.db.prepare(`UPDATE tuning_sessions SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.getSession(id) ?? undefined;
  }

  getSession(id: string): TuningSession | undefined {
    const row = this.db.prepare('SELECT * FROM tuning_sessions WHERE id = ?').get(id) as SessionRow | undefined;
    return row ? rowToSession(row) : undefined;
  }

  getAllSessions(): TuningSession[] {
    const rows = this.db.prepare('SELECT * FROM tuning_sessions ORDER BY started_at DESC').all() as SessionRow[];
    return rows.map(rowToSession);
  }

  deleteSession(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tuning_sessions WHERE id = ?').run(id);
    return result.changes > 0;
  }

  addResult(params: Omit<TuningResult, 'id'>): TuningResult {
    const id = uuidv4();

    this.db.prepare(`
      INSERT INTO tuning_results (id, session_id, model_id, provider_id, task_index, task_prompt, response, score, judge_comment, tokens, cost_usd, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      params.sessionId,
      params.modelId,
      params.providerId,
      params.taskIndex,
      params.taskPrompt,
      params.response,
      params.score,
      params.judgeComment ?? null,
      params.tokens,
      params.costUsd,
      params.durationMs,
    );

    return { id, ...params };
  }

  updateResultScore(id: string, score: number, judgeComment?: string): void {
    this.db.prepare(
      'UPDATE tuning_results SET score = ?, judge_comment = ? WHERE id = ?'
    ).run(score, judgeComment ?? null, id);
  }

  getResultsBySession(sessionId: string): TuningResult[] {
    const rows = this.db.prepare('SELECT * FROM tuning_results WHERE session_id = ? ORDER BY task_index, model_id').all(sessionId) as ResultRow[];
    return rows.map(rowToResult);
  }
}
