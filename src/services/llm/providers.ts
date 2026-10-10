import { LLMProvider } from '@/types/llm';

export const LLM_PROVIDERS: LLMProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT models from OpenAI',
    requiresApiKey: true,
    features: ['text-generation', 'vision', 'function-calling', 'streaming'],
    models: [
      {
        id: 'gpt-4.1-2025-04-14',
        name: 'GPT-4.1 Turbo',
        description: 'Latest flagship model with superior performance',
        maxTokens: 128000,
        inputCostPer1M: 10,
        outputCostPer1M: 30,
        features: ['text-generation', 'vision', 'function-calling', 'streaming']
      },
      {
        id: 'gpt-4.1-mini-2025-04-14',
        name: 'GPT-4.1 Mini',
        description: 'Faster, more affordable model',
        maxTokens: 128000,
        inputCostPer1M: 0.15,
        outputCostPer1M: 0.6,
        features: ['text-generation', 'vision', 'function-calling', 'streaming']
      },
      {
        id: 'o3-2025-04-16',
        name: 'O3',
        description: 'Powerful reasoning model for complex analysis',
        maxTokens: 200000,
        inputCostPer1M: 60,
        outputCostPer1M: 240,
        features: ['text-generation', 'reasoning', 'multimodal']
      },
      {
        id: 'o4-mini-2025-04-16',
        name: 'O4 Mini',
        description: 'Fast reasoning model optimized for coding',
        maxTokens: 128000,
        inputCostPer1M: 3,
        outputCostPer1M: 12,
        features: ['text-generation', 'reasoning', 'function-calling']
      }
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude models from Anthropic',
    requiresApiKey: true,
    features: ['text-generation', 'vision', 'function-calling', 'streaming', 'reasoning'],
    models: [
      {
        id: 'claude-opus-4-20250514',
        name: 'Claude Opus 4',
        description: 'Most capable and intelligent model with superior reasoning',
        maxTokens: 200000,
        inputCostPer1M: 15,
        outputCostPer1M: 75,
        features: ['text-generation', 'vision', 'function-calling', 'reasoning', 'multimodal']
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        description: 'High-performance model with exceptional reasoning and efficiency',
        maxTokens: 200000,
        inputCostPer1M: 3,
        outputCostPer1M: 15,
        features: ['text-generation', 'vision', 'function-calling', 'reasoning', 'multimodal']
      },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fastest model for quick responses',
        maxTokens: 200000,
        inputCostPer1M: 0.8,
        outputCostPer1M: 4,
        features: ['text-generation', 'streaming', 'function-calling']
      }
    ]
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Gemini models from Google',
    requiresApiKey: true,
    features: ['text-generation', 'vision', 'function-calling', 'streaming', 'multimodal'],
    models: [
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Advanced reasoning and multimodal capabilities',
        maxTokens: 2000000,
        inputCostPer1M: 1.25,
        outputCostPer1M: 5,
        features: ['text-generation', 'vision', 'function-calling', 'multimodal']
      },
      {
        id: 'gemini-1.5-flash',
        name: 'Gemini 1.5 Flash',
        description: 'Fast and efficient model for various tasks',
        maxTokens: 1000000,
        inputCostPer1M: 0.075,
        outputCostPer1M: 0.3,
        features: ['text-generation', 'vision', 'function-calling', 'streaming']
      },
      {
        id: 'gemini-2.0-flash-exp',
        name: 'Gemini 2.0 Flash (Experimental)',
        description: 'Latest experimental model with enhanced capabilities',
        maxTokens: 1000000,
        features: ['text-generation', 'vision', 'function-calling', 'multimodal']
      }
    ]
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    description: 'Open-source models via Transformers.js',
    requiresApiKey: false,
    features: ['text-generation', 'embeddings', 'vision'],
    models: [
      {
        id: 'microsoft/DialoGPT-medium',
        name: 'DialoGPT Medium',
        description: 'Conversational AI model',
        maxTokens: 1024,
        features: ['text-generation']
      },
      {
        id: 'mixedbread-ai/mxbai-embed-xsmall-v1',
        name: 'MXBai Embed XSmall',
        description: 'Compact embedding model',
        maxTokens: 512,
        features: ['embeddings']
      },
      {
        id: 'onnx-community/whisper-tiny.en',
        name: 'Whisper Tiny',
        description: 'Speech recognition model',
        maxTokens: 448,
        features: ['multimodal']
      }
    ]
  }
];