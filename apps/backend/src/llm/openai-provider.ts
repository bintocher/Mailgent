import OpenAI from 'openai';
import type { LLMCompletionRequest, LLMCompletionResponse, LLMToolCall } from '@mailgent/shared';
import type { LLMProvider } from './llm-provider';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('openai-provider');

export class OpenAIProvider implements LLMProvider {
  readonly providerId: string;
  readonly providerType = 'openai';
  private client: OpenAI;

  constructor(providerId: string, apiKey: string, baseUrl?: string) {
    this.providerId = providerId;
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const start = Date.now();

    const tools = request.tools?.map(t => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));

    const response = await this.client.chat.completions.create({
      model: request.modelId,
      messages: request.messages.map(m => this.toOpenAIMessage(m)),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      tools: tools?.length ? tools : undefined,
    });

    const choice = response.choices[0];
    const toolCalls = choice.message.tool_calls?.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    })) as LLMToolCall[] | undefined;

    return {
      content: choice.message.content || '',
      toolCalls,
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      modelId: request.modelId,
      providerId: this.providerId,
      durationMs: Date.now() - start,
      finishReason: this.mapFinishReason(choice.finish_reason),
    };
  }

  async completeStream(
    request: LLMCompletionRequest,
    onChunk: (chunk: string) => void,
  ): Promise<LLMCompletionResponse> {
    const start = Date.now();
    let content = '';
    let promptTokens = 0;
    let completionTokens = 0;

    const tools = request.tools?.map(t => ({
      type: 'function' as const,
      function: {
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      },
    }));

    const stream = await this.client.chat.completions.create({
      model: request.modelId,
      messages: request.messages.map(m => this.toOpenAIMessage(m)),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      tools: tools?.length ? tools : undefined,
      stream: true,
      stream_options: { include_usage: true },
    });

    const toolCallAccumulator: Map<number, { id: string; name: string; arguments: string }> = new Map();
    let finishReason: string = 'stop';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        onChunk(delta.content);
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCallAccumulator.has(tc.index)) {
            toolCallAccumulator.set(tc.index, { id: tc.id || '', name: tc.function?.name || '', arguments: '' });
          }
          const acc = toolCallAccumulator.get(tc.index)!;
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) acc.arguments += tc.function.arguments;
        }
      }

      if (chunk.choices[0]?.finish_reason) {
        finishReason = chunk.choices[0].finish_reason;
      }

      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens;
        completionTokens = chunk.usage.completion_tokens;
      }
    }

    const toolCalls = toolCallAccumulator.size > 0
      ? Array.from(toolCallAccumulator.values())
      : undefined;

    return {
      content,
      toolCalls,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      modelId: request.modelId,
      providerId: this.providerId,
      durationMs: Date.now() - start,
      finishReason: this.mapFinishReason(finishReason),
    };
  }

  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list();
      return models.data.map(m => m.id);
    } catch (err) {
      log.warn({ error: err }, 'Failed to list models');
      return [];
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  private toOpenAIMessage(msg: { role: string; content: string; toolCallId?: string; toolCalls?: LLMToolCall[] }) {
    if (msg.role === 'tool' && msg.toolCallId) {
      return { role: 'tool' as const, content: msg.content, tool_call_id: msg.toolCallId };
    }
    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      return {
        role: 'assistant' as const,
        content: msg.content || null,
        tool_calls: msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
    }
    return { role: msg.role as 'system' | 'user' | 'assistant', content: msg.content };
  }

  private mapFinishReason(reason: string | null): 'stop' | 'tool_calls' | 'length' | 'error' {
    switch (reason) {
      case 'stop': return 'stop';
      case 'tool_calls': return 'tool_calls';
      case 'length': return 'length';
      default: return 'stop';
    }
  }
}
