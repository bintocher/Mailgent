import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Agent, AgentCreateParams, AgentStatus } from '@mailgent/shared';

interface AgentRow {
  id: string;
  name: string;
  email: string;
  type: string;
  status: string;
  system_prompt: string;
  description: string;
  group_id: string | null;
  parent_agent_id: string | null;
  model_id: string | null;
  provider_id: string | null;
  tool_ids: string;
  skill_ids: string;
  max_concurrent_tasks: number;
  project_id: string;
  created_at: string;
  updated_at: string;
}

function rowToAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    type: row.type as Agent['type'],
    status: row.status as Agent['status'],
    systemPrompt: row.system_prompt,
    description: row.description,
    groupId: row.group_id ?? undefined,
    parentAgentId: row.parent_agent_id ?? undefined,
    modelId: row.model_id ?? undefined,
    providerId: row.provider_id ?? undefined,
    toolIds: JSON.parse(row.tool_ids),
    skillIds: JSON.parse(row.skill_ids),
    maxConcurrentTasks: row.max_concurrent_tasks,
    projectId: row.project_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AgentRepository {
  constructor(private db: Database.Database) {}

  swapDb(db: Database.Database): void { this.db = db; }

  findAll(): Agent[] {
    const rows = this.db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all() as AgentRow[];
    return rows.map(rowToAgent);
  }

  findById(id: string): Agent | undefined {
    const row = this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as AgentRow | undefined;
    return row ? rowToAgent(row) : undefined;
  }

  findByEmail(email: string): Agent | undefined {
    const row = this.db.prepare('SELECT * FROM agents WHERE email = ?').get(email) as AgentRow | undefined;
    return row ? rowToAgent(row) : undefined;
  }

  findByName(name: string): Agent | undefined {
    const row = this.db.prepare('SELECT * FROM agents WHERE name = ?').get(name) as AgentRow | undefined;
    return row ? rowToAgent(row) : undefined;
  }

  create(agent: AgentCreateParams & { projectId: string }): Agent {
    const now = new Date().toISOString();
    const id = uuidv4();

    this.db.prepare(`
      INSERT INTO agents (id, name, email, type, status, system_prompt, description,
        group_id, parent_agent_id, model_id, provider_id, tool_ids, skill_ids,
        max_concurrent_tasks, project_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'idle', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      agent.name,
      agent.email,
      agent.type,
      agent.systemPrompt,
      agent.description,
      agent.groupId ?? null,
      agent.parentAgentId ?? null,
      agent.modelId ?? null,
      agent.providerId ?? null,
      JSON.stringify(agent.toolIds ?? []),
      JSON.stringify(agent.skillIds ?? []),
      agent.maxConcurrentTasks ?? 1,
      agent.projectId,
      now,
      now,
    );

    return this.findById(id)!;
  }

  update(id: string, data: Partial<Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>>): Agent | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
    if (data.type !== undefined) { fields.push('type = ?'); values.push(data.type); }
    if (data.status !== undefined) { fields.push('status = ?'); values.push(data.status); }
    if (data.systemPrompt !== undefined) { fields.push('system_prompt = ?'); values.push(data.systemPrompt); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.groupId !== undefined) { fields.push('group_id = ?'); values.push(data.groupId ?? null); }
    if (data.parentAgentId !== undefined) { fields.push('parent_agent_id = ?'); values.push(data.parentAgentId ?? null); }
    if (data.modelId !== undefined) { fields.push('model_id = ?'); values.push(data.modelId ?? null); }
    if (data.providerId !== undefined) { fields.push('provider_id = ?'); values.push(data.providerId ?? null); }
    if (data.toolIds !== undefined) { fields.push('tool_ids = ?'); values.push(JSON.stringify(data.toolIds)); }
    if (data.skillIds !== undefined) { fields.push('skill_ids = ?'); values.push(JSON.stringify(data.skillIds)); }
    if (data.maxConcurrentTasks !== undefined) { fields.push('max_concurrent_tasks = ?'); values.push(data.maxConcurrentTasks); }
    if (data.projectId !== undefined) { fields.push('project_id = ?'); values.push(data.projectId); }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    return result.changes > 0;
  }

  updateStatus(id: string, status: AgentStatus): Agent | undefined {
    const now = new Date().toISOString();
    const result = this.db.prepare('UPDATE agents SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id);
    if (result.changes === 0) return undefined;
    return this.findById(id);
  }
}
