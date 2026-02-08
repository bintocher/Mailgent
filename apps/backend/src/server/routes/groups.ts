import { Router } from 'express';
import { groupCreateSchema } from '@mailgent/shared';
import type { GroupManager } from '../../agents/group-manager';
import type { GroupRepository } from '../../db/repositories/group.repo';

interface GroupRoutesDeps {
  groupManager: GroupManager;
  groupRepo: GroupRepository;
}

export function createGroupRoutes(deps: GroupRoutesDeps): Router {
  const router = Router();
  const { groupManager, groupRepo } = deps;

  // GET /groups - List all groups
  router.get('/', (_req, res) => {
    try {
      const groups = groupRepo.findAll();
      res.json(groups);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // GET /groups/:id - Get group by ID
  router.get('/:id', (req, res) => {
    try {
      const group = groupRepo.findById(req.params.id);
      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }
      res.json(group);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /groups - Create a new group
  router.post('/', (req, res) => {
    try {
      const parsed = groupCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      const group = groupRepo.create({
        ...parsed.data,
        projectId: (req as any).projectId ?? 'default',
      });
      res.status(201).json(group);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // PUT /groups/:id - Update a group
  router.put('/:id', (req, res) => {
    try {
      const existing = groupRepo.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      const partial = groupCreateSchema.partial().safeParse(req.body);
      if (!partial.success) {
        res.status(400).json({ error: 'Validation failed', details: partial.error.issues });
        return;
      }

      const updated = groupRepo.update(req.params.id, partial.data);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // DELETE /groups/:id - Delete a group
  router.delete('/:id', (req, res) => {
    try {
      const existing = groupRepo.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      const deleted = groupRepo.delete(req.params.id);
      if (!deleted) {
        res.status(500).json({ error: 'Failed to delete group' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /groups/:id/assign - Assign an agent to a group
  router.post('/:id/assign', (req, res) => {
    try {
      const { agentId } = req.body;
      if (!agentId || typeof agentId !== 'string') {
        res.status(400).json({ error: 'Validation failed', details: 'agentId is required and must be a string' });
        return;
      }

      const group = groupRepo.findById(req.params.id);
      if (!group) {
        res.status(404).json({ error: 'Group not found' });
        return;
      }

      groupManager.assignAgent(req.params.id, agentId);
      const updated = groupRepo.findById(req.params.id);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  return router;
}
