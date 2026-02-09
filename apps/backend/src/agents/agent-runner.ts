import { v4 as uuid } from 'uuid';
import type { Agent, AgentLog, LLMChatMessage, LLMToolCall, Email } from '@mailgent/shared';
import { LIMITS } from '@mailgent/shared';
import type { LLMRouter } from '../llm/llm-router';
import type { TokenTracker } from '../llm/token-tracker';
import type { ToolExecutor } from '../tools/tool-executor';
import type { ToolRegistry } from '../tools/tool-registry';
import type { AgentRegistry } from './agent-registry';
import type { EventBus } from '../utils/event-bus';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('agent-runner');

export class AgentRunner {
  constructor(
    private llmRouter: LLMRouter,
    private tokenTracker: TokenTracker,
    private toolExecutor: ToolExecutor,
    private toolRegistry: ToolRegistry,
    private agentRegistry: AgentRegistry,
    private eventBus: EventBus,
  ) {}

  async run(agent: Agent, email: Email, allowedToolCategories?: string[]): Promise<string> {
    const activeAgent = this.agentRegistry.get(agent.id);
    if (!activeAgent) throw new Error(`Agent ${agent.id} not registered`);

    this.agentRegistry.updateStatus(agent.id, 'thinking');
    this.emitLog(agent.id, 'email_received', `Received: ${email.subject} from ${email.from}`);
    log.info({ agentId: agent.id, agentName: agent.name, subject: email.subject, from: email.from }, 'Agent run started');

    const messages: LLMChatMessage[] = [
      { role: 'system', content: agent.systemPrompt },
      { role: 'user', content: this.formatEmailAsPrompt(email) },
    ];

    let tools = this.toolRegistry.toLLMTools();
    if (allowedToolCategories) {
      const allowedNames = new Set(
        this.toolRegistry.getAll()
          .filter(t => t.isEnabled && allowedToolCategories.includes(t.category))
          .map(t => t.name)
      );
      tools = tools.filter(t => allowedNames.has(t.function.name));
    }
    let iterations = 0;
    let finalResponse = '';

    while (iterations < LIMITS.MAX_AGENT_THINK_ITERATIONS) {
      if (activeAgent.abortController.signal.aborted) {
        this.agentRegistry.updateStatus(agent.id, 'stopped');
        return 'Agent stopped by user';
      }

      iterations++;
      this.agentRegistry.updateStatus(agent.id, 'thinking');
      this.emitLog(agent.id, 'think', `Iteration ${iterations}`);
      log.info({ agentId: agent.id, agentName: agent.name, iteration: iterations }, 'Agent iteration');

      try {
        const response = await this.llmRouter.route(
          {
            messages,
            modelId: agent.modelId || '',
            providerId: agent.providerId || '',
            tools: tools.length > 0 ? tools : undefined,
          },
          'agent-task',
        );

        this.tokenTracker.track(
          response,
          agent.id,
          agent.name,
          'agent-task',
          agent.groupId,
        );

        if (response.toolCalls && response.toolCalls.length > 0) {
          // Add assistant message with tool calls
          messages.push({
            role: 'assistant',
            content: response.content,
            toolCalls: response.toolCalls,
          });

          this.agentRegistry.updateStatus(agent.id, 'acting');

          // Execute each tool call
          for (const toolCall of response.toolCalls) {
            this.emitLog(agent.id, 'tool_call', `Calling ${toolCall.name}`);
            log.info({ agentId: agent.id, agentName: agent.name, tool: toolCall.name }, 'Agent tool call');

            let params: Record<string, unknown>;
            try {
              params = JSON.parse(toolCall.arguments);
            } catch {
              params = {};
            }

            const result = await this.toolExecutor.execute({
              toolId: toolCall.id,
              toolName: toolCall.name,
              parameters: params,
              agentId: agent.id,
              requestId: uuid(),
            });

            this.emitLog(agent.id, 'tool_result',
              result.success
                ? `${toolCall.name}: success`
                : `${toolCall.name}: error - ${result.error}`
            );

            messages.push({
              role: 'tool',
              content: result.success
                ? JSON.stringify(result.result)
                : `Error: ${result.error}`,
              toolCallId: toolCall.id,
            });
          }

          continue;
        }

        // No tool calls — final response
        finalResponse = response.content;
        this.emitLog(agent.id, 'think', `Completed after ${iterations} iterations`);
        log.info({ agentId: agent.id, agentName: agent.name, iterations }, 'Agent run completed');
        break;
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        log.error({ agentId: agent.id, error, iteration: iterations }, 'Agent iteration failed');
        this.emitLog(agent.id, 'error', error);

        if (iterations >= LIMITS.MAX_AGENT_THINK_ITERATIONS) {
          finalResponse = `Error: Agent exceeded max iterations. Last error: ${error}`;
          break;
        }

        messages.push({
          role: 'assistant',
          content: `I encountered an error: ${error}. Let me try a different approach.`,
        });
      }
    }

    this.agentRegistry.updateStatus(agent.id, 'idle');
    return finalResponse;
  }

