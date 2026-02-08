import type { ToolDefinition, ToolCallRequest, ToolCallResult } from '@mailgent/shared';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('tool-registry');

export type ToolHandler = (params: Record<string, unknown>, agentId: string) => Promise<unknown>;

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private handlers = new Map<string, ToolHandler>();

  register(tool: ToolDefinition, handler: ToolHandler): void {
    this.tools.set(tool.name, tool);
    this.handlers.set(tool.name, handler);
    log.debug({ name: tool.name, category: tool.category }, 'Tool registered');
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  getHandler(name: string): ToolHandler | undefined {
    return this.handlers.get(name);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  getByCategory(category: string): ToolDefinition[] {
    return this.getAll().filter(t => t.category === category);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  updateEnabled(name: string, isEnabled: boolean): void {
    const tool = this.tools.get(name);
    if (tool) {
      tool.isEnabled = isEnabled;
    }
  }

  unregister(name: string): void {
    this.tools.delete(name);
    this.handlers.delete(name);
  }

  toLLMTools(): Array<{ type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }> {
    return this.getAll()
      .filter(t => t.isEnabled)
      .map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: 'object',
            properties: Object.fromEntries(
              t.parameters.map(p => [p.name, {
                type: p.type,
                description: p.description,
                ...(p.enum ? { enum: p.enum } : {}),
                ...(p.default !== undefined ? { default: p.default } : {}),
              }])
            ),
            required: t.parameters.filter(p => p.required).map(p => p.name),
          },
        },
      }));
  }
}
