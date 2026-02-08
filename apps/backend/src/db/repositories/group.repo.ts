import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { AgentGroup, Agent } from '@mailgent/shared';

interface GroupRow {
  id: string;
  name: string;
  description: string;
  email: string;
  lead_agent_id: string | null;
  max_members: number;
  specializations: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}

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

function rowToGroup(row: GroupRow, memberAgentIds: string[]): AgentGroup {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    email: row.email,
    leadAgentId: row.lead_agent_id ?? undefined,
    memberAgentIds,
    maxMembers: row.max_members,
    specializations: JSON.parse(row.specializations),
    projectId: row.project_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class GroupRepository {
  constructor(private db: Database.Database) {}

  swapDb(db: Database.Database): void { this.db = db; }

  private getMemberIds(groupId: string): string[] {
    const rows = this.db
      .prepare('SELECT id FROM agents WHERE group_id = ?')
      .all(groupId) as { id: string }[];
    return rows.map((r) => r.id);
  }

  findAll(): AgentGroup[] {
    const rows = this.db.prepare('SELECT * FROM agent_groups ORDER BY created_at DESC').all() as GroupRow[];
    return rows.map((row) => rowToGroup(row, this.getMemberIds(row.id)));
  }

  findById(id: string): AgentGroup | undefined {
    const row = this.db.prepare('SELECT * FROM agent_groups WHERE id = ?').get(id) as GroupRow | undefined;
    if (!row) return undefined;
    return rowToGroup(row, this.getMemberIds(row.id));
  }

  findByEmail(email: string): AgentGroup | undefined {
    const row = this.db.prepare('SELECT * FROM agent_groups WHERE email = ?').get(email) as GroupRow | undefined;
    if (!row) return undefined;
    return rowToGroup(row, this.getMemberIds(row.id));
  }

  create(group: {
    name: string;
    description: string;
    email: string;
    leadAgentId?: string;
    maxMembers?: number;
    specializations?: string[];
    projectId: string;
  }): AgentGroup {
    const now = new Date().toISOString();
    const id = uuidv4();

    this.db.prepare(`
      INSERT INTO agent_groups (id, name, description, email, lead_agent_id, max_members,
        specializations, project_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      group.name,
      group.description,
      group.email,
      group.leadAgentId ?? null,
      group.maxMembers ?? 10,
      JSON.stringify(group.specializations ?? []),
      group.projectId,
      now,
      now,
    );

    return this.findById(id)!;
  }

  update(id: string, data: Partial<Omit<AgentGroup, 'id' | 'createdAt' | 'updatedAt' | 'memberAgentIds'>>): AgentGroup | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.email !== undefined) { fields.push('email = ?'); values.push(data.email); }
    if (data.leadAgentId !== undefined) { fields.push('lead_agent_id = ?'); values.push(data.leadAgentId ?? null); }
    if (data.maxMembers !== undefined) { fields.push('max_members = ?'); values.push(data.maxMembers); }
    if (data.specializations !== undefined) { fields.push('specializations = ?'); values.push(JSON.stringify(data.specializations)); }
    if (data.projectId !== undefined) { fields.push('project_id = ?'); values.push(data.projectId); }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.db.prepare(`UPDATE agent_groups SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  delete(id: string): boolean {
    // Unlink agents from this group first
    this.db.prepare('UPDATE agents SET group_id = NULL WHERE group_id = ?').run(id);
    const result = this.db.prepare('DELETE FROM agent_groups WHERE id = ?').run(id);
    return result.changes > 0;
  }

  addMember(groupId: string, agentId: string): boolean {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('UPDATE agents SET group_id = ?, updated_at = ? WHERE id = ?')
      .run(groupId, now, agentId);
    return result.changes > 0;
  }

  removeMember(groupId: string, agentId: string): boolean {
    const now = new Date().toISOString();
    const result = this.db
      .prepare('UPDATE agents SET group_id = NULL, updated_at = ? WHERE id = ? AND group_id = ?')
      .run(now, agentId, groupId);
    return result.changes > 0;
  }

  getMembers(groupId: string): Agent[] {
    const rows = this.db
      .prepare('SELECT * FROM agents WHERE group_id = ? ORDER BY created_at ASC')
      .all(groupId) as AgentRow[];
    return rows.map(rowToAgent);
  }
}
