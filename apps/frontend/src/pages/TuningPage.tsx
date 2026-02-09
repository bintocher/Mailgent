import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SlidersHorizontal,
  Play,
  Trash2,
  ArrowUpDown,
  Trophy,
  DollarSign,
  Zap,
  CheckCircle,
  Loader2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '@/store';
import * as http from '@/api/http-client';
import type { TuningSession, TuningModelSummary } from '@mailgent/shared';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<TuningSession['status'], string> = {
  pending: 'badge-gray',
  running: 'badge-yellow',
  completed: 'badge-green',
  failed: 'badge-red',
};

type SortKey = 'modelDisplayName' | 'avgScore' | 'totalCostUsd' | 'avgDurationMs' | 'successRate';
type SortDir = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TuningPage() {
  const agents = useStore((s) => s.agents);
  const fetchAgents = useStore((s) => s.fetchAgents);
  const tuningSessions = useStore((s) => s.tuningSessions);
  const tuningLoading = useStore((s) => s.tuningLoading);
  const selectedTuningSessionId = useStore((s) => s.selectedTuningSessionId);
  const fetchTuningSessions = useStore((s) => s.fetchTuningSessions);
  const startTuning = useStore((s) => s.startTuning);
  const applyRecommendation = useStore((s) => s.applyRecommendation);
  const tuningSteps = useStore((s) => s.tuningSteps);
  const clearTuningSteps = useStore((s) => s.clearTuningSteps);
  const deleteTuningSession = useStore((s) => s.deleteTuningSession);
  const setSelectedTuningSessionId = useStore((s) => s.setSelectedTuningSessionId);

  // Inline form state: which agent is being configured
  const [tuningAgentId, setTuningAgentId] = useState<string | null>(null);
  const [tasksCount, setTasksCount] = useState(5);
  const [judgeModelId, setJudgeModelId] = useState<string>('');
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [modelSearch, setModelSearch] = useState('');

  // Available models for judge selection
  const [availableModels, setAvailableModels] = useState<http.TuningModelOption[]>([]);

  // Sort state for model comparison table
  const [sortKey, setSortKey] = useState<SortKey>('avgScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    fetchAgents();
    fetchTuningSessions();
    http.fetchTuningModels().then(setAvailableModels).catch(() => {});
  }, [fetchAgents, fetchTuningSessions]);

  // Poll sessions while any are pending/running
  const hasActiveSessions = tuningSessions.some(
    (s) => s.status === 'pending' || s.status === 'running',
  );
  useEffect(() => {
    if (!hasActiveSessions) return;
    const timer = setInterval(() => {
      fetchTuningSessions();
    }, 3000);
    return () => clearInterval(timer);
  }, [hasActiveSessions, fetchTuningSessions]);

  // Derived: selected session object
  const selectedSession = useMemo(
    () => tuningSessions.find((s) => s.id === selectedTuningSessionId) ?? null,
    [tuningSessions, selectedTuningSessionId],
  );

  // Sorted model list when a completed session is selected
  const sortedModels = useMemo(() => {
    if (!selectedSession?.recommendation) return [];
    const models = [...selectedSession.recommendation.allModels];
    models.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      const aNum = aVal as number;
      const bNum = bVal as number;
      return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
    });
    return models;
  }, [selectedSession, sortKey, sortDir]);

  // Steps for currently selected session
  const sessionSteps = useMemo(
    () => (selectedTuningSessionId ? tuningSteps.filter((s) => s.sessionId === selectedTuningSessionId) : []),
    [tuningSteps, selectedTuningSessionId],
  );

  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessionSteps.length]);

  // Filtered model list for search
  const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(s);
  const getModelLabel = (m: http.TuningModelOption) => {
    // Prefer displayName if it's not a UUID, otherwise fall back to modelId
    if (m.displayName && !isUuid(m.displayName)) return m.displayName;
    return m.modelId;
  };
  const filteredModels = useMemo(() => {
    if (!modelSearch.trim()) return availableModels;
    const q = modelSearch.toLowerCase();
    return availableModels.filter(
      (m) =>
        m.modelId.toLowerCase().includes(q) ||
        m.displayName.toLowerCase().includes(q) ||
        m.providerId.toLowerCase().includes(q),
    );
  }, [availableModels, modelSearch]);

  // ---------------------------------------------------------------------------
  // Live elapsed timer — ticks every second while session is active
  // ---------------------------------------------------------------------------
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!hasActiveSessions) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [hasActiveSessions]);

  const formatElapsed = useCallback((startedAt: string) => {
    const diffSec = Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 1000));
    const h = Math.floor(diffSec / 3600);
    const m = Math.floor((diffSec % 3600) / 60);
    const s = diffSec % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }, [now]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleToggleTuningForm = (agentId: string) => {
    if (tuningAgentId === agentId) {
      setTuningAgentId(null);
    } else {
      setTuningAgentId(agentId);
      setTasksCount(5);
      setJudgeModelId('');
      setSelectedModelIds(new Set());
      setModelSearch('');
    }
  };

  const toggleModelSelection = (modelId: string) => {
    setSelectedModelIds((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  const handleStartTuning = async (agentId: string) => {
    if (selectedModelIds.size === 0) {
      alert('Select at least one model to test');
      return;
    }
    setStarting(true);
    clearTuningSteps();
    try {
      const session = await startTuning({
        agentId,
        tasksCount,
        modelIds: [...selectedModelIds],
        judgeModelId: judgeModelId || undefined,
      });
      setTuningAgentId(null);
      setSelectedTuningSessionId(session.id);
    } catch (err) {
      console.error('Failed to start tuning:', err);
    } finally {
      setStarting(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'modelDisplayName' ? 'asc' : 'desc');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    await deleteTuningSession(sessionId);
  };

  const [applyStatus, setApplyStatus] = useState<string | null>(null);

  const handleApply = async (category: 'bestOverall' | 'bestValue' | 'bestSpeed') => {
    if (!selectedSession?.recommendation) return;
    const pick = category === 'bestValue'
      ? selectedSession.recommendation.bestValue
      : category === 'bestSpeed'
        ? selectedSession.recommendation.bestSpeed
        : selectedSession.recommendation.bestOverall;
    try {
      await applyRecommendation(selectedSession.id, category);
      setApplyStatus(`Applied ${pick.modelDisplayName} to ${selectedSession.agentName}`);
      setTimeout(() => setApplyStatus(null), 4000);
    } catch (err) {
      console.error('Failed to apply recommendation:', err);
      setApplyStatus('Failed to apply');
      setTimeout(() => setApplyStatus(null), 4000);
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getBadgeForModel = (
    model: TuningModelSummary,
    rec: NonNullable<TuningSession['recommendation']>,
  ): string[] => {
    const badges: string[] = [];
    if (model.modelId === rec.bestOverall.modelId && model.providerId === rec.bestOverall.providerId)
      badges.push('Best Overall');
    if (model.modelId === rec.bestValue.modelId && model.providerId === rec.bestValue.providerId)
      badges.push('Best Value');
    if (model.modelId === rec.bestSpeed.modelId && model.providerId === rec.bestSpeed.providerId)
      badges.push('Best Speed');
    return badges;
  };

  const badgeColorMap: Record<string, string> = {
    'Best Overall': 'badge-green',
    'Best Value': 'badge-blue',
    'Best Speed': 'badge-yellow',
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-6 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-6 flex-shrink-0">
        <SlidersHorizontal className="w-6 h-6" />
        Agent Tuning
      </h1>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* ----------------------------------------------------------------- */}
        {/* Left Panel */}
        {/* ----------------------------------------------------------------- */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
          {/* Agents list */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Agents
            </h2>
            {agents.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">No agents found.</p>
            )}
            <div className="space-y-2">
              {agents.map((agent) => (
                <div key={agent.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-white truncate block">
                        {agent.name}
                      </span>
                      {agent.modelId && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate block">
                          {agent.modelId}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleTuningForm(agent.id)}
                      className="text-xs text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      Run Tuning
                    </button>
                  </div>

                  {/* Inline tuning form */}
                  {tuningAgentId === agent.id && (
                    <div className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Tasks Count: {tasksCount}
                        </label>
                        <input
                          type="range"
                          min={3}
                          max={10}
                          value={tasksCount}
                          onChange={(e) => setTasksCount(Number(e.target.value))}
                          className="w-full accent-primary-600"
                        />
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>3</span>
                          <span>10</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                            Models to Test ({selectedModelIds.size})
                          </label>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedModelIds(new Set(availableModels.map((m) => m.id)))}
                              className="text-[10px] text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedModelIds(new Set())}
                              className="text-[10px] text-gray-400 hover:underline"
                            >
                              None
                            </button>
                          </div>
                        </div>
                        <input
                          type="text"
                          value={modelSearch}
                          onChange={(e) => setModelSearch(e.target.value)}
                          placeholder="Search models..."
                          className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 mb-1"
                        />
                        <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-md p-1.5 space-y-0.5">
                          {filteredModels.map((m) => (
                            <label
                              key={m.id}
                              className="flex items-center gap-1.5 px-1 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedModelIds.has(m.id)}
                                onChange={() => toggleModelSelection(m.id)}
                                className="accent-primary-600 w-3 h-3 flex-shrink-0"
                              />
                              <span className="text-xs text-gray-800 dark:text-gray-200 truncate" title={m.modelId}>
                                {getModelLabel(m)}
                              </span>
                            </label>
                          ))}
                          {filteredModels.length === 0 && (
                            <p className="text-xs text-gray-400 py-1">
                              {availableModels.length === 0 ? 'No models available' : 'No matches'}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          Judge Model
                        </label>
                        <select
                          value={judgeModelId}
                          onChange={(e) => setJudgeModelId(e.target.value)}
                          className="w-full text-xs rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1.5"
                        >
                          <option value="">Auto (most expensive)</option>
                          {availableModels.map((m) => (
                            <option key={m.id} value={m.id}>
                              {getModelLabel(m)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button
                        onClick={() => handleStartTuning(agent.id)}
                        disabled={starting}
                        className="btn-primary text-sm w-full flex items-center justify-center gap-1.5"
                      >
                        {starting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                        Start
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sessions list */}
          <div className="card flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              Tuning Sessions
            </h2>
            {tuningLoading && tuningSessions.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading...
              </div>
            )}
            {!tuningLoading && tuningSessions.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                No tuning sessions yet. Select an agent and run tuning to get started.
              </p>
            )}
            <div className="space-y-1.5 overflow-y-auto flex-1">
              {tuningSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => setSelectedTuningSessionId(session.id)}
                  className={`flex items-center justify-between gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedTuningSessionId === session.id
                      ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {session.agentName}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {new Date(session.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className={STATUS_BADGE[session.status]}>{session.status}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSession(session.id);
                      }}
                      className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Delete session"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Right Panel */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {!selectedSession && (
            <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
              <p>Select a tuning session to view details.</p>
            </div>
          )}

          {/* Running state */}
          {selectedSession?.status === 'running' && (
            <div className="card space-y-4">
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-primary-600 dark:text-primary-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Tuning in Progress
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Agent: {selectedSession.agentName} -- Testing {selectedSession.modelsTested.length} model(s)
                with {selectedSession.tasksCount} task(s)
              </p>

              {/* Time info */}
              <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                <span>Started: {new Date(selectedSession.startedAt).toLocaleTimeString()}</span>
                <span className="font-mono text-primary-600 dark:text-primary-400 font-medium">
                  Elapsed: {formatElapsed(selectedSession.startedAt)}
                </span>
              </div>

              {/* Phase indicator */}
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300">Phase:</span>
                <span className="text-primary-600 dark:text-primary-400 font-medium">
                  {selectedSession.phase === 'generating' && 'Generating test tasks...'}
                  {selectedSession.phase === 'testing' && 'Testing models on tasks...'}
                  {selectedSession.phase === 'judging' && 'Evaluating responses...'}
                  {!selectedSession.phase && 'Starting...'}
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-300">
                  <span>
                    {selectedSession.completedSteps !== undefined && selectedSession.totalSteps
                      ? `Step ${selectedSession.completedSteps} / ${selectedSession.totalSteps}`
                      : 'Progress'}
                  </span>
                  <span className="font-medium">{selectedSession.progress}%</span>
                </div>
                <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-600 dark:bg-primary-500 rounded-full transition-all duration-300"
                    style={{ width: `${selectedSession.progress}%` }}
                  />
                </div>
              </div>

              {/* Activity log */}
              {sessionSteps.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Activity Log
                  </p>
                  <div className="max-h-52 overflow-y-auto rounded-lg bg-gray-900 dark:bg-gray-950 p-3 font-mono text-xs leading-relaxed">
                    {sessionSteps.map((step) => (
                      <div key={step.id} className="flex gap-2">
                        <span className="text-gray-500 flex-shrink-0">
                          {new Date(step.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={
                            step.type === 'error'
                              ? 'text-red-400'
                              : step.type === 'done'
                                ? 'text-green-400'
                                : 'text-blue-400'
                          }
                        >
                          {step.type === 'start' ? '>' : step.type === 'done' ? '\u2713' : '\u2717'}
                        </span>
                        <span className="text-gray-200">{step.message}</span>
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Pending state */}
          {selectedSession?.status === 'pending' && (
            <div className="card flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Starting...
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Session is being initialized. Will start running momentarily.
                </p>
              </div>
            </div>
          )}

          {/* Failed state */}
          {selectedSession?.status === 'failed' && (
            <div className="card space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Tuning Failed
                </h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Agent: {selectedSession.agentName}
              </p>
              {selectedSession.error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700 dark:text-red-300">{selectedSession.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Completed state with recommendation */}
          {selectedSession?.status === 'completed' && selectedSession.recommendation && (
            <div className="space-y-4">
              {/* Summary header */}
              <div className="card">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Tuning Complete
                  </h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Agent: {selectedSession.agentName} --{' '}
                  {selectedSession.recommendation.allModels.length} model(s) tested with{' '}
                  {selectedSession.tasksCount} task(s)
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500 mt-1">
                  <span>Started: {new Date(selectedSession.startedAt).toLocaleTimeString()}</span>
                  {selectedSession.completedAt && (
                    <>
                      <span>Completed: {new Date(selectedSession.completedAt).toLocaleTimeString()}</span>
                      <span className="font-medium text-gray-600 dark:text-gray-300">
                        Duration: {(() => {
                          const sec = Math.round(
                            (new Date(selectedSession.completedAt).getTime() - new Date(selectedSession.startedAt).getTime()) / 1000,
                          );
                          const m = Math.floor(sec / 60);
                          const s = sec % 60;
                          return m > 0 ? `${m}m ${s}s` : `${s}s`;
                        })()}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Apply feedback */}
              {applyStatus && (
                <div className={`p-3 rounded-lg text-sm font-medium ${
                  applyStatus.startsWith('Failed')
                    ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                    : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                }`}>
                  {applyStatus.startsWith('Failed') ? '\u2717 ' : '\u2713 '}{applyStatus}
                </div>
              )}

              {/* Recommendation cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Best Overall */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Best Overall
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedSession.recommendation.bestOverall.modelDisplayName}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-3">
                    <p>Score: {selectedSession.recommendation.bestOverall.avgScore.toFixed(1)}</p>
                    <p>Cost: ${selectedSession.recommendation.bestOverall.totalCostUsd.toFixed(4)}</p>
                    <p>Success: {(selectedSession.recommendation.bestOverall.successRate * 100).toFixed(0)}%</p>
                  </div>
                  <button
                    onClick={() => handleApply('bestOverall')}
                    className="btn-primary text-xs w-full"
                  >
                    Apply
                  </button>
                </div>

                {/* Best Value */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Best Value
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedSession.recommendation.bestValue.modelDisplayName}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-3">
                    <p>Score: {selectedSession.recommendation.bestValue.avgScore.toFixed(1)}</p>
                    <p>Cost: ${selectedSession.recommendation.bestValue.totalCostUsd.toFixed(4)}</p>
                    <p>Success: {(selectedSession.recommendation.bestValue.successRate * 100).toFixed(0)}%</p>
                  </div>
                  <button
                    onClick={() => handleApply('bestValue')}
                    className="btn-primary text-xs w-full"
                  >
                    Apply
                  </button>
                </div>

                {/* Best Speed */}
                <div className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-lg bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Best Speed
                      </p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedSession.recommendation.bestSpeed.modelDisplayName}
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1 mb-3">
                    <p>Score: {selectedSession.recommendation.bestSpeed.avgScore.toFixed(1)}</p>
                    <p>Cost: ${selectedSession.recommendation.bestSpeed.totalCostUsd.toFixed(4)}</p>
                    <p>Duration: {formatDuration(selectedSession.recommendation.bestSpeed.avgDurationMs)}</p>
                  </div>
                  <button
                    onClick={() => handleApply('bestSpeed')}
                    className="btn-primary text-xs w-full"
                  >
                    Apply
                  </button>
                </div>
              </div>

              {/* Model comparison table */}
              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Model Comparison
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-800">
                        <SortableHeader
                          label="Model"
                          sortKey="modelDisplayName"
                          currentKey={sortKey}
                          direction={sortDir}
                          onSort={handleSort}
                        />
                        <SortableHeader
                          label="Avg Score"
                          sortKey="avgScore"
                          currentKey={sortKey}
                          direction={sortDir}
                          onSort={handleSort}
                          align="right"
                        />
                        <SortableHeader
                          label="Total Cost"
                          sortKey="totalCostUsd"
                          currentKey={sortKey}
                          direction={sortDir}
                          onSort={handleSort}
                          align="right"
                        />
                        <SortableHeader
                          label="Avg Duration"
                          sortKey="avgDurationMs"
                          currentKey={sortKey}
                          direction={sortDir}
                          onSort={handleSort}
                          align="right"
                        />
                        <SortableHeader
                          label="Success Rate"
                          sortKey="successRate"
                          currentKey={sortKey}
                          direction={sortDir}
                          onSort={handleSort}
                          align="right"
                        />
                        <th className="text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3">
                          Badges
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {sortedModels.map((model) => {
                        const badges = getBadgeForModel(model, selectedSession.recommendation!);
                        return (
                          <tr
                            key={`${model.providerId}-${model.modelId}`}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                              {model.modelDisplayName}
                              <span className="block text-xs text-gray-400 dark:text-gray-500">
                                {model.providerId}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right font-medium">
                              <span
                                className={
                                  model.avgScore >= 8
                                    ? 'text-green-600 dark:text-green-400'
                                    : model.avgScore >= 5
                                      ? 'text-yellow-600 dark:text-yellow-400'
                                      : 'text-red-600 dark:text-red-400'
                                }
                              >
                                {model.avgScore.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                              ${model.totalCostUsd.toFixed(4)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                              {formatDuration(model.avgDurationMs)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span
                                className={
                                  model.successRate >= 0.95
                                    ? 'text-green-600 dark:text-green-400'
                                    : model.successRate >= 0.8
                                      ? 'text-yellow-600 dark:text-yellow-400'
                                      : 'text-red-600 dark:text-red-400'
                                }
                              >
                                {(model.successRate * 100).toFixed(1)}%
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {badges.map((badge) => (
                                  <span key={badge} className={badgeColorMap[badge] ?? 'badge-gray'}>
                                    {badge}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {sortedModels.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                          >
                            No model data available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Completed but no recommendation (edge case) */}
          {selectedSession?.status === 'completed' && !selectedSession.recommendation && (
            <div className="card flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Tuning Complete
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No recommendation data available for this session.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sortable table header sub-component
// ---------------------------------------------------------------------------

function SortableHeader({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
  align = 'left',
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: SortDir;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const isActive = currentKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={`text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-4 py-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 transition-colors ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={`w-3 h-3 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'opacity-40'}`}
        />
        {isActive && (
          <span className="text-primary-600 dark:text-primary-400 text-[10px]">
            {direction === 'asc' ? 'asc' : 'desc'}
          </span>
        )}
      </span>
    </th>
  );
}
