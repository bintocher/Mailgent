import { useState } from 'react';
import {
  Mail,
  Bot,
  Wrench,
  Hash,
  DollarSign,
  ListTodo,
  Copy,
  Check,
  FolderOpen,
} from 'lucide-react';
import { useStore } from '@/store';
import * as http from '@/api/http-client';

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

function formatCost(n: number): string {
  if (n === 0) return '0';
  if (n < 0.01) return n.toFixed(4);
  return n.toFixed(2);
}

function truncateWorkDir(dir: string, maxLen = 25): string {
  if (dir.length <= maxLen) return dir;
  return '\u2026' + dir.slice(-(maxLen - 1));
}

export default function TopBar() {
  const [copied, setCopied] = useState(false);

  const emails = useStore((s) => s.emails);
  const agents = useStore((s) => s.agents);
  const agentMetrics = useStore((s) => s.agentMetrics);
  const queueStats = useStore((s) => s.queueStats);
  const systemStatus = useStore((s) => s.systemStatus);

  const activeAgents = agents.filter(
    (a) => a.status === 'thinking' || a.status === 'acting',
  ).length;

  const totalToolCalls = agentMetrics.reduce(
    (sum, m) => sum + m.totalToolCalls,
    0,
  );

  const totalTokens = agentMetrics.reduce(
    (sum, m) => sum + m.totalTokensUsed,
    0,
  );

  const totalCost = agentMetrics.reduce(
    (sum, m) => sum + m.totalCostUsd,
    0,
  );

  const pending = queueStats?.pendingItems ?? 0;
  const processing = queueStats?.processingItems ?? 0;
  const showQueue = pending > 0 || processing > 0;

  const workDir = systemStatus?.workDir ?? '';

  const handleCopy = async () => {
    if (!workDir) return;
    await navigator.clipboard.writeText(workDir);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenFolder = () => {
    http.openFolder().catch((err) => console.error('Failed to open folder:', err));
  };

  return (
    <div className="shrink-0 flex items-center justify-between h-10 px-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs">
      {/* Left: activity indicators */}
      <div className="flex items-center gap-4">
        <Indicator icon={Mail} value={emails.length} color="text-green-600 dark:text-green-400" title="Emails" />
        <Indicator icon={Bot} value={activeAgents} color="text-blue-600 dark:text-blue-400" title="Active agents" />
        <Indicator icon={Wrench} value={totalToolCalls} color="text-orange-600 dark:text-orange-400" title="Tool calls" />
        <Indicator icon={Hash} value={formatNumber(totalTokens)} color="text-purple-600 dark:text-purple-400" title="Tokens" />
        <Indicator icon={DollarSign} value={formatCost(totalCost)} color="text-emerald-600 dark:text-emerald-400" title="Cost (USD)" />
        {showQueue && (
          <Indicator icon={ListTodo} value={`${pending}/${processing}`} color="text-yellow-600 dark:text-yellow-400" title="Queue: pending/processing" />
        )}
      </div>

      {/* Right: workDir + actions */}
      {workDir && (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
          <span className="font-mono tabular-nums" title={workDir}>
            {truncateWorkDir(workDir)}
          </span>
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Copy path"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-green-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            onClick={handleOpenFolder}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title="Open in file manager"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function Indicator({
  icon: Icon,
  value,
  color,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  color: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-1" title={title}>
      <Icon className={`w-3.5 h-3.5 ${color}`} />
      <span className={`tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
