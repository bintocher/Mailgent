import type {
  TuningSession,
  TuningStartParams,
  TuningRecommendation,
  TuningModelSummary,
  Agent,
  LLMModel,
} from '@mailgent/shared';
import type { LLMRouter } from '../llm/llm-router';
import type { LLMFactory } from '../llm/llm-factory';
import type { TokenTracker } from '../llm/token-tracker';
import type { TuningRepository } from '../db/repositories/tuning.repo';
import type { EventBus } from '../utils/event-bus';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('tuning-engine');

interface TuningEngineDeps {
  llmRouter: LLMRouter;
  llmFactory: LLMFactory;
  tokenTracker: TokenTracker;
  tuningRepo: TuningRepository;
  eventBus: EventBus;
  getModels: () => LLMModel[];
}

export class TuningEngine {
  private llmRouter: LLMRouter;
  private llmFactory: LLMFactory;
  private tokenTracker: TokenTracker;
  private tuningRepo: TuningRepository;
  private eventBus: EventBus;
  private getModels: () => LLMModel[];

  constructor(deps: TuningEngineDeps) {
    this.llmRouter = deps.llmRouter;
    this.llmFactory = deps.llmFactory;
    this.tokenTracker = deps.tokenTracker;
    this.tuningRepo = deps.tuningRepo;
    this.eventBus = deps.eventBus;
    this.getModels = deps.getModels;
  }

  getAvailableModels(): LLMModel[] {
    return this.getModels().filter(m => m.isEnabled);
  }

  async startSession(params: TuningStartParams, agent: Agent): Promise<TuningSession> {
    const models = this.resolveModels(params.modelIds);
    if (models.length === 0) {
      throw new Error('No models available for tuning');
    }

    // Resolve judge model
    const judgeModel = params.judgeModelId
      ? this.findModelByKey(params.judgeModelId)
      : this.getAutoJudgeModel();

    if (!judgeModel) {
      throw new Error('Judge model not found or no models available');
    }

    const session = this.tuningRepo.createSession({
      agentId: agent.id,
      agentName: agent.name,
      modelsTested: models.map(m => `${m.providerId}:${m.id}`),
      tasksCount: params.tasksCount,
    });

    // Defer to next tick so the HTTP response arrives before WS events
    setTimeout(() => {
      this.runSession(session.id, agent, models, params.tasksCount, judgeModel).catch(err => {
        log.error({ sessionId: session.id, error: err }, 'Tuning session failed');
      });
    }, 50);

    return session;
  }

  private resolveModels(modelIds?: string[]): LLMModel[] {
    const allModels = this.getModels();

    if (modelIds && modelIds.length > 0) {
      const set = new Set(modelIds);
      return allModels.filter(m => set.has(`${m.providerId}:${m.id}`));
    }

    return allModels.filter(m => m.isEnabled);
  }

  private findModelByKey(key: string): LLMModel | undefined {
    const allModels = this.getModels();
    return allModels.find(m => `${m.providerId}:${m.id}` === key);
  }

  private getAutoJudgeModel(): LLMModel | undefined {
    const allModels = this.getModels().filter(m => m.isEnabled);
    if (allModels.length === 0) return undefined;

    // Pick the most expensive model as judge (highest costPerInputToken)
    return allModels.reduce((best, m) =>
      m.costPerInputToken > best.costPerInputToken ? m : best,
      allModels[0],
    );
  }

