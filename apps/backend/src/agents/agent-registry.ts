import type { Agent, AgentStatus } from '@mailgent/shared';
import type { EventBus } from '../utils/event-bus';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('agent-registry');

export interface ActiveAgent {
  agent: Agent;
  abortController: AbortController;
  currentTaskId?: string;
}

export class AgentRegistry {
  private agents = new Map<string, ActiveAgent>();

  constructor(private eventBus: EventBus) {}

  register(agent: Agent): ActiveAgent {
    const active: ActiveAgent = {
      agent,
      abortController: new AbortController(),
    };
    this.agents.set(agent.id, active);
    log.info({ id: agent.id, name: agent.name }, 'Agent registered');
    this.eventBus.emit('agent:created', { agent });
    return active;
  }

  unregister(agentId: string): void {
    const active = this.agents.get(agentId);
    if (active) {
      active.abortController.abort();
      this.agents.delete(agentId);
      log.info({ id: agentId }, 'Agent unregistered');
      this.eventBus.emit('agent:destroyed', { agentId });
    }
  }

  get(agentId: string): ActiveAgent | undefined {
    return this.agents.get(agentId);
  }

  getByEmail(email: string): ActiveAgent | undefined {
    return Array.from(this.agents.values()).find(a => a.agent.email === email);
  }

  getAll(): ActiveAgent[] {
    return Array.from(this.agents.values());
  }

  updateStatus(agentId: string, status: AgentStatus, detail?: string): void {
    const active = this.agents.get(agentId);
    if (active) {
      active.agent.status = status;
      this.eventBus.emit('agent:status', { agentId, status, detail });
    }
  }

  getActiveCount(): number {
    return Array.from(this.agents.values())
      .filter(a => a.agent.status !== 'idle' && a.agent.status !== 'stopped')
      .length;
  }

  stopAll(): void {
    for (const [id, active] of this.agents) {
      active.abortController.abort();
      active.agent.status = 'stopped';
    }
    log.info({ count: this.agents.size }, 'All agents stopped');
    this.agents.clear();
  }
}
