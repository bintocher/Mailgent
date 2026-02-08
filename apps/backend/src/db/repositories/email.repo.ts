import type Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { Email, EmailFilter, EmailSendParams, EmailThread } from '@mailgent/shared';

interface EmailRow {
  id: string;
  message_id: string;
  from: string;
  to: string;
  cc: string | null;
  subject: string;
  body: string;
  html_body: string | null;
  thread_id: string;
  in_reply_to: string | null;
  references: string | null;
  attachments: string | null;
  priority: number;
  is_read: number;
  is_processed: number;
  agent_id: string | null;
  project_id: string;
  created_at: string;
}

function rowToEmail(row: EmailRow): Email {
  return {
    id: row.id,
    messageId: row.message_id,
    from: row.from,
    to: JSON.parse(row.to),
    cc: row.cc ? JSON.parse(row.cc) : undefined,
    subject: row.subject,
    body: row.body,
    htmlBody: row.html_body ?? undefined,
    threadId: row.thread_id,
    inReplyTo: row.in_reply_to ?? undefined,
    references: row.references ? JSON.parse(row.references) : undefined,
    attachments: row.attachments ? JSON.parse(row.attachments) : undefined,
    priority: row.priority,
    isRead: row.is_read === 1,
    isProcessed: row.is_processed === 1,
    agentId: row.agent_id ?? undefined,
    projectId: row.project_id,
    createdAt: row.created_at,
  };
}

export class EmailRepository {
  constructor(private db: Database.Database) {}

  swapDb(db: Database.Database): void { this.db = db; }

  findAll(filter?: EmailFilter): Email[] {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (filter) {
      if (filter.agentId !== undefined) { conditions.push('agent_id = ?'); values.push(filter.agentId); }
      if (filter.from !== undefined) { conditions.push('"from" = ?'); values.push(filter.from); }
      if (filter.to !== undefined) { conditions.push('"to" LIKE ?'); values.push(`%${filter.to}%`); }
      if (filter.threadId !== undefined) { conditions.push('thread_id = ?'); values.push(filter.threadId); }
      if (filter.isRead !== undefined) { conditions.push('is_read = ?'); values.push(filter.isRead ? 1 : 0); }
      if (filter.isProcessed !== undefined) { conditions.push('is_processed = ?'); values.push(filter.isProcessed ? 1 : 0); }
    }

    let sql = 'SELECT * FROM emails';
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';

    if (filter?.limit !== undefined) {
      sql += ' LIMIT ?';
      values.push(filter.limit);
      if (filter?.offset !== undefined) {
        sql += ' OFFSET ?';
        values.push(filter.offset);
      }
    }

    const rows = this.db.prepare(sql).all(...values) as EmailRow[];
    return rows.map(rowToEmail);
  }

  findById(id: string): Email | undefined {
    const row = this.db.prepare('SELECT * FROM emails WHERE id = ?').get(id) as EmailRow | undefined;
    return row ? rowToEmail(row) : undefined;
  }

  findByMessageId(messageId: string): Email | undefined {
    const row = this.db
      .prepare('SELECT * FROM emails WHERE message_id = ?')
      .get(messageId) as EmailRow | undefined;
    return row ? rowToEmail(row) : undefined;
  }

  findByThreadId(threadId: string): Email[] {
    const rows = this.db
      .prepare('SELECT * FROM emails WHERE thread_id = ? ORDER BY created_at ASC')
      .all(threadId) as EmailRow[];
    return rows.map(rowToEmail);
  }

  countByThreadId(threadId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM emails WHERE thread_id = ?')
      .get(threadId) as { count: number };
    return row.count;
  }

  /**
   * Store an incoming email with exact IDs preserved (from SMTP).
   * Unlike create(), this does NOT generate new id/messageId.
   */
  storeIncoming(email: Email): void {
    this.db.prepare(`
      INSERT INTO emails (id, message_id, "from", "to", cc, subject, body, html_body,
        thread_id, in_reply_to, "references", attachments, priority, is_read, is_processed,
        agent_id, project_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      email.id,
      email.messageId,
      email.from,
      JSON.stringify(email.to),
      email.cc ? JSON.stringify(email.cc) : null,
      email.subject,
      email.body,
      email.htmlBody ?? null,
      email.threadId,
      email.inReplyTo ?? null,
      email.references ? JSON.stringify(email.references) : null,
      email.attachments ? JSON.stringify(email.attachments) : null,
      email.priority,
      email.isRead ? 1 : 0,
      email.isProcessed ? 1 : 0,
      email.agentId ?? null,
      email.projectId,
      email.createdAt,
    );
  }

  /** Create an outgoing email (generates id, messageId). */
  create(email: EmailSendParams & { agentId?: string; projectId: string }): Email {
    const now = new Date().toISOString();
    const id = uuidv4();
    const messageId = `<${uuidv4()}@mailgent.local>`;
    const threadId = email.threadId ?? uuidv4();

    this.db.prepare(`
      INSERT INTO emails (id, message_id, "from", "to", cc, subject, body, html_body,
        thread_id, in_reply_to, "references", attachments, priority, is_read, is_processed,
        agent_id, project_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)
    `).run(
      id,
      messageId,
      email.from,
      JSON.stringify(email.to),
      email.cc ? JSON.stringify(email.cc) : null,
      email.subject,
      email.body,
      email.htmlBody ?? null,
      threadId,
      email.inReplyTo ?? null,
      null, // references will be built from the thread
      null, // attachments
      email.priority ?? 0,
      email.agentId ?? null,
      email.projectId,
      now,
    );

    return this.findById(id)!;
  }

  markRead(id: string): boolean {
    const result = this.db.prepare('UPDATE emails SET is_read = 1 WHERE id = ?').run(id);
    return result.changes > 0;
  }

  markProcessed(id: string): boolean {
    const result = this.db.prepare('UPDATE emails SET is_processed = 1 WHERE id = ?').run(id);
    return result.changes > 0;
  }

  getThreads(limit: number = 50, offset: number = 0): EmailThread[] {
    const threadRows = this.db.prepare(`
      SELECT thread_id, subject, MAX(created_at) as last_email_at, COUNT(*) as email_count
      FROM emails
      GROUP BY thread_id
      ORDER BY last_email_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as { thread_id: string; subject: string; last_email_at: string; email_count: number }[];

    return threadRows.map((tr) => {
      const emails = this.findByThreadId(tr.thread_id);
      const participants = new Set<string>();
      for (const email of emails) {
        participants.add(email.from);
        for (const to of email.to) {
          participants.add(to);
        }
      }

      return {
        id: tr.thread_id,
        subject: tr.subject,
        participants: Array.from(participants),
        emailCount: tr.email_count,
        lastEmailAt: tr.last_email_at,
        emails,
      };
    });
  }

  countUnread(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM emails WHERE is_read = 0').get() as { count: number };
    return row.count;
  }

  deleteAll(): number {
    const result = this.db.prepare('DELETE FROM emails').run();
    return result.changes;
  }
}
