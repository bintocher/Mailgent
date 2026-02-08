import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import type Database from 'better-sqlite3';
import { providerCreateSchema, providerUpdateSchema } from '@mailgent/shared';
import type { LLMProviderConfig } from '@mailgent/shared';
import type { LLMFactory } from '../../llm/llm-factory';
import type { RateLimiter } from '../../llm/rate-limiter';
import type { TokenTracker } from '../../llm/token-tracker';
import { OpenAIProvider } from '../../llm/openai-provider';
import { ClaudeProvider } from '../../llm/claude-provider';
import { createChildLogger } from '../../utils/logger';

const log = createChildLogger('provider-routes');

interface ProviderRoutesDeps {
  globalDb: Database.Database;
  llmFactory: LLMFactory;
  rateLimiter: RateLimiter;
  tokenTracker: TokenTracker;
}

function maskApiKey(key: string): string {
  if (key.length <= 10) return '****';
  return key.slice(0, 6) + '****' + key.slice(-4);
}

function loadProviders(db: Database.Database): LLMProviderConfig[] {
  const rows = db.prepare('SELECT * FROM llm_providers').all() as any[];
  return rows.map((row) => {
    const modelRows = db.prepare('SELECT * FROM llm_models WHERE provider_id = ?').all(row.id) as any[];
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      apiKey: row.api_key,
      baseUrl: row.base_url,
      isEnabled: !!row.is_enabled,
      models: modelRows.map((m: any) => ({
        id: m.id,
        displayName: m.display_name,
        providerId: m.provider_id,
        contextWindow: m.context_window,
        costPerInputToken: m.cost_per_input_token,
        costPerOutputToken: m.cost_per_output_token,
        capabilities: JSON.parse(m.capabilities || '[]'),
        isEnabled: !!m.is_enabled,
      })),
      rateLimits: {
        requestsPerMinute: row.rate_limit_rpm,
        tokensPerMinute: row.rate_limit_tpm,
      },
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  });
}

function maskProvider(p: LLMProviderConfig): LLMProviderConfig {
  return { ...p, apiKey: maskApiKey(p.apiKey) };
}

