import type { LLMCompletionRequest, LLMCompletionResponse } from '@mailgent/shared';

export interface LLMProvider {
  readonly providerId: string;
  readonly providerType: string;

  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;

  completeStream(
    request: LLMCompletionRequest,
    onChunk: (chunk: string) => void,
  ): Promise<LLMCompletionResponse>;

  listModels(): Promise<string[]>;

  isAvailable(): Promise<boolean>;
}
