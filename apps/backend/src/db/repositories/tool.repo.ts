import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { ToolDefinition, ToolCategory, ToolParameter } from '@mailgent/shared';

interface ToolRow {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: string;
  is_builtin: number;
  is_enabled: number;
  code: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTool(row: ToolRow): ToolDefinition {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category as ToolCategory,
    parameters: JSON.parse(row.parameters),
    isBuiltin: row.is_builtin === 1,
    isEnabled: row.is_enabled === 1,
    code: row.code ?? undefined,
    projectId: row.project_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ToolRepository {
  constructor(private db: Database.Database) {}

  swapDb(db: Database.Database): void { this.db = db; }

  findAll(): ToolDefinition[] {
    const rows = this.db.prepare('SELECT * FROM tools ORDER BY name ASC').all() as ToolRow[];
    return rows.map(rowToTool);
  }

  findById(id: string): ToolDefinition | undefined {
    const row = this.db.prepare('SELECT * FROM tools WHERE id = ?').get(id) as ToolRow | undefined;
    return row ? rowToTool(row) : undefined;
  }

  findByName(name: string): ToolDefinition | undefined {
    const row = this.db.prepare('SELECT * FROM tools WHERE name = ?').get(name) as ToolRow | undefined;
    return row ? rowToTool(row) : undefined;
  }

  create(tool: {
    name: string;
    description: string;
    category: ToolCategory;
    parameters?: ToolParameter[];
    isBuiltin?: boolean;
    isEnabled?: boolean;
    code?: string;
    projectId?: string;
  }): ToolDefinition {
    const now = new Date().toISOString();
    const id = uuidv4();

    this.db.prepare(`
      INSERT INTO tools (id, name, description, category, parameters, is_builtin, is_enabled,
        code, project_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      tool.name,
      tool.description,
      tool.category,
      JSON.stringify(tool.parameters ?? []),
      tool.isBuiltin ? 1 : 0,
      tool.isEnabled !== false ? 1 : 0,
      tool.code ?? null,
      tool.projectId ?? null,
      now,
      now,
    );

    return this.findById(id)!;
  }

  update(id: string, data: Partial<Omit<ToolDefinition, 'id' | 'createdAt' | 'updatedAt'>>): ToolDefinition | undefined {
    const existing = this.findById(id);
    if (!existing) return undefined;

    const fields: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
    if (data.description !== undefined) { fields.push('description = ?'); values.push(data.description); }
    if (data.category !== undefined) { fields.push('category = ?'); values.push(data.category); }
    if (data.parameters !== undefined) { fields.push('parameters = ?'); values.push(JSON.stringify(data.parameters)); }
    if (data.isBuiltin !== undefined) { fields.push('is_builtin = ?'); values.push(data.isBuiltin ? 1 : 0); }
    if (data.isEnabled !== undefined) { fields.push('is_enabled = ?'); values.push(data.isEnabled ? 1 : 0); }
    if (data.code !== undefined) { fields.push('code = ?'); values.push(data.code ?? null); }
    if (data.projectId !== undefined) { fields.push('project_id = ?'); values.push(data.projectId ?? null); }

    if (fields.length === 0) return existing;

    fields.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    this.db.prepare(`UPDATE tools SET ${fields.join(', ')} WHERE id = ?`).run(...values);

    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tools WHERE id = ?').run(id);
    return result.changes > 0;
  }
}
