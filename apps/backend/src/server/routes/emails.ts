import { Router } from 'express';
import type { EmailFilter } from '@mailgent/shared';
import type { EmailRepository } from '../../db/repositories/email.repo';

interface EmailRoutesDeps {
  emailRepo: EmailRepository;
}

export function createEmailRoutes(deps: EmailRoutesDeps): Router {
  const router = Router();
  const { emailRepo } = deps;

  // GET /emails - List emails with optional query filters
  router.get('/', (req, res) => {
    try {
      const filter: EmailFilter = {};

      if (typeof req.query.agentId === 'string') filter.agentId = req.query.agentId;
      if (typeof req.query.from === 'string') filter.from = req.query.from;
      if (typeof req.query.to === 'string') filter.to = req.query.to;
      if (typeof req.query.threadId === 'string') filter.threadId = req.query.threadId;
      if (req.query.isRead === 'true') filter.isRead = true;
      if (req.query.isRead === 'false') filter.isRead = false;
      if (typeof req.query.limit === 'string') {
        const limit = parseInt(req.query.limit, 10);
        if (!isNaN(limit) && limit > 0) filter.limit = limit;
      }
      if (typeof req.query.offset === 'string') {
        const offset = parseInt(req.query.offset, 10);
        if (!isNaN(offset) && offset >= 0) filter.offset = offset;
      }

      const emails = emailRepo.findAll(filter);
      res.json(emails);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // GET /emails/threads - List email threads
  // NOTE: This route must be declared before /emails/:id to avoid "threads" being parsed as :id
  router.get('/threads', (req, res) => {
    try {
      const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 50;
      const offset = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;

      const threads = emailRepo.getThreads(
        isNaN(limit) ? 50 : limit,
        isNaN(offset) ? 0 : offset,
      );
      res.json(threads);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // DELETE /emails - Delete all emails
  router.delete('/', (_req, res) => {
    try {
      const deleted = emailRepo.deleteAll();
      res.json({ deleted });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // GET /emails/:id - Get email by ID
  router.get('/:id', (req, res) => {
    try {
      const email = emailRepo.findById(req.params.id);
      if (!email) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }
      res.json(email);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  return router;
}
