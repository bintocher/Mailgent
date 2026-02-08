/**
 * WebSocket client with auto-reconnect and event-based messaging.
 *
 * Incoming messages are expected to be JSON matching `WSMessage`:
 *   { event: string, data: unknown, timestamp: string }
 *
 * Outgoing messages are serialised with the same shape.
 */
export class WSClient {
    ws = null;
    listeners = new Map();
    reconnectTimer = null;
    reconnectAttempts = 0;
    maxReconnectAttempts = 20;
    baseDelay = 1000; // ms
    maxDelay = 30000; // ms
    url = '';
    intentionalClose = false;
    // -------------------------------------------------------------------
    // Connection lifecycle
    // -------------------------------------------------------------------
    connect(url) {
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
    disconnect() {
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
    send(event, data) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.warn('[WSClient] Cannot send – socket not open');
            return;
        }
        const message = {
            event,
            data,
            timestamp: new Date().toISOString(),
        };
        this.ws.send(JSON.stringify(message));
    }
    // -------------------------------------------------------------------
    // Event subscription
    // -------------------------------------------------------------------
    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(handler);
    }
    off(event, handler) {
        this.listeners.get(event)?.delete(handler);
    }
    // -------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------
    createSocket() {
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
            if (this.ws !== ws)
                return; // stale socket
            this.reconnectAttempts = 0;
            this.emit('_connected', undefined);
        };
        ws.onmessage = (event) => {
            if (this.ws !== ws)
                return; // stale socket
            try {
                const msg = JSON.parse(event.data);
                if (msg.event) {
                    this.emit(msg.event, msg.data);
                }
            }
            catch {
                console.warn('[WSClient] Failed to parse message:', event.data);
            }
        };
        ws.onclose = () => {
            if (this.ws !== ws)
                return; // stale socket — ignore
            this.ws = null;
            this.emit('_disconnected', undefined);
            if (!this.intentionalClose) {
                this.scheduleReconnect();
            }
        };
        ws.onerror = (err) => {
            if (this.ws !== ws)
                return; // stale socket
            console.error('[WSClient] Error:', err);
        };
        this.ws = ws;
    }
    emit(event, data) {
        const handlers = this.listeners.get(event);
        if (handlers) {
            handlers.forEach((handler) => {
                try {
                    handler(data);
                }
                catch (err) {
                    console.error(`[WSClient] Handler error for "${event}":`, err);
                }
            });
        }
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.warn('[WSClient] Max reconnect attempts reached');
            return;
        }
        const delay = Math.min(this.baseDelay * Math.pow(2, this.reconnectAttempts), this.maxDelay);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectAttempts++;
            this.createSocket();
        }, delay);
    }
    clearReconnectTimer() {
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
}
/** Singleton instance used throughout the application. */
export const wsClient = new WSClient();
