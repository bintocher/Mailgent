import { Router } from 'express';
import type { ChatSession, ChatMessage } from '@mailgent/shared';
import type { ProjectDatabase } from '../../db/project-db';

interface ChatRoutesDeps {
  getProjectDb: () => ProjectDatabase | null;
}

interface ChatSessionRow {
  id: string;
  title: string;
  project_id: string;
  created_at: string;
  updated_at: string;
}

interface ChatMessageRow {
  id: string;
  session_id: string;
  role: string;
  content: string;
  agent_id: string | null;
  metadata: string | null;
  timestamp: string;
}

function rowToSession(row: ChatSessionRow): ChatSession {
  return {
    id: row.id,
    title: row.title,
    projectId: row.project_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: 0, // Will be enriched below
  };
}

function rowToMessage(row: ChatMessageRow): ChatMessage {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role as ChatMessage['role'],
    content: row.content,
    agentId: row.agent_id ?? undefined,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    timestamp: row.timestamp,
  };
}

export function createChatRoutes(deps: ChatRoutesDeps): Router {
  const router = Router();
  const { getProjectDb } = deps;

  // GET /chat/sessions - List all chat sessions
  router.get('/sessions', (_req, res) => {
    try {
      const projectDb = getProjectDb();
      if (!projectDb) {
        res.json([]);
        return;
      }
      const db = projectDb.getDb();

      const sessionRows = db.prepare(
        'SELECT * FROM chat_sessions ORDER BY updated_at DESC',
      ).all() as ChatSessionRow[];

      const sessions: ChatSession[] = sessionRows.map((row) => {
        const countRow = db
          .prepare('SELECT COUNT(*) as count FROM chat_messages WHERE session_id = ?')
          .get(row.id) as { count: number };

        return {
          ...rowToSession(row),
          messageCount: countRow.count,
        };
      });

      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // GET /chat/sessions/:id/messages - Get messages for a session
  router.get('/sessions/:id/messages', (req, res) => {
    try {
      const projectDb = getProjectDb();
      if (!projectDb) {
        res.status(400).json({ error: 'No project opened' });
        return;
      }
      const db = projectDb.getDb();

      const session = db
        .prepare('SELECT * FROM chat_sessions WHERE id = ?')
        .get(req.params.id) as ChatSessionRow | undefined;

      if (!session) {
        res.status(404).json({ error: 'Chat session not found' });
        return;
      }

      const messageRows = db
        .prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY timestamp ASC')
        .all(req.params.id) as ChatMessageRow[];

      const messages = messageRows.map(rowToMessage);
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  return router;
}
