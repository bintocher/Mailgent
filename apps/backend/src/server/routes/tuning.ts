import { Router } from 'express';
import type { TuningEngine } from '../../tuning/tuning-engine';
import type { TuningRepository } from '../../db/repositories/tuning.repo';
import type { AgentRepository } from '../../db/repositories/agent.repo';
import type { AgentRegistry } from '../../agents/agent-registry';
import { createChildLogger } from '../../utils/logger';

const log = createChildLogger('tuning-routes');

interface TuningRoutesDeps {
  tuningEngine: TuningEngine;
  tuningRepo: TuningRepository;
  agentRepo: AgentRepository;
  agentRegistry: AgentRegistry;
}

export function createTuningRoutes(deps: TuningRoutesDeps): Router {
  const { tuningEngine, tuningRepo, agentRepo, agentRegistry } = deps;
  const router = Router();

  // GET /tuning/models — list available models for tuning
  router.get('/models', (_req, res) => {
    try {
      const models = tuningEngine.getAvailableModels().map(m => ({
        id: `${m.providerId}:${m.id}`,
        modelId: m.id,
        providerId: m.providerId,
        displayName: m.displayName,
        costPerInputToken: m.costPerInputToken,
        costPerOutputToken: m.costPerOutputToken,
      }));
      res.json(models);
    } catch (err) {
      log.error({ error: err }, 'Failed to fetch available models');
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // POST /tuning/start — start a tuning session
  router.post('/start', async (req, res) => {
    try {
      const { agentId, tasksCount, modelIds, judgeModelId } = req.body;

      if (!agentId || !tasksCount) {
        res.status(400).json({ error: 'agentId and tasksCount are required' });
        return;
      }

      if (tasksCount < 3 || tasksCount > 10) {
        res.status(400).json({ error: 'tasksCount must be between 3 and 10' });
        return;
      }

      const agent = agentRepo.findById(agentId);
      if (!agent) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      const session = await tuningEngine.startSession(
        { agentId, tasksCount, modelIds, judgeModelId },
        agent,
      );

      res.status(201).json(session);
    } catch (err) {
      log.error({ error: err }, 'Failed to start tuning session');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Internal error' });
    }
  });

  // GET /tuning/sessions — list all sessions
  router.get('/sessions', (_req, res) => {
    try {
      const sessions = tuningRepo.getAllSessions();
      res.json(sessions);
    } catch (err) {
      log.error({ error: err }, 'Failed to fetch tuning sessions');
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // GET /tuning/sessions/:id — get session details + results
  router.get('/sessions/:id', (req, res) => {
    try {
      const session = tuningRepo.getSession(req.params.id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const results = tuningRepo.getResultsBySession(req.params.id);
      res.json({ ...session, results });
    } catch (err) {
      log.error({ error: err }, 'Failed to fetch tuning session');
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // POST /tuning/sessions/:id/apply — apply recommended model to agent
  router.post('/sessions/:id/apply', (req, res) => {
    try {
      const session = tuningRepo.getSession(req.params.id);
      if (!session) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      if (!session.recommendation) {
        res.status(400).json({ error: 'Session has no recommendation yet' });
        return;
      }

      // Use the category from request body, default to bestOverall
      const category = (req.body?.category as string) || 'bestOverall';
      const rec = session.recommendation;
      const pick = category === 'bestValue' ? rec.bestValue
        : category === 'bestSpeed' ? rec.bestSpeed
        : rec.bestOverall;

      const updated = agentRepo.update(session.agentId, {
        modelId: pick.modelId,
        providerId: pick.providerId,
      });

      if (!updated) {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }

      // Also update in-memory agent so it takes effect immediately
      const active = agentRegistry.get(session.agentId);
      if (active) {
        active.agent.modelId = pick.modelId;
        active.agent.providerId = pick.providerId;
        log.info({ agentId: session.agentId, modelId: pick.modelId, providerId: pick.providerId }, 'Applied tuning model to running agent');
      }

      res.json({ agent: updated, applied: pick });
    } catch (err) {
      log.error({ error: err }, 'Failed to apply tuning recommendation');
      res.status(500).json({ error: 'Internal error' });
    }
  });

  // DELETE /tuning/sessions/:id — delete session
  router.delete('/sessions/:id', (req, res) => {
    try {
      const deleted = tuningRepo.deleteSession(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Session not found' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      log.error({ error: err }, 'Failed to delete tuning session');
      res.status(500).json({ error: 'Internal error' });
    }
  });

  return router;
}
