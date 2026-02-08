import { Router } from 'express';
import { toolCreateSchema } from '@mailgent/shared';
import type { ToolRepository } from '../../db/repositories/tool.repo';
import type { ToolRegistry } from '../../tools/tool-registry';

interface ToolRoutesDeps {
  toolRepo: ToolRepository;
  toolRegistry: ToolRegistry;
}

export function createToolRoutes(deps: ToolRoutesDeps): Router {
  const router = Router();
  const { toolRepo, toolRegistry } = deps;

  // GET /tools - List all tools
  router.get('/', (_req, res) => {
    try {
      const tools = toolRepo.findAll();
      res.json(tools);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // GET /tools/:id - Get tool by ID
  router.get('/:id', (req, res) => {
    try {
      const tool = toolRepo.findById(req.params.id);
      if (!tool) {
        res.status(404).json({ error: 'Tool not found' });
        return;
      }
      res.json(tool);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /tools - Create a new tool
  router.post('/', (req, res) => {
    try {
      const parsed = toolCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      const tool = toolRepo.create(parsed.data);

      // Register in the in-memory registry if code is provided (custom tool)
      if (tool.code) {
        toolRegistry.register(tool, async () => ({ info: 'Custom tool registered via API' }));
      }

      res.status(201).json(tool);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // PUT /tools/:id - Update a tool
  router.put('/:id', (req, res) => {
    try {
      const existing = toolRepo.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Tool not found' });
        return;
      }

      const partial = toolCreateSchema.partial().safeParse(req.body);
      if (!partial.success) {
        res.status(400).json({ error: 'Validation failed', details: partial.error.issues });
        return;
      }

      // Handle isEnabled separately (not in toolCreateSchema)
      const updateData: Record<string, unknown> = { ...partial.data };
      if (typeof req.body.isEnabled === 'boolean') {
        updateData.isEnabled = req.body.isEnabled;
      }

      const updated = toolRepo.update(req.params.id, updateData as any);

      // Sync isEnabled back to in-memory registry for builtin tools
      if (updated && existing.isBuiltin && typeof req.body.isEnabled === 'boolean') {
        toolRegistry.updateEnabled(existing.name, req.body.isEnabled);
      }

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // DELETE /tools/:id - Delete a tool
  router.delete('/:id', (req, res) => {
    try {
      const existing = toolRepo.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Tool not found' });
        return;
      }

      if (existing.isBuiltin) {
        res.status(403).json({ error: 'Cannot delete built-in tools' });
        return;
      }

      // Unregister from in-memory registry
      toolRegistry.unregister(existing.name);

      const deleted = toolRepo.delete(req.params.id);
      if (!deleted) {
        res.status(500).json({ error: 'Failed to delete tool' });
        return;
      }
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  return router;
}
