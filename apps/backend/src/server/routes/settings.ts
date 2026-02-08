import { Router } from 'express';
import type Database from 'better-sqlite3';
import { globalSettingsSchema, projectSettingsSchema } from '@mailgent/shared';
import type { SettingsRepository } from '../../db/repositories/settings.repo';
import type { EventBus } from '../../utils/event-bus';

interface SettingsRoutesDeps {
  globalSettingsRepo: SettingsRepository;
  projectSettingsRepo: SettingsRepository;
  globalDb: Database.Database;
  eventBus: EventBus;
}

/**
 * Mask an API key by keeping the first 6 and last 4 characters,
 * replacing the middle section with "****".
 */
function maskApiKey(key: string): string {
  if (key.length <= 10) {
    return '****';
  }
  return key.slice(0, 6) + '****' + key.slice(-4);
}

/**
 * Recursively walk through a settings object and mask any fields
 * that look like API keys (field name contains "apiKey" or "apikey").
 */
function maskSensitiveFields(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map(maskSensitiveFields);
  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      if (
        (key === 'apiKey' || key === 'apikey' || key === 'api_key') &&
        typeof value === 'string'
      ) {
        result[key] = maskApiKey(value);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = maskSensitiveFields(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
  return obj;
}

export function createSettingsRoutes(deps: SettingsRoutesDeps): Router {
  const router = Router();
  const { globalSettingsRepo, projectSettingsRepo, globalDb, eventBus } = deps;

  // GET /settings/global - Get all global settings (with masked API keys) + providers
  router.get('/global', (_req, res) => {
    try {
      const settings = globalSettingsRepo.getAll() as Record<string, unknown>;

      // Load providers from SQL tables
      const providerRows = globalDb.prepare('SELECT * FROM llm_providers').all() as any[];
      const providers = providerRows.map((row: any) => {
        const modelRows = globalDb.prepare('SELECT * FROM llm_models WHERE provider_id = ?').all(row.id) as any[];
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

      const result = { ...settings, providers };
      const masked = maskSensitiveFields(result);
      res.json(masked);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // PUT /settings/global - Update global settings
  router.put('/global', (req, res) => {
    try {
      const parsed = globalSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) {
          globalSettingsRepo.set(key, value);
        }
      }

      const settings = globalSettingsRepo.getAll();
      const masked = maskSensitiveFields(settings);
      res.json(masked);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // GET /settings/project - Get all project settings (with masked API keys)
  router.get('/project', (_req, res) => {
    try {
      const settings = projectSettingsRepo.getAll();
      const masked = maskSensitiveFields(settings);
      res.json(masked);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  // PUT /settings/project - Update project settings
  router.put('/project', (req, res) => {
    try {
      const parsed = projectSettingsSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: 'Validation failed', details: parsed.error.issues });
        return;
      }

      for (const [key, value] of Object.entries(parsed.data)) {
        if (value !== undefined) {
          projectSettingsRepo.set(key, value);
        }
      }

      // Notify system when default provider/model changes
      if (parsed.data.defaultProviderId || parsed.data.defaultModelId) {
        eventBus.emit('settings:defaults-changed', {
          defaultProviderId: parsed.data.defaultProviderId ?? projectSettingsRepo.get('defaultProviderId'),
          defaultModelId: parsed.data.defaultModelId ?? projectSettingsRepo.get('defaultModelId'),
        });
      }

      const settings = projectSettingsRepo.getAll();
      const masked = maskSensitiveFields(settings);
      res.json(masked);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  return router;
}
