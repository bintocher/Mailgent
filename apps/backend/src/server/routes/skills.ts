import { Router } from 'express';
import { skillCreateSchema } from '@mailgent/shared';
import type { SkillRepository } from '../../db/repositories/skill.repo';
import type { SkillRegistry } from '../../skills/skill-registry';

interface SkillRoutesDeps {
  skillRepo: SkillRepository;
  skillRegistry: SkillRegistry;
}

export function createSkillRoutes(deps: SkillRoutesDeps): Router {
  const router = Router();
  const { skillRepo, skillRegistry } = deps;

  // GET /skills - List all skills
  router.get('/', (_req, res) => {
    try {
      const skills = skillRepo.findAll();
      res.json(skills);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // GET /skills/:id - Get skill by ID
  router.get('/:id', (req, res) => {
    try {
      const skill = skillRepo.findById(req.params.id);
      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }
      res.json(skill);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /skills - Create a new skill
  router.post('/', (req, res) => {
    try {
      const parsed = skillCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      const skill = skillRepo.create(parsed.data);

      // Register in the in-memory registry
      skillRegistry.register(skill);

      res.status(201).json(skill);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // PUT /skills/:id - Update a skill
  router.put('/:id', (req, res) => {
    try {
      const existing = skillRepo.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      const partial = skillCreateSchema.partial().safeParse(req.body);
      if (!partial.success) {
        res.status(400).json({ error: 'Validation failed', details: partial.error.issues });
        return;
      }

      const updated = skillRepo.update(req.params.id, partial.data);
      if (updated) {
        // Re-register the updated skill in the in-memory registry
        skillRegistry.unregister(updated.id);
        skillRegistry.register(updated);
      }

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // DELETE /skills/:id - Delete a skill
  router.delete('/:id', (req, res) => {
    try {
      const existing = skillRepo.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }

      if (existing.isBuiltin) {
        res.status(403).json({ error: 'Cannot delete built-in skills' });
        return;
      }

      // Unregister from in-memory registry
      skillRegistry.unregister(existing.id);

      const deleted = skillRepo.delete(req.params.id);
      if (!deleted) {
        res.status(500).json({ error: 'Failed to delete skill' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  return router;
}
