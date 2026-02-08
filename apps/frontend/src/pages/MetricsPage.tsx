import { useEffect } from 'react';
import { BarChart3, DollarSign, Hash, Activity } from 'lucide-react';
import { useStore } from '@/store';
import type { TokenUsageTimeSeries } from '@mailgent/shared';

export default function MetricsPage() {
  const llmPerformance = useStore((s) => s.llmPerformance);
  const agentMetrics = useStore((s) => s.agentMetrics);
  const tokenUsage = useStore((s) => s.tokenUsage);
  const fetchLLMPerformance = useStore((s) => s.fetchLLMPerformance);
  const fetchAgentMetrics = useStore((s) => s.fetchAgentMetrics);
  const fetchTokenMetrics = useStore((s) => s.fetchTokenMetrics);

  useEffect(() => {
    fetchLLMPerformance();
    fetchAgentMetrics();
    fetchTokenMetrics();
  }, [fetchLLMPerformance, fetchAgentMetrics, fetchTokenMetrics]);

  const tokenTimeSeries: TokenUsageTimeSeries[] = tokenUsage?.timeSeries ?? [];
  const totalCost = agentMetrics.reduce((sum, m) => sum + m.totalCostUsd, 0);
  const totalTokens = agentMetrics.reduce((sum, m) => sum + m.totalTokensUsed, 0);
  const totalApiCalls = llmPerformance.reduce((sum, m) => sum + m.totalCalls, 0);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <BarChart3 className="w-6 h-6" />
        Metrics
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Cost</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              ${totalCost.toFixed(4)}
            </p>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400">
            <Hash className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Tokens</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalTokens.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="card flex items-center gap-4">
          <div className="p-3 rounded-lg text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total API Calls</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalApiCalls.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Token usage chart placeholder */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Token Usage Over Time
        </h2>
        {tokenTimeSeries.length > 0 ? (
          <div className="h-64 flex items-end gap-1 px-4">
            {tokenTimeSeries.slice(-30).map((point: TokenUsageTimeSeries, i: number) => {
              const maxTokens = Math.max(...tokenTimeSeries.map((p: TokenUsageTimeSeries) => p.promptTokens + p.completionTokens), 1);
              const height = ((point.promptTokens + point.completionTokens) / maxTokens) * 100;
              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-0.5"
                  title={`${new Date(point.timestamp).toLocaleDateString()}: ${point.promptTokens + point.completionTokens} tokens, $${point.costUsd.toFixed(4)}`}
                >
                  <div
                    className="w-full bg-primary-500 rounded-t opacity-80 hover:opacity-100 transition-opacity min-h-[2px]"
                    style={{ height: `${height}%` }}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-400 dark:text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
            <p>No usage data yet. Charts will appear once agents begin processing tasks.</p>
          </div>
        )}
      </div>

      {/* LLM Performance table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">LLM Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Model
                </th>
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Task Type
                </th>
                <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Avg Duration
                </th>
                <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Success Rate
                </th>
                <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Total Calls
                </th>
                <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {llmPerformance.map((stat, i) => (
                <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {stat.modelId}
                  </td>
                  <td className="px-4 py-3">
                    <span className="badge-gray">{stat.taskType}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                    {(stat.avgDurationMs / 1000).toFixed(2)}s
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span
                      className={
                        stat.successRate >= 0.95
                          ? 'text-green-600 dark:text-green-400'
                          : stat.successRate >= 0.8
                            ? 'text-yellow-600 dark:text-yellow-400'
                            : 'text-red-600 dark:text-red-400'
                      }
                    >
                      {(stat.successRate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                    {stat.totalCalls.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                    ${stat.totalCostUsd.toFixed(4)}
                  </td>
                </tr>
              ))}
              {llmPerformance.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No LLM performance data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Agent Metrics table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Agent Metrics</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800">
                <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Agent
                </th>
                <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Tokens Used
                </th>
                <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Cost
                </th>
                <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Completed
                </th>
                <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Failed
                </th>
                <th className="text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                  Avg Response
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {agentMetrics.map((metric) => (
                <tr key={metric.agentId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                    {metric.agentName}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                    {metric.totalTokensUsed.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                    ${metric.totalCostUsd.toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className="text-green-600 dark:text-green-400">
                      {metric.tasksCompleted}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span
                      className={
                        metric.tasksFailed > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-400'
                      }
                    >
                      {metric.tasksFailed}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                    {(metric.avgResponseTimeMs / 1000).toFixed(2)}s
                  </td>
                </tr>
              ))}
              {agentMetrics.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No agent metrics yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