export function createProviderRoutes(deps: ProviderRoutesDeps): Router {
  const router = Router();
  const { globalDb, llmFactory, rateLimiter, tokenTracker } = deps;

  // GET / — all providers with models (masked API keys)
  router.get('/', (_req, res) => {
    try {
      const providers = loadProviders(globalDb);
      res.json(providers.map(maskProvider));
    } catch (err) {
      log.error({ error: err }, 'Failed to list providers');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST / — create provider
  router.post('/', (req, res) => {
    try {
      const parsed = providerCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      const data = parsed.data;
      const id = uuid();

      globalDb.prepare(`
        INSERT INTO llm_providers (id, name, type, api_key, base_url, is_enabled, rate_limit_rpm, rate_limit_tpm, metadata)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
      `).run(
        id,
        data.name,
        data.type,
        data.apiKey,
        data.baseUrl || '',
        data.rateLimits?.requestsPerMinute ?? 60,
        data.rateLimits?.tokensPerMinute ?? 100000,
        JSON.stringify(data.metadata || {}),
      );

      // Insert models if provided
      if (data.models?.length) {
        const insertModel = globalDb.prepare(`
          INSERT INTO llm_models (id, provider_id, display_name, context_window, cost_per_input_token, cost_per_output_token, capabilities, is_enabled)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        for (const m of data.models) {
          insertModel.run(
            m.id, id, m.displayName, m.contextWindow,
            m.costPerInputToken, m.costPerOutputToken,
            JSON.stringify(m.capabilities), m.isEnabled !== false ? 1 : 0,
          );
        }
      }

      // Initialize in LLMFactory
      const config = loadProviders(globalDb).find((p) => p.id === id)!;
      llmFactory.createProvider(config);
      rateLimiter.configure(`${id}:*`, config.rateLimits.requestsPerMinute, config.rateLimits.tokensPerMinute);
      for (const model of config.models) {
        tokenTracker.registerModel(model);
        rateLimiter.configure(`${id}:${model.id}`, config.rateLimits.requestsPerMinute, config.rateLimits.tokensPerMinute);
      }

      res.status(201).json(maskProvider(config));
    } catch (err) {
      log.error({ error: err }, 'Failed to create provider');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // PUT /:id — update provider
  router.put('/:id', (req, res) => {
    try {
      const { id } = req.params;

      const existing = globalDb.prepare('SELECT * FROM llm_providers WHERE id = ?').get(id) as any;
      if (!existing) {
        res.status(404).json({ error: 'Provider not found' });
        return;
      }

      const parsed = providerUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      const data = parsed.data;

      // If apiKey contains mask pattern, don't update it
      let apiKey = existing.api_key;
      if (data.apiKey && !data.apiKey.includes('****')) {
        apiKey = data.apiKey;
      }

      globalDb.prepare(`
        UPDATE llm_providers
        SET name = ?, type = ?, api_key = ?, base_url = ?,
            rate_limit_rpm = ?, rate_limit_tpm = ?, metadata = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `).run(
        data.name ?? existing.name,
        data.type ?? existing.type,
        apiKey,
        data.baseUrl !== undefined ? (data.baseUrl || '') : existing.base_url,
        data.rateLimits?.requestsPerMinute ?? existing.rate_limit_rpm,
        data.rateLimits?.tokensPerMinute ?? existing.rate_limit_tpm,
        data.metadata ? JSON.stringify(data.metadata) : existing.metadata,
        id,
      );

      // Re-initialize in LLMFactory
      llmFactory.removeProvider(id);
      const config = loadProviders(globalDb).find((p) => p.id === id)!;
      if (config.isEnabled) {
        llmFactory.createProvider(config);
        rateLimiter.configure(`${id}:*`, config.rateLimits.requestsPerMinute, config.rateLimits.tokensPerMinute);
      }

      res.json(maskProvider(config));
    } catch (err) {
      log.error({ error: err }, 'Failed to update provider');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // DELETE /:id — delete provider
  router.delete('/:id', (req, res) => {
    try {
      const { id } = req.params;
      const existing = globalDb.prepare('SELECT * FROM llm_providers WHERE id = ?').get(id) as any;
      if (!existing) {
        res.status(404).json({ error: 'Provider not found' });
        return;
      }

      globalDb.prepare('DELETE FROM llm_providers WHERE id = ?').run(id);
      llmFactory.removeProvider(id);

      res.status(204).end();
    } catch (err) {
      log.error({ error: err }, 'Failed to delete provider');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /test — test connection by fetching models list (without saving)
  router.post('/test', async (req, res) => {
    try {
      const { type, apiKey, baseUrl } = req.body;
      if (!type || !apiKey) {
        res.status(400).json({ error: 'type and apiKey are required' });
        return;
      }

      const start = Date.now();
      let models: string[] = [];
      let error: string | undefined;

      try {
        if (type === 'anthropic') {
          const provider = new ClaudeProvider('_test', apiKey);
          models = await provider.listModels();
        } else {
          const provider = new OpenAIProvider('_test', apiKey, baseUrl || undefined);
          models = await provider.listModels();
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }

      const latencyMs = Date.now() - start;
      const available = models.length > 0 && !error;
      res.json({ available, models: models.map((id) => ({ id })), error, latencyMs });
    } catch (err) {
      log.error({ error: err }, 'Failed to test provider');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /:id/test — test saved provider by fetching models list
  router.post('/:id/test', async (req, res) => {
    try {
      const { id } = req.params;
      const provider = llmFactory.getProvider(id);
      if (!provider) {
        res.status(404).json({ error: 'Provider not found or not initialized' });
        return;
      }

      const start = Date.now();
      let models: string[] = [];
      let error: string | undefined;

      try {
        models = await provider.listModels();
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
      }

      const latencyMs = Date.now() - start;
      const available = models.length > 0 && !error;
      res.json({ available, models: models.map((mid) => ({ id: mid })), error, latencyMs });
    } catch (err) {
      log.error({ error: err }, 'Failed to test provider');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // POST /:id/models — fetch available models
  router.post('/:id/models', async (req, res) => {
    try {
      const { id } = req.params;

      const provider = llmFactory.getProvider(id);
      if (!provider) {
        res.status(404).json({ error: 'Provider not found or not initialized' });
        return;
      }

      const modelIds = await provider.listModels();
      res.json({ models: modelIds.map((mid) => ({ id: mid })) });
    } catch (err) {
      log.error({ error: err }, 'Failed to fetch models');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // PATCH /:id/models — update model list (enable/disable)
  router.patch('/:id/models', (req, res) => {
    try {
      const { id } = req.params;
      const { models } = req.body;

      if (!Array.isArray(models)) {
        res.status(400).json({ error: 'models must be an array' });
        return;
      }

      const existing = globalDb.prepare('SELECT * FROM llm_providers WHERE id = ?').get(id) as any;
      if (!existing) {
        res.status(404).json({ error: 'Provider not found' });
        return;
      }

      // Replace all models for this provider
      const deleteStmt = globalDb.prepare('DELETE FROM llm_models WHERE provider_id = ?');
      const insertStmt = globalDb.prepare(`
        INSERT INTO llm_models (id, provider_id, display_name, context_window, cost_per_input_token, cost_per_output_token, capabilities, is_enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = globalDb.transaction(() => {
        deleteStmt.run(id);
        for (const m of models) {
          insertStmt.run(
            m.id,
            id,
            m.displayName || m.id,
            m.contextWindow || 128000,
            m.costPerInputToken || 0,
            m.costPerOutputToken || 0,
            JSON.stringify(m.capabilities || []),
            m.isEnabled !== false ? 1 : 0,
          );
        }
      });
      transaction();

      // Re-register models in tokenTracker
      const config = loadProviders(globalDb).find((p) => p.id === id)!;
      for (const model of config.models) {
        tokenTracker.registerModel(model);
        rateLimiter.configure(`${id}:${model.id}`, config.rateLimits.requestsPerMinute, config.rateLimits.tokensPerMinute);
      }

      res.json(maskProvider(config));
    } catch (err) {
      log.error({ error: err }, 'Failed to update models');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  return router;
}
