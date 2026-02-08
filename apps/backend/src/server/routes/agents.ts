import { Router } from 'express';
import { agentCreateSchema } from '@mailgent/shared';
import type { AgentManager } from '../../agents/agent-manager';
import type { AgentRepository } from '../../db/repositories/agent.repo';

interface AgentRoutesDeps {
  agentManager: AgentManager;
  agentRepo: AgentRepository;
}

export function createAgentRoutes(deps: AgentRoutesDeps): Router {
  const router = Router();
  const { agentManager, agentRepo } = deps;

  // GET /agents - List all agents
  router.get('/', (_req, res) => {
    try {
      const agents = agentRepo.findAll();
      res.json(agents);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // GET /agents/:id - Get agent by ID
  router.get('/:id', (req, res) => {
    try {
      const agent = agentRepo.findById(req.params.id);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.json(agent);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /agents - Create a new agent
  router.post('/', async (req, res) => {
    try {
      const parsed = agentCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      const agent = await agentManager.createAgent(parsed.data);
      res.status(201).json(agent);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // PUT /agents/:id - Update an agent
  router.put('/:id', (req, res) => {
    try {
      const existing = agentRepo.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      // Partial validation: allow any subset of agentCreateSchema fields
      const partial = agentCreateSchema.partial().safeParse(req.body);
      if (!partial.success) {
        res.status(400).json({ error: 'Validation failed', details: partial.error.issues });
        return;
      }

      const updated = agentRepo.update(req.params.id, partial.data);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // DELETE /agents/:id - Delete an agent
  router.delete('/:id', (req, res) => {
    try {
      const existing = agentRepo.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      agentManager.stopAgent(req.params.id);
      const deleted = agentRepo.delete(req.params.id);
      if (!deleted) {
        res.status(500).json({ error: 'Failed to delete agent' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /agents/:id/stop - Stop a running agent
  router.post('/:id/stop', (req, res) => {
    try {
      const existing = agentRepo.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      agentManager.stopAgent(req.params.id);
      const updated = agentRepo.findById(req.params.id);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /agents/:id/start - Start (re-register) an agent
  router.post('/:id/start', (req, res) => {
    try {
      const agent = agentRepo.findById(req.params.id);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      const updated = agentRepo.updateStatus(req.params.id, 'idle');
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  return router;
}
