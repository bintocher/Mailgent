import type { LLMProviderConfig } from '@mailgent/shared';
import type { LLMProvider } from './llm-provider';
import { OpenAIProvider } from './openai-provider';
import { ClaudeProvider } from './claude-provider';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('llm-factory');

export class LLMFactory {
  private providers = new Map<string, LLMProvider>();

  createProvider(config: LLMProviderConfig): LLMProvider {
    if (this.providers.has(config.id)) {
      return this.providers.get(config.id)!;
    }

    let provider: LLMProvider;

    switch (config.type) {
      case 'openai':
      case 'openai-compatible':
      case 'z.ai':
        provider = new OpenAIProvider(config.id, config.apiKey, config.baseUrl || undefined);
        break;
      case 'anthropic':
        provider = new ClaudeProvider(config.id, config.apiKey);
        break;
      default:
        throw new Error(`Unknown provider type: ${config.type}`);
    }

    this.providers.set(config.id, provider);
    log.info({ id: config.id, type: config.type, name: config.name }, 'LLM provider created');
    return provider;
  }

  getProvider(providerId: string): LLMProvider | undefined {
    return this.providers.get(providerId);
  }

  removeProvider(providerId: string): void {
    this.providers.delete(providerId);
  }

  getAllProviders(): Map<string, LLMProvider> {
    return this.providers;
  }

  initializeFromConfigs(configs: LLMProviderConfig[]): void {
    for (const config of configs) {
      if (config.isEnabled) {
        try {
          this.createProvider(config);
        } catch (err) {
          log.error({ id: config.id, error: err }, 'Failed to create provider');
        }
      }
    }
  }
}
