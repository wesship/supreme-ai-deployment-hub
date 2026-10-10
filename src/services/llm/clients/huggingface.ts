import { LLMConfig, LLMMessage, LLMResponse, StreamingLLMResponse } from '@/types/llm';
import { LLMClient } from '../client';
import { pipeline } from '@huggingface/transformers';

export class HuggingFaceClient implements LLMClient {
  private pipelines: Map<string, any> = new Map();

  async generateResponse(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const pipe = await this.getPipeline(config.model);
    const prompt = this.formatMessages(messages);
    
    const result = await pipe(prompt, {
      max_new_tokens: config.maxTokens || 256,
      temperature: config.temperature || 0.7,
    });
    
    return {
      content: result[0]?.generated_text || '',
      usage: {
        promptTokens: 0, // Not available in transformers.js
        completionTokens: 0,
        totalTokens: 0,
      },
    };
  }

  async streamResponse(
    messages: LLMMessage[], 
    config: LLMConfig, 
    onChunk: (chunk: StreamingLLMResponse) => void
  ): Promise<void> {
    // For now, simulate streaming by breaking response into chunks
    const response = await this.generateResponse(messages, config);
    const words = response.content.split(' ');
    let currentContent = '';
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');
      currentContent += word;
      
      onChunk({
        content: currentContent,
        delta: word,
        done: false,
      });
      
      // Simulate streaming delay
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    onChunk({
      content: currentContent,
      delta: '',
      done: true,
    });
  }

  async generateEmbeddings(texts: string[], config: LLMConfig): Promise<number[][]> {
    const pipe = await this.getPipeline(config.model, 'feature-extraction');
    const result = await pipe(texts, { pooling: 'mean', normalize: true });
    return result.tolist();
  }

  private async getPipeline(modelId: string, task: any = 'text-generation') {
    const key = `${task}:${modelId}`;
    
    if (!this.pipelines.has(key)) {
      try {
        const pipe = await pipeline(task as any, modelId, { 
          device: 'webgpu',
          dtype: 'fp16',
        });
        this.pipelines.set(key, pipe);
      } catch (error) {
        // Fallback to CPU if WebGPU fails
        const pipe = await pipeline(task as any, modelId);
        this.pipelines.set(key, pipe);
      }
    }
    
    return this.pipelines.get(key);
  }

  private formatMessages(messages: LLMMessage[]): string {
    return messages
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n') + '\nassistant:';
  }
}