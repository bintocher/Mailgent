import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('project-db');

export class ProjectDatabase {
  private db: Database.Database;

  constructor(dbPath: string) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    log.info({ path: dbPath }, 'Project database initialized');
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
        log.info({ migration: migration.name }, 'Applying project migration');
        this.db.exec(migration.sql);
        this.db.prepare('INSERT INTO migrations (name) VALUES (?)').run(migration.name);
      }
    }
  }

  private getMigrations() {
    return [
      {
        name: '001_agents',
        sql: `
          CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            type TEXT NOT NULL CHECK(type IN ('system', 'worker', 'lead')),
            status TEXT DEFAULT 'idle',
            system_prompt TEXT NOT NULL,
            description TEXT DEFAULT '',
            group_id TEXT,
            parent_agent_id TEXT,
            model_id TEXT,
            provider_id TEXT,
            tool_ids TEXT DEFAULT '[]',
            skill_ids TEXT DEFAULT '[]',
            max_concurrent_tasks INTEGER DEFAULT 1,
            project_id TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (group_id) REFERENCES agent_groups(id) ON DELETE SET NULL
          );
        `,
      },
      {
        name: '002_groups',
        sql: `
          CREATE TABLE IF NOT EXISTS agent_groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            email TEXT NOT NULL UNIQUE,
            lead_agent_id TEXT,
            max_members INTEGER DEFAULT 10,
            specializations TEXT DEFAULT '[]',
            project_id TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );
        `,
      },
      {
        name: '003_emails',
        sql: `
          CREATE TABLE IF NOT EXISTS emails (
            id TEXT PRIMARY KEY,
            message_id TEXT NOT NULL UNIQUE,
            "from" TEXT NOT NULL,
            "to" TEXT NOT NULL,
            cc TEXT,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            html_body TEXT,
            thread_id TEXT NOT NULL,
            in_reply_to TEXT,
            "references" TEXT,
            attachments TEXT,
            priority INTEGER DEFAULT 0,
            is_read INTEGER DEFAULT 0,
            is_processed INTEGER DEFAULT 0,
            agent_id TEXT,
            project_id TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
          );

          CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_id);
          CREATE INDEX IF NOT EXISTS idx_emails_from ON emails("from");
          CREATE INDEX IF NOT EXISTS idx_emails_agent ON emails(agent_id);
          CREATE INDEX IF NOT EXISTS idx_emails_created ON emails(created_at);
        `,
      },
      {
        name: '004_tools',
        sql: `
          CREATE TABLE IF NOT EXISTS tools (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            parameters TEXT DEFAULT '[]',
            is_builtin INTEGER DEFAULT 0,
            is_enabled INTEGER DEFAULT 1,
            code TEXT,
            project_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );
        `,
      },
      {
        name: '005_skills',
        sql: `
          CREATE TABLE IF NOT EXISTS skills (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            trigger_pattern TEXT,
            instructions TEXT NOT NULL,
            required_tool_ids TEXT DEFAULT '[]',
            is_builtin INTEGER DEFAULT 0,
            is_enabled INTEGER DEFAULT 1,
            project_id TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );
        `,
      },
      {
        name: '006_chat_sessions',
        sql: `
          CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            project_id TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
          );

          CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
            content TEXT NOT NULL,
            agent_id TEXT,
            metadata TEXT,
            timestamp TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_chat_session ON chat_messages(session_id);
        `,
      },
      {
        name: '007_project_settings',
        sql: `
          CREATE TABLE IF NOT EXISTS project_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          );
        `,
      },
      {
        name: '008a_chat_messages_type',
        sql: `
          ALTER TABLE chat_messages ADD COLUMN type TEXT DEFAULT NULL;
        `,
      },
      {
        name: '008_agent_logs',
        sql: `
          CREATE TABLE IF NOT EXISTS agent_logs (
            id TEXT PRIMARY KEY,
            agent_id TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            metadata TEXT,
            timestamp TEXT DEFAULT (datetime('now'))
          );

          CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent_id);
          CREATE INDEX IF NOT EXISTS idx_agent_logs_timestamp ON agent_logs(timestamp);
        `,
      },
    ];
  }

  getDb(): Database.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
    log.info('Project database closed');
  }
}
