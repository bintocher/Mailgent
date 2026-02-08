import { EventEmitter } from 'events';
import { createChildLogger } from './logger';

const log = createChildLogger('event-bus');

export class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  override emit(event: string | symbol, ...args: unknown[]): boolean {
    log.debug({ event, argsCount: args.length }, 'Event emitted');
    return super.emit(event, ...args);
  }

  emitAsync(event: string, ...args: unknown[]): void {
    setImmediate(() => this.emit(event, ...args));
  }
}

export const eventBus = EventBus.getInstance();
