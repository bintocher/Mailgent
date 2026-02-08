import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('global-db');

export class GlobalDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    log.info({ path: dbPath }, 'Global database initialized');
    this.runMigrations();
  }

  private runMigrations(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT DEFAULT (datetime('now'))
      );
    `);

    const migrations = this.getMigrations();
    const applied = new Set(
      this.db.prepare('SELECT name FROM migrations').all().map((r: any) => r.name)
    );

    for (const migration of migrations) {
      if (!applied.has(migration.name)) {
        log.info({ migration: migration.name }, 'Applying global migration');
        this.db.exec(migration.sql);
        this.db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
      }
    }
  }

  private getMigrations() {
    return [
      {
        name: '001_providers',
        sql: `
          CREATE TABLE IF NOT EXISTS llm_providers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('openai', 'anthropic', 'openai-compatible')),
            api_key TEXT NOT NULL,
            base_url TEXT NOT NULL,
            is_enabled INTEGER DEFAULT 1,
            rate_limit_rpm INTEGER DEFAULT 60,
            rate_limit_tpm INTEGER DEFAULT 100000,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );

          CREATE TABLE IF NOT EXISTS llm_models (
            id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            display_name TEXT NOT NULL,
            context_window INTEGER NOT NULL,
            cost_per_input_token REAL DEFAULT 0,
            cost_per_output_token REAL DEFAULT 0,
            capabilities TEXT DEFAULT '[]',
            is_enabled INTEGER DEFAULT 1,
            PRIMARY KEY (id, provider_id),
            FOREIGN KEY (provider_id) REFERENCES llm_providers(id) ON DELETE CASCADE
          );
        `,
      },
      {
        name: '002_global_settings',
        sql: `
          CREATE TABLE IF NOT EXISTS global_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
        `,
      },
      {
        name: '003_usage_records',
        sql: `
          CREATE TABLE IF NOT EXISTS llm_usage_records (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            agent_name TEXT NOT NULL,
            group_id TEXT,
            model_id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            prompt_tokens INTEGER NOT NULL,
            completion_tokens INTEGER NOT NULL,
            total_tokens INTEGER NOT NULL,
            cost_usd REAL NOT NULL,
            task_type TEXT DEFAULT 'general',
            duration_ms INTEGER NOT NULL,
            success INTEGER DEFAULT 1,
            quality_score REAL,
            project_id TEXT,
            timestamp TEXT DEFAULT (datetime('now'))
          );

          CREATE INDEX IF NOT EXISTS idx_usage_agent ON llm_usage_records(agent_id);
          CREATE INDEX IF NOT EXISTS idx_usage_model ON llm_usage_records(model_id);
          CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON llm_usage_records(timestamp);
          CREATE INDEX IF NOT EXISTS idx_usage_project ON llm_usage_records(project_id);
        `,
      },
      {
        name: '004_routing_rules',
        sql: `
          CREATE TABLE IF NOT EXISTS llm_routing_rules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            task_type TEXT NOT NULL,
            preferred_model_id TEXT NOT NULL,
            preferred_provider_id TEXT NOT NULL,
            fallback_model_id TEXT,
            fallback_provider_id TEXT,
            max_cost_per_call REAL,
            priority INTEGER DEFAULT 0,
            is_enabled INTEGER DEFAULT 1
          );
        `,
      },
      {
        name: '005_provider_metadata_and_zai_type',
        sql: `
          PRAGMA foreign_keys = OFF;

          CREATE TABLE llm_providers_new (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            api_key TEXT NOT NULL,
            base_url TEXT NOT NULL DEFAULT '',
            is_enabled INTEGER DEFAULT 1,
            rate_limit_rpm INTEGER DEFAULT 60,
            rate_limit_tpm INTEGER DEFAULT 100000,
            metadata TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );

          INSERT INTO llm_providers_new (id, name, type, api_key, base_url, is_enabled, rate_limit_rpm, rate_limit_tpm, created_at, updated_at)
            SELECT id, name, type, api_key, base_url, is_enabled, rate_limit_rpm, rate_limit_tpm, created_at, updated_at
            FROM llm_providers;

          DROP TABLE llm_providers;
          ALTER TABLE llm_providers_new RENAME TO llm_providers;

          CREATE TABLE llm_models_new (
            id TEXT NOT NULL,
            provider_id TEXT NOT NULL,
            display_name TEXT NOT NULL,
            context_window INTEGER NOT NULL,
            cost_per_input_token REAL DEFAULT 0,
            cost_per_output_token REAL DEFAULT 0,
            capabilities TEXT DEFAULT '[]',
            is_enabled INTEGER DEFAULT 1,
            PRIMARY KEY (id, provider_id),
            FOREIGN KEY (provider_id) REFERENCES llm_providers(id) ON DELETE CASCADE
          );

          INSERT INTO llm_models_new SELECT * FROM llm_models;

          DROP TABLE llm_models;
          ALTER TABLE llm_models_new RENAME TO llm_models;

          PRAGMA foreign_keys = ON;
        `,
      },
    ];
  }

  getDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
    log.info('Global database closed');
  }
}
