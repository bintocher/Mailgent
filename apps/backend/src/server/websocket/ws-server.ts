import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WSMessage } from '@mailgent/shared';
import { LIMITS } from '@mailgent/shared';
import type { EventBus } from '../../utils/event-bus';
import { createChildLogger } from '../../utils/logger';
import { setupWSHandlers } from './handlers';

const log = createChildLogger('ws-server');

export class WSServer {
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    server: Server,
    private eventBus: EventBus,
    private deps: Record<string, unknown>,
  ) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.setupConnections();
    this.forwardEvents();
    this.startHeartbeat();
  }

  private setupConnections(): void {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      log.info({ clients: this.clients.size }, 'WebSocket client connected');

      setupWSHandlers(ws, this.eventBus, this.deps);

      ws.on('close', () => {
        this.clients.delete(ws);
        log.info({ clients: this.clients.size }, 'WebSocket client disconnected');
      });

      ws.on('error', (err) => {
        log.error({ error: err }, 'WebSocket error');
        this.clients.delete(ws);
      });
    });
  }

  private forwardEvents(): void {
    const events = [
      'chat:chunk', 'chat:message', 'chat:agent_message', 'chat:done', 'chat:error',
      'chat:thinking', 'chat:tool_call', 'chat:tool_result',
      'email:new', 'email:status', 'agent:created', 'agent:status', 'agent:log',
      'agent:destroyed', 'tool:executed', 'metrics:update', 'queue:update',
      'system:error',
    ];

    for (const event of events) {
      this.eventBus.on(event, (data: unknown) => {
        this.broadcast(event, data);
      });
    }
  }

  broadcast(event: string, data: unknown): void {
    const message: WSMessage = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };

    const payload = JSON.stringify(message);

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          client.ping();
        }
      }
    }, LIMITS.WS_HEARTBEAT_INTERVAL_MS);
  }

  getConnectedCount(): number {
    return this.clients.size;
  }

  close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
    log.info('WebSocket server closed');
  }
}
