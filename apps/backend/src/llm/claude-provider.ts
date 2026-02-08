import Anthropic from '@anthropic-ai/sdk';
import type { LLMCompletionRequest, LLMCompletionResponse, LLMToolCall } from '@mailgent/shared';
import type { LLMProvider } from './llm-provider';
import { createChildLogger } from '../utils/logger';

const log = createChildLogger('claude-provider');

export class ClaudeProvider implements LLMProvider {
  readonly providerId: string;
  readonly providerType = 'anthropic';
  private client: Anthropic;

  constructor(providerId: string, apiKey: string) {
    this.providerId = providerId;
    this.client = new Anthropic({ apiKey });
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const start = Date.now();
    const systemMsg = request.messages.find(m => m.role === 'system');
    const messages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => this.toClaudeMessage(m));

    const tools = request.tools?.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters as Anthropic.Tool['input_schema'],
    }));

    const response = await this.client.messages.create({
      model: request.modelId,
      max_tokens: request.maxTokens || 4096,
      system: systemMsg?.content,
      messages,
      temperature: request.temperature ?? 0.7,
      tools: tools?.length ? tools : undefined,
    });

    let content = '';
    const toolCalls: LLMToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input),
        });
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      modelId: request.modelId,
      providerId: this.providerId,
      durationMs: Date.now() - start,
      finishReason: response.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
    };
  }

  async completeStream(
    request: LLMCompletionRequest,
    onChunk: (chunk: string) => void,
  ): Promise<LLMCompletionResponse> {
    const start = Date.now();
    const systemMsg = request.messages.find(m => m.role === 'system');
    const messages = request.messages
      .filter(m => m.role !== 'system')
      .map(m => this.toClaudeMessage(m));

    const tools = request.tools?.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters as Anthropic.Tool['input_schema'],
    }));

    let content = '';
    const toolCalls: LLMToolCall[] = [];
    let inputTokens = 0;
    let outputTokens = 0;
    let currentToolId = '';
    let currentToolName = '';
    let currentToolArgs = '';
    let finishReason: 'stop' | 'tool_calls' = 'stop';

    const stream = this.client.messages.stream({
      model: request.modelId,
      max_tokens: request.maxTokens || 4096,
      system: systemMsg?.content,
      messages,
      temperature: request.temperature ?? 0.7,
      tools: tools?.length ? tools : undefined,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolId = event.content_block.id;
          currentToolName = event.content_block.name;
          currentToolArgs = '';
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          content += event.delta.text;
          onChunk(event.delta.text);
        } else if (event.delta.type === 'input_json_delta') {
          currentToolArgs += event.delta.partial_json;
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolId) {
          toolCalls.push({
            id: currentToolId,
            name: currentToolName,
            arguments: currentToolArgs,
          });
          currentToolId = '';
        }
      } else if (event.type === 'message_delta') {
        if (event.usage) {
          outputTokens = event.usage.output_tokens;
        }
        if (event.delta?.stop_reason === 'tool_use') {
          finishReason = 'tool_calls';
        }
      } else if (event.type === 'message_start') {
        inputTokens = event.message.usage.input_tokens;
      }
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      modelId: request.modelId,
      providerId: this.providerId,
      durationMs: Date.now() - start,
      finishReason,
    };
  }

  async listModels(): Promise<string[]> {
    return [
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-haiku-4-20250514',
    ];
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: 'claude-haiku-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  private toClaudeMessage(msg: { role: string; content: string; toolCallId?: string; toolCalls?: LLMToolCall[] }): Anthropic.MessageParam {
    if (msg.role === 'tool' && msg.toolCallId) {
      return {
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: msg.toolCallId,
          content: msg.content,
        }],
      };
    }
    if (msg.role === 'assistant' && msg.toolCalls?.length) {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (msg.content) {
        blocks.push({ type: 'text', text: msg.content });
      }
      for (const tc of msg.toolCalls) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: JSON.parse(tc.arguments),
        });
      }
      return { role: 'assistant', content: blocks };
    }
    return { role: msg.role as 'user' | 'assistant', content: msg.content };
  }
}
