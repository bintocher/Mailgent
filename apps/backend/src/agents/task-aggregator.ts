import type { Email } from '@mailgent/shared';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('task-aggregator');

export interface SubAgentResult {
  agentId: string;
  agentName: string;
  email?: Email;
  response: string;
  success: boolean;
  tokensUsed: number;
  durationMs: number;
}

export interface AggregatedResult {
  summary: string;
  bestResult?: string;
  allResults: SubAgentResult[];
  totalTokens: number;
  totalDurationMs: number;
}

export class TaskAggregator {
  private pendingTasks = new Map<string, {
    parentAgentId: string;
    expectedCount: number;
    results: SubAgentResult[];
    resolve: (result: AggregatedResult) => void;
  }>();

  startAggregation(
    taskId: string,
    parentAgentId: string,
    expectedCount: number,
  ): Promise<AggregatedResult> {
    return new Promise((resolve) => {
      this.pendingTasks.set(taskId, {
        parentAgentId,
        expectedCount,
        results: [],
        resolve,
      });
      log.info({ taskId, parentAgentId, expectedCount }, 'Aggregation started');
    });
  }

  addResult(taskId: string, result: SubAgentResult): void {
    const task = this.pendingTasks.get(taskId);
    if (!task) return;

    task.results.push(result);
    log.info({ taskId, agentId: result.agentId, resultCount: task.results.length }, 'Sub-agent result added');

    if (task.results.length >= task.expectedCount) {
      const aggregated = this.aggregate(task.results);
      task.resolve(aggregated);
      this.pendingTasks.delete(taskId);
    }
  }

  private aggregate(results: SubAgentResult[]): AggregatedResult {
    const successful = results.filter(r => r.success);
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
    const totalDurationMs = Math.max(...results.map(r => r.durationMs));

    let summary: string;
    if (successful.length === 0) {
      summary = 'All sub-agents failed.';
    } else if (successful.length === 1) {
      summary = successful[0].response;
    } else {
      summary = successful.map((r, i) =>
        `[${r.agentName}]: ${r.response}`
      ).join('\n\n---\n\n');
    }

    return {
      summary,
      bestResult: successful[0]?.response,
      allResults: results,
      totalTokens,
      totalDurationMs,
    };
  }
}