  async runAgenticChat(
    agent: Agent,
    messages: LLMChatMessage[],
    callbacks: {
      onChunk: (chunk: string) => void;
      onThinking: (content: string, iteration: number) => void;
      onToolCall: (toolName: string, args: Record<string, unknown>, toolCallId: string, iteration: number) => void;
      onToolResult: (toolName: string, toolCallId: string, success: boolean, result: string, durationMs: number, iteration: number) => void;
    },
    allowedToolCategories?: string[],
  ): Promise<string> {
    let tools = this.toolRegistry.toLLMTools();
    if (allowedToolCategories) {
      const allowedNames = new Set(
        this.toolRegistry.getAll()
          .filter(t => t.isEnabled && allowedToolCategories.includes(t.category))
          .map(t => t.name)
      );
      tools = tools.filter(t => allowedNames.has(t.function.name));
    }
    let iterations = 0;

    while (iterations < LIMITS.MAX_AGENT_THINK_ITERATIONS) {
      iterations++;
      log.info({ agentId: agent.id, iteration: iterations }, 'Agentic chat iteration');

      try {
        const response = await this.llmRouter.route(
          {
            messages,
            modelId: agent.modelId || '',
            providerId: agent.providerId || '',
            tools: tools.length > 0 ? tools : undefined,
          },
          'chat',
        );

        this.tokenTracker.track(response, agent.id, agent.name, 'chat', agent.groupId);

        if (response.toolCalls && response.toolCalls.length > 0) {
          // Emit thinking if there's text alongside tool calls
          if (response.content) {
            callbacks.onThinking(response.content, iterations);
          }

          // Add assistant message with tool calls
          messages.push({
            role: 'assistant',
            content: response.content,
            toolCalls: response.toolCalls,
          });

          // Execute each tool call
          for (const toolCall of response.toolCalls) {
            let params: Record<string, unknown>;
            try {
              params = JSON.parse(toolCall.arguments);
            } catch {
              params = {};
            }

            callbacks.onToolCall(toolCall.name, params, toolCall.id, iterations);

            const result = await this.toolExecutor.execute({
              toolId: toolCall.id,
              toolName: toolCall.name,
              parameters: params,
              agentId: agent.id,
              requestId: uuid(),
            });

            const resultStr = result.success
              ? JSON.stringify(result.result)
              : `Error: ${result.error}`;

            callbacks.onToolResult(
              toolCall.name,
              toolCall.id,
              result.success,
              resultStr,
              result.durationMs,
              iterations,
            );

            messages.push({
              role: 'tool',
              content: resultStr,
              toolCallId: toolCall.id,
            });
          }

          continue;
        }

        // No tool calls — final response
        return response.content;
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        log.error({ agentId: agent.id, error, iteration: iterations }, 'Agentic chat iteration failed');

        if (iterations >= LIMITS.MAX_AGENT_THINK_ITERATIONS) {
          return `Error: Agent exceeded max iterations. Last error: ${error}`;
        }

        messages.push({
          role: 'assistant',
          content: `I encountered an error: ${error}. Let me try a different approach.`,
        });
      }
    }

    return 'Error: Agent exceeded maximum thinking iterations.';
  }

  async runStreaming(
    agent: Agent,
    messages: LLMChatMessage[],
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    const response = await this.llmRouter.routeStream(
      {
        messages,
        modelId: agent.modelId || '',
        providerId: agent.providerId || '',
        stream: true,
      },
      onChunk,
      'chat',
    );

    this.tokenTracker.track(response, agent.id, agent.name, 'chat', agent.groupId);
    return response.content;
  }

  private formatEmailAsPrompt(email: Email): string {
    return [
      `From: ${email.from}`,
      `To: ${email.to.join(', ')}`,
      `Subject: ${email.subject}`,
      '',
      email.body,
    ].join('\n');
  }

  private emitLog(agentId: string, type: AgentLog['type'], content: string): void {
    const agentLog: AgentLog = {
      id: uuid(),
      agentId,
      type,
      content,
      timestamp: new Date().toISOString(),
    };
    this.eventBus.emit('agent:log', { log: agentLog });
  }
}