  private async runSession(
    sessionId: string,
    agent: Agent,
    models: LLMModel[],
    tasksCount: number,
    judgeModel: LLMModel,
  ): Promise<void> {
    try {
      // 1. Update status to running and emit
      this.tuningRepo.updateSession(sessionId, { status: 'running' });
      this.eventBus.emit('tuning:progress', { sessionId, progress: 0, status: 'running', phase: 'generating' });

      log.info({
        sessionId,
        judgeModel: `${judgeModel.providerId}:${judgeModel.id}`,
        testModels: models.length,
        tasksCount,
      }, 'Starting tuning session');

      // 2. Generate test tasks via judge model
      log.info({ sessionId }, 'Generating test tasks via judge model');
      this.eventBus.emit('tuning:step', {
        sessionId, type: 'start', phase: 'generating',
        message: `Generating ${tasksCount} test tasks via ${judgeModel.displayName || judgeModel.id}...`,
      });
      const genStart = Date.now();
      const tasks = await this.generateTasks(judgeModel, agent, tasksCount);
      const genDuration = Date.now() - genStart;
      log.info({ sessionId, tasksGenerated: tasks.length, durationMs: genDuration }, 'Test tasks generated');
      this.eventBus.emit('tuning:step', {
        sessionId, type: 'done', phase: 'generating',
        message: `${tasks.length} tasks generated (${(genDuration / 1000).toFixed(1)}s)`,
        durationMs: genDuration,
      });

      const totalSteps = models.length * tasks.length;
      let completedSteps = 0;

      this.eventBus.emit('tuning:progress', { sessionId, progress: 0, phase: 'testing', completed: 0, total: totalSteps * 2 });

      // 3. Run each model on each task
      for (const model of models) {
        for (let taskIdx = 0; taskIdx < tasks.length; taskIdx++) {
          const taskPrompt = tasks[taskIdx];
          const modelLabel = model.displayName || model.id;

          this.eventBus.emit('tuning:step', {
            sessionId, type: 'start', phase: 'testing',
            message: `Testing ${modelLabel} — task ${taskIdx + 1}/${tasks.length}`,
            modelId: model.id, providerId: model.providerId, taskIndex: taskIdx,
          });
          log.info({ sessionId, model: model.id, taskIdx }, 'Testing model on task');

          try {
            const startTime = Date.now();
            const response = await this.llmRouter.route({
              providerId: model.providerId,
              modelId: model.id,
              messages: [
                { role: 'system', content: agent.systemPrompt },
                { role: 'user', content: taskPrompt },
              ],
            });
            const durationMs = Date.now() - startTime;

            const costUsd =
              response.usage.promptTokens * model.costPerInputToken +
              response.usage.completionTokens * model.costPerOutputToken;

            this.tuningRepo.addResult({
              sessionId,
              modelId: model.id,
              providerId: model.providerId,
              taskIndex: taskIdx,
              taskPrompt,
              response: response.content,
              score: 0,
              tokens: response.usage.totalTokens,
              costUsd,
              durationMs,
            });

            this.eventBus.emit('tuning:step', {
              sessionId, type: 'done', phase: 'testing',
              message: `${modelLabel} — task ${taskIdx + 1} done (${(durationMs / 1000).toFixed(1)}s, ${response.usage.totalTokens} tokens)`,
              modelId: model.id, providerId: model.providerId, taskIndex: taskIdx, durationMs,
            });
            log.info({ sessionId, model: model.id, taskIdx, durationMs, tokens: response.usage.totalTokens }, 'Model task completed');
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log.warn({ sessionId, model: model.id, taskIdx, error: err }, 'Model failed on task');
            this.tuningRepo.addResult({
              sessionId,
              modelId: model.id,
              providerId: model.providerId,
              taskIndex: taskIdx,
              taskPrompt,
              response: `Error: ${errMsg}`,
              score: 0,
              tokens: 0,
              costUsd: 0,
              durationMs: 0,
            });

            this.eventBus.emit('tuning:step', {
              sessionId, type: 'error', phase: 'testing',
              message: `${modelLabel} — task ${taskIdx + 1} FAILED: ${errMsg}`,
              modelId: model.id, providerId: model.providerId, taskIndex: taskIdx,
            });
          }

          completedSteps++;
          const progress = Math.round((completedSteps / (totalSteps * 2)) * 100);
          this.tuningRepo.updateSession(sessionId, { progress });
          this.eventBus.emit('tuning:progress', { sessionId, progress, phase: 'testing', completed: completedSteps, total: totalSteps * 2 });
        }
      }

      // 4. Judge all results
      const judgeLabel = judgeModel.displayName || judgeModel.id;
      this.eventBus.emit('tuning:step', {
        sessionId, type: 'start', phase: 'judging',
        message: `Starting evaluation phase with ${judgeLabel}...`,
      });
      this.eventBus.emit('tuning:progress', { sessionId, progress: Math.round((completedSteps / (totalSteps * 2)) * 100), phase: 'judging', completed: completedSteps, total: totalSteps * 2 });
      const results = this.tuningRepo.getResultsBySession(sessionId);
      let judgeIdx = 0;
      for (const result of results) {
        judgeIdx++;
        if (result.response.startsWith('Error:')) {
          completedSteps++;
          this.eventBus.emit('tuning:step', {
            sessionId, type: 'done', phase: 'judging',
            message: `Skipped error result ${judgeIdx}/${results.length}`,
          });
          continue;
        }

        const resultModelLabel = result.modelId;
        this.eventBus.emit('tuning:step', {
          sessionId, type: 'start', phase: 'judging',
          message: `Judging ${resultModelLabel} task ${result.taskIndex + 1} (${judgeIdx}/${results.length})`,
        });

        try {
          const judgeStart = Date.now();
          const evaluation = await this.judgeResponse(judgeModel, result.taskPrompt, result.response, agent.systemPrompt);
          const judgeDuration = Date.now() - judgeStart;
          this.tuningRepo.updateResultScore(result.id, evaluation.score, evaluation.comment);
          this.eventBus.emit('tuning:step', {
            sessionId, type: 'done', phase: 'judging',
            message: `${resultModelLabel} task ${result.taskIndex + 1} → score ${evaluation.score}/10 (${(judgeDuration / 1000).toFixed(1)}s)`,
            durationMs: judgeDuration,
          });
        } catch (err) {
          log.warn({ sessionId, resultId: result.id, error: err }, 'Judge evaluation failed');
          this.eventBus.emit('tuning:step', {
            sessionId, type: 'error', phase: 'judging',
            message: `Judge failed for ${resultModelLabel} task ${result.taskIndex + 1}`,
          });
        }

        completedSteps++;
        const progress = Math.round((completedSteps / (totalSteps * 2)) * 100);
        this.tuningRepo.updateSession(sessionId, { progress });
        this.eventBus.emit('tuning:progress', { sessionId, progress, phase: 'judging', completed: completedSteps, total: totalSteps * 2 });
      }

      // 5. Aggregate results into recommendation
      const finalResults = this.tuningRepo.getResultsBySession(sessionId);
      const recommendation = this.aggregateResults(finalResults, models);

      // 6. Complete session
      this.tuningRepo.updateSession(sessionId, {
        status: 'completed',
        progress: 100,
        recommendation,
        completedAt: new Date().toISOString(),
      });

      const completedSession = this.tuningRepo.getSession(sessionId);
      this.eventBus.emit('tuning:completed', { session: completedSession });
      log.info({ sessionId }, 'Tuning session completed');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.tuningRepo.updateSession(sessionId, {
        status: 'failed',
        error: errorMsg,
        completedAt: new Date().toISOString(),
      });
      this.eventBus.emit('tuning:error', { sessionId, error: errorMsg });
      log.error({ sessionId, error: err }, 'Tuning session failed');
    }
  }

  private async generateTasks(
    judgeModel: LLMModel,
    agent: Agent,
    count: number,
  ): Promise<string[]> {
    const prompt = `You are a test task generator. Generate exactly ${count} test tasks for an AI agent.

The agent has the following role:
${agent.systemPrompt}

Each task should be a realistic incoming email from a colleague that the agent would need to handle.
Tasks should test different aspects of the agent's capabilities.

Return ONLY a JSON array of strings, each string being one task/email content. No markdown, no explanation.
Example: ["Task 1 text...", "Task 2 text...", "Task 3 text..."]`;

    const response = await this.llmRouter.route({
      providerId: judgeModel.providerId,
      modelId: judgeModel.id,
      messages: [{ role: 'user', content: prompt }],
    });

    try {
      const parsed = JSON.parse(response.content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, count).map(String);
      }
    } catch {
      const match = response.content.match(/\[[\s\S]*\]/);
      if (match) {
        try {
          const arr = JSON.parse(match[0]);
          if (Array.isArray(arr)) return arr.slice(0, count).map(String);
        } catch { /* fall through */ }
      }
    }

    return Array.from({ length: count }, (_, i) =>
      `Test task ${i + 1}: Please demonstrate your capabilities by responding to a typical request in your role.`
    );
  }

  private async judgeResponse(
    judgeModel: LLMModel,
    taskPrompt: string,
    response: string,
    agentRole: string,
  ): Promise<{ score: number; comment: string }> {
    const prompt = `You are evaluating an AI agent's response quality.

Agent role: ${agentRole}

Task given to the agent:
${taskPrompt}

Agent's response:
${response}

Rate the response on a scale of 1-10 where:
1-3: Poor — irrelevant, incorrect, or unhelpful
4-6: Average — partially correct but missing key aspects
7-8: Good — correct and helpful with minor issues
9-10: Excellent — comprehensive, accurate, and well-structured

Return ONLY a JSON object with "score" (number 1-10) and "comment" (brief explanation).
Example: {"score": 7, "comment": "Good response but could be more detailed"}`;

    const judgeResponse = await this.llmRouter.route({
      providerId: judgeModel.providerId,
      modelId: judgeModel.id,
      messages: [{ role: 'user', content: prompt }],
    });

    try {
      const parsed = JSON.parse(judgeResponse.content);
      return {
        score: Math.min(10, Math.max(1, Number(parsed.score) || 5)),
        comment: String(parsed.comment || ''),
      };
    } catch {
      const match = judgeResponse.content.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const obj = JSON.parse(match[0]);
          return {
            score: Math.min(10, Math.max(1, Number(obj.score) || 5)),
            comment: String(obj.comment || ''),
          };
        } catch { /* fall through */ }
      }
      return { score: 5, comment: 'Could not parse judge evaluation' };
    }
  }

  private aggregateResults(
    results: Array<{ modelId: string; providerId: string; taskIndex: number; score: number; tokens: number; costUsd: number; durationMs: number; response: string }>,
    models: LLMModel[],
  ): TuningRecommendation {
    const modelMap = new Map(models.map(m => [`${m.providerId}:${m.id}`, m]));
    const grouped = new Map<string, typeof results>();

    for (const r of results) {
      const key = `${r.providerId}:${r.modelId}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(r);
    }

    const summaries: TuningModelSummary[] = [];

    for (const [key, modelResults] of grouped) {
      const model = modelMap.get(key);
      const successResults = modelResults.filter(r => !r.response.startsWith('Error:'));
      const avgScore = successResults.length > 0
        ? successResults.reduce((s, r) => s + r.score, 0) / successResults.length
        : 0;
      const avgTokens = successResults.length > 0
        ? successResults.reduce((s, r) => s + r.tokens, 0) / successResults.length
        : 0;
      const totalCostUsd = modelResults.reduce((s, r) => s + r.costUsd, 0);
      const avgDurationMs = successResults.length > 0
        ? successResults.reduce((s, r) => s + r.durationMs, 0) / successResults.length
        : 0;

      summaries.push({
        modelId: modelResults[0].modelId,
        providerId: modelResults[0].providerId,
        modelDisplayName: model?.displayName || key,
        avgScore,
        avgTokens,
        totalCostUsd,
        avgDurationMs,
        successRate: modelResults.length > 0 ? successResults.length / modelResults.length : 0,
        scores: modelResults.map(r => r.score),
      });
    }

    const byScore = [...summaries].sort((a, b) => b.avgScore - a.avgScore);
    const byValue = [...summaries].sort((a, b) => {
      const ratioA = a.totalCostUsd > 0 ? a.avgScore / a.totalCostUsd : a.avgScore * 1000;
      const ratioB = b.totalCostUsd > 0 ? b.avgScore / b.totalCostUsd : b.avgScore * 1000;
      return ratioB - ratioA;
    });
    const bySpeed = [...summaries].filter(s => s.avgScore > 0).sort((a, b) => a.avgDurationMs - b.avgDurationMs);

    const fallback = summaries[0] || {
      modelId: '', providerId: '', modelDisplayName: 'N/A',
      avgScore: 0, avgTokens: 0, totalCostUsd: 0, avgDurationMs: 0,
      successRate: 0, scores: [],
    };

    return {
      bestOverall: byScore[0] || fallback,
      bestValue: byValue[0] || fallback,
      bestSpeed: bySpeed[0] || fallback,
      allModels: summaries,
    };
  }
}
