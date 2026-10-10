import { LLMConfig, LLMMessage, LLMResponse, StreamingLLMResponse } from '@/types/llm';
import { LLMClient } from '../client';

export class AnthropicClient implements LLMClient {
  async generateResponse(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const { systemMessage, userMessages } = this.formatMessages(messages);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey!,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        messages: userMessages,
        system: systemMessage,
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.content[0]?.text || '',
      usage: {
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      finishReason: data.stop_reason,
    };
  }

  async streamResponse(
    messages: LLMMessage[], 
    config: LLMConfig, 
    onChunk: (chunk: StreamingLLMResponse) => void
  ): Promise<void> {
    const { systemMessage, userMessages } = this.formatMessages(messages);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey!,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        messages: userMessages,
        system: systemMessage,
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          try {
            const parsed = JSON.parse(data);
            
            if (parsed.type === 'content_block_delta') {
              const delta = parsed.delta?.text || '';
              fullContent += delta;

              onChunk({
                content: fullContent,
                delta,
                done: false,
              });
            } else if (parsed.type === 'message_stop') {
              onChunk({
                content: fullContent,
                delta: '',
                done: true,
                usage: parsed.usage ? {
                  promptTokens: parsed.usage.input_tokens || 0,
                  completionTokens: parsed.usage.output_tokens || 0,
                  totalTokens: (parsed.usage.input_tokens || 0) + (parsed.usage.output_tokens || 0),
                } : undefined,
              });
              return;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  private formatMessages(messages: LLMMessage[]) {
    const systemMessage = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages
      .filter(m => m.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.images && msg.images.length > 0 
          ? [
              { type: 'text', text: msg.content },
              ...msg.images.map(img => ({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: img.split(',')[1] || img,
                }
              }))
            ]
          : msg.content
      }));

    return { systemMessage, userMessages };
  }
}