import type Database from 'better-sqlite3';

export class SettingsRepository {
  private table: 'global_settings' | 'project_settings';

  constructor(
    private db: Database.Database,
    table: 'global_settings' | 'project_settings' = 'project_settings',
  ) {
    this.table = table;
  }

  swapDb(db: Database.Database): void { this.db = db; }

  get<T = unknown>(key: string): T | undefined {
    const row = this.db
      .prepare(`SELECT value FROM ${this.table} WHERE key = ?`)
      .get(key) as { value: string } | undefined;
    if (!row) return undefined;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return row.value as unknown as T;
    }
  }

  set<T = unknown>(key: string, value: T): void {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    this.db.prepare(`
      INSERT INTO ${this.table} (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, serialized);
  }

  getAll(): Record<string, unknown> {
    const rows = this.db
      .prepare(`SELECT key, value FROM ${this.table}`)
      .all() as { key: string; value: string }[];

    const result: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        result[row.key] = JSON.parse(row.value);
      } catch {
        result[row.key] = row.value;
      }
    }
    return result;
  }
}
