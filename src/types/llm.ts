export interface LLMProvider {
  id: string;
  name: string;
  description: string;
  models: LLMModel[];
  requiresApiKey: boolean;
  features: LLMFeature[];
}

export interface LLMModel {
  id: string;
  name: string;
  description: string;
  maxTokens: number;
  inputCostPer1M?: number;
  outputCostPer1M?: number;
  features: LLMFeature[];
}

export type LLMFeature = 
  | 'text-generation'
  | 'vision'
  | 'function-calling'
  | 'streaming'
  | 'embeddings'
  | 'reasoning'
  | 'multimodal';

export interface LLMConfig {
  provider: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  images?: string[];
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface StreamingLLMResponse {
  content: string;
  delta: string;
  done: boolean;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}