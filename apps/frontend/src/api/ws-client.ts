import type { WSMessage, WSClientEventName, ClientEvents } from '@mailgent/shared';

type EventHandler = (data: unknown) => void;

/**
 * WebSocket client with auto-reconnect and event-based messaging.
 *
 * Incoming messages are expected to be JSON matching `WSMessage`:
 *   { event: string, data: unknown, timestamp: string }
 *
 * Outgoing messages are serialised with the same shape.
 */
export class WSClient {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Set<EventHandler>>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private baseDelay = 1000; // ms
  private maxDelay = 30000; // ms
  private url: string = '';
  private intentionalClose = false;

  // -------------------------------------------------------------------
  // Connection lifecycle
  // -------------------------------------------------------------------

  connect(url?: string): void {
    if (url) {
      this.url = url;
    }
    if (!this.url) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      this.url = `${protocol}//${window.location.host}/ws`;
    }

    this.intentionalClose = false;
    this.createSocket();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    if (this.ws) {
      // Remove handlers before closing to prevent stale onclose from firing
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
  }

  // -------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------

  send<E extends WSClientEventName>(event: E, data: ClientEvents[E]): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WSClient] Cannot send – socket not open');
      return;
    }

    const message: WSMessage = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    this.ws.send(JSON.stringify(message));
  }

  // -------------------------------------------------------------------
  // Event subscription
  // -------------------------------------------------------------------

  on(event: string, handler: EventHandler): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
  }

  off(event: string, handler: EventHandler): void {
    this.listeners.get(event)?.delete(handler);
  }

  // -------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------

  private createSocket(): void {
    if (this.ws) {
      // Remove handlers before closing to prevent stale callbacks
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }

    const ws = new WebSocket(this.url);

    ws.onopen = () => {
      if (this.ws !== ws) return; // stale socket
      this.reconnectAttempts = 0;
      this.emit('_connected', undefined);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (this.ws !== ws) return; // stale socket
      try {
        const msg = JSON.parse(event.data as string) as WSMessage;
        if (msg.event) {
          this.emit(msg.event, msg.data);
        }
      } catch {
        console.warn('[WSClient] Failed to parse message:', event.data);
      }
    };

    ws.onclose = () => {
      if (this.ws !== ws) return; // stale socket — ignore
      this.ws = null;
      this.emit('_disconnected', undefined);
      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    ws.onerror = (err) => {
      if (this.ws !== ws) return; // stale socket
      console.error('[WSClient] Error:', err);
    };

    this.ws = ws;
  }

  private emit(event: string, data: unknown): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          console.error(`[WSClient] Handler error for "${event}":`, err);
        }
      });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[WSClient] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(
      this.baseDelay * Math.pow(2, this.reconnectAttempts),
      this.maxDelay,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.createSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

/** Singleton instance used throughout the application. */
export const wsClient = new WSClient();
