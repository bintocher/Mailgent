import type { Email } from './email';

export type TaskPriority = number; // 0 = normal, higher = more urgent, 100 = master

export interface QueueItem {
  id: string;
  email: Email;
  priority: TaskPriority;
  enqueuedAt: number;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  assignedAgentId?: string;
}

export interface QueueConfig {
  maxRetries: number;
  retryDelayMs: number;
  maxConcurrent: number;
  processingTimeoutMs: number;
}
