import type { WebSocket } from 'ws';
import type { WSMessage, ClientEvents } from '@mailgent/shared';
import type { EventBus } from '../../utils/event-bus';
import { createChildLogger } from '../../utils/logger';

const log = createChildLogger('ws-handlers');

export function setupWSHandlers(
  ws: WebSocket,
  eventBus: EventBus,
  deps: Record<string, unknown>,
): void {
  ws.on('message', (raw) => {
    try {
      const message = JSON.parse(raw.toString()) as WSMessage;
      handleMessage(message, ws, eventBus, deps);
    } catch (err) {
      log.error({ error: err }, 'Failed to parse WebSocket message');
      ws.send(JSON.stringify({
        event: 'system:error',
        data: { message: 'Invalid message format' },
        timestamp: new Date().toISOString(),
      }));
    }
  });
}

function handleMessage(
  message: WSMessage,
  ws: WebSocket,
  eventBus: EventBus,
  deps: Record<string, unknown>,
): void {
  log.debug({ event: message.event }, 'WebSocket message received');

  switch (message.event) {
    case 'chat:send': {
      const data = message.data as ClientEvents['chat:send'];
      eventBus.emit('chat:send', { ...data, ws });
      break;
    }

    case 'chat:cancel': {
      const data = message.data as ClientEvents['chat:cancel'];
      eventBus.emit('chat:cancel', data);
      break;
    }

    case 'agent:stop': {
      const data = message.data as ClientEvents['agent:stop'];
      eventBus.emit('agent:stop_request', data.agentId);
      break;
    }

    case 'agent:resume': {
      const data = message.data as ClientEvents['agent:resume'];
      eventBus.emit('agent:resume_request', data.agentId);
      break;
    }

    case 'queue:reprioritize': {
      const data = message.data as ClientEvents['queue:reprioritize'];
      eventBus.emit('queue:reprioritize', data);
      break;
    }

    default:
      log.warn({ event: message.event }, 'Unknown WebSocket event');
  }
}
