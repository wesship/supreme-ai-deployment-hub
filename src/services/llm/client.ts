import { LLMConfig, LLMMessage, LLMResponse, StreamingLLMResponse } from '@/types/llm';
import { OpenAIClient } from './clients/openai';
import { AnthropicClient } from './clients/anthropic';
import { GoogleClient } from './clients/google';

export interface LLMClient {
  generateResponse(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse>;
  streamResponse(
    messages: LLMMessage[],
    config: LLMConfig,
    onChunk: (chunk: StreamingLLMResponse) => void
  ): Promise<void>;
  generateEmbeddings?(texts: string[], config: LLMConfig): Promise<number[][]>;
}

export class UnifiedLLMClient {
  private clients: Map<string, LLMClient> = new Map();

  constructor() {
    this.clients.set('openai', new OpenAIClient());
    this.clients.set('anthropic', new AnthropicClient());
    this.clients.set('google', new GoogleClient());
  }

  async generateResponse(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const client = await this.getClient(config.provider);
    return client.generateResponse(messages, config);
  }

  async streamResponse(
    messages: LLMMessage[],
    config: LLMConfig,
    onChunk: (chunk: StreamingLLMResponse) => void
  ): Promise<void> {
    const client = await this.getClient(config.provider);
    return client.streamResponse(messages, config, onChunk);
  }

  async generateEmbeddings(texts: string[], config: LLMConfig): Promise<number[][]> {
    const client = await this.getClient(config.provider);
    if (!client.generateEmbeddings) {
      throw new Error(`Provider ${config.provider} does not support embeddings`);
    }

    return client.generateEmbeddings(texts, config);
  }

  private async getClient(provider: string): Promise<LLMClient> {
    const client = this.clients.get(provider);
    if (client) return client;

    if (provider === 'huggingface') {
      const module = await import('./clients/huggingface');
      const lazyClient = new module.HuggingFaceClient();
      this.clients.set(provider, lazyClient);
      return lazyClient;
    }

    throw new Error(`Unsupported LLM provider: ${provider}`);
  }
}
