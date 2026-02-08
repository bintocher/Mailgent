import { v4 as uuid } from 'uuid';
import type { Email, QueueItem, QueueStats } from '@mailgent/shared';
import { LIMITS } from '@mailgent/shared';
import type { EventBus } from '../utils/event-bus';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('mail-queue');

export class MailQueue {
  private queue: QueueItem[] = [];
  private processing = new Set<string>();
  private processor: ((item: QueueItem) => Promise<void>) | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private isPaused = false;

  constructor(private eventBus: EventBus) {}

  setProcessor(processor: (item: QueueItem) => Promise<void>): void {
    this.processor = processor;
  }

  enqueue(email: Email, priority: number = 0): QueueItem {
    const item: QueueItem = {
      id: uuid(),
      email,
      priority,
      enqueuedAt: Date.now(),
      retryCount: 0,
      maxRetries: LIMITS.QUEUE_MAX_RETRIES,
      status: 'pending',
    };

    this.queue.push(item);
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.enqueuedAt - b.enqueuedAt;
    });

    log.info({ id: item.id, emailId: email.id, priority }, 'Email enqueued');
    this.eventBus.emit('queue:update', this.getStats());
    return item;
  }

  dequeue(): QueueItem | null {
    const idx = this.queue.findIndex(
      item => item.status === 'pending' && !this.processing.has(item.id)
    );
    if (idx === -1) return null;

    const item = this.queue[idx];
    item.status = 'processing';
    this.processing.add(item.id);
    return item;
  }

  complete(itemId: string): void {
    const item = this.queue.find(i => i.id === itemId);
    if (item) {
      item.status = 'completed';
      this.processing.delete(itemId);
      this.queue = this.queue.filter(i => i.status !== 'completed');
      this.eventBus.emit('queue:update', this.getStats());
    }
  }

  fail(itemId: string, error: string): void {
    const item = this.queue.find(i => i.id === itemId);
    if (!item) return;

    item.retryCount++;
    item.lastError = error;
    this.processing.delete(itemId);

    if (item.retryCount >= item.maxRetries) {
      item.status = 'failed';
      log.warn({ id: itemId, retries: item.retryCount, error }, 'Queue item failed permanently');
    } else {
      item.status = 'pending';
      log.info({ id: itemId, retryCount: item.retryCount, error }, 'Queue item will retry');
    }

    this.eventBus.emit('queue:update', this.getStats());
  }

  reprioritize(emailId: string, newPriority: number): boolean {
    const item = this.queue.find(i => i.email.id === emailId && i.status === 'pending');
    if (!item) return false;

    item.priority = newPriority;
    this.queue.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.enqueuedAt - b.enqueuedAt;
    });

    log.info({ emailId, newPriority }, 'Email reprioritized');
    return true;
  }

  peek(count: number = 10): QueueItem[] {
    return this.queue.filter(i => i.status === 'pending').slice(0, count);
  }

  getStats(): QueueStats {
    const pending = this.queue.filter(i => i.status === 'pending');
    const processingItems = this.queue.filter(i => i.status === 'processing');
    const now = Date.now();

    return {
      totalItems: this.queue.length,
      pendingItems: pending.length,
      processingItems: processingItems.length,
      avgWaitTimeMs: pending.length > 0
        ? pending.reduce((sum, i) => sum + (now - i.enqueuedAt), 0) / pending.length
        : 0,
      oldestItemAge: pending.length > 0
        ? now - Math.min(...pending.map(i => i.enqueuedAt))
        : 0,
    };
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;

    this.intervalId = setInterval(async () => {
      if (!this.processor) return;
      if (this.isPaused) return;
      if (this.processing.size >= LIMITS.QUEUE_MAX_CONCURRENT) return;

      const item = this.dequeue();
      if (!item) return;

      try {
        await this.processor(item);
        this.complete(item.id);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.fail(item.id, error);
      }
    }, 100);

    log.info('Mail queue processor started');
  }

  pause(): void {
    this.isPaused = true;
    log.info('Mail queue paused');
    this.eventBus.emit('queue:update', this.getStats());
  }

  resume(): void {
    this.isPaused = false;
    log.info('Mail queue resumed');
    this.eventBus.emit('queue:update', this.getStats());
  }

  getIsPaused(): boolean {
    return this.isPaused;
  }

  clear(): void {
    this.queue = [];
    this.processing.clear();
    this.isPaused = false;
    log.info('Mail queue cleared');
    this.eventBus.emit('queue:update', this.getStats());
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.isPaused = false;
    log.info('Mail queue processor stopped');
  }
}
