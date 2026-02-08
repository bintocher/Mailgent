import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { SkillDefinition } from '@mailgent/shared';

interface SkillRow {
  id: string;
  name: string;
  description: string;
  trigger_pattern: string | null;
  instructions: string;
  required_tool_ids: string;
  is_builtin: number;
  is_enabled: number;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToSkill(row: SkillRow): SkillDefinition {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    triggerPattern: row.trigger_pattern ?? undefined,
    instructions: row.instructions,
    requiredToolIds: JSON.parse(row.required_tool_ids),
    isBuiltin: row.is_builtin === 1,
    isEnabled: row.is_enabled === 1,
    projectId: row.project_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SkillRepository {
  constructor(private db: Database.Database) {}

  swapDb(db: Database.Database): void { this.db = db; }

  findAll(): SkillDefinition[] {
    const rows = this.db.prepare('SELECT * FROM skills ORDER BY name ASC').all() as SkillRow[];
    return rows.map(rowToSkill);
  }

  findById(id: string): SkillDefinition | undefined {
    const row = this.db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as SkillRow | undefined;
    return row ? rowToSkill(row) : undefined;
  }

  create(skill: {
    name: string;
    description: string;
    triggerPattern?: string;
    instructions: string;
    requiredToolIds?: string[];
    isBuiltin?: boolean;
    isEnabled?: boolean;
    projectId?: string;
  }): SkillDefinition {
    const now = new Date().toISOString();
    const id = uuidv4();

    this.db.prepare(`
      INSERT INTO skills (id, name, description, trigger_pattern, instructions,
        required_tool_ids, is_builtin, is_enabled, project_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      skill.name,
      skill.description,
      skill.triggerPattern ?? null,
      skill.instructions,
      JSON.stringify(skill.requiredToolIds ?? []),
      skill.isBuiltin ? 1 : 0,
      skill.isEnabled !== false ? 1 : 0,
      skill.projectId ?? null,
      now,
      now,
    );

    return this.findById(id)!;
  }

  update(id: string, data: Partial<Omit<SkillDefinition, 'id' | 'createdAt' | 'updatedAt'>>): SkillDefinition | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.triggerPattern !== undefined) { fields.push('trigger_pattern = ?'); values.push(data.triggerPattern ?? null); }
    if (data.instructions !== undefined) { fields.push('instructions = ?'); values.push(data.instructions); }
    if (data.requiredToolIds !== undefined) { fields.push('required_tool_ids = ?'); values.push(JSON.stringify(data.requiredToolIds)); }
    if (data.isBuiltin !== undefined) { fields.push('is_builtin = ?'); values.push(data.isBuiltin ? 1 : 0); }
    if (data.isEnabled !== undefined) { fields.push('is_enabled = ?'); values.push(data.isEnabled ? 1 : 0); }
    if (data.projectId !== undefined) { fields.push('project_id = ?'); values.push(data.projectId ?? null); }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.db.prepare(`UPDATE skills SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM skills WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
