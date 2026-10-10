import { LLMConfig, LLMMessage, LLMResponse, StreamingLLMResponse } from '@/types/llm';
import { LLMClient } from '../client';

export class GoogleClient implements LLMClient {
  async generateResponse(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: this.formatMessages(messages),
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxTokens || 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return {
      content: text,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
        totalTokens: data.usageMetadata?.totalTokenCount || 0,
      },
      finishReason: data.candidates?.[0]?.finishReason,
    };
  }

  async streamResponse(
    messages: LLMMessage[], 
    config: LLMConfig, 
    onChunk: (chunk: StreamingLLMResponse) => void
  ): Promise<void> {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:streamGenerateContent?key=${config.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: this.formatMessages(messages),
          generationConfig: {
            temperature: config.temperature || 0.7,
            maxOutputTokens: config.maxTokens || 4096,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        onChunk({
          content: fullContent,
          delta: '',
          done: true,
        });
        break;
      }

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          if (text) {
            fullContent += text;
            onChunk({
              content: fullContent,
              delta: text,
              done: false,
            });
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }

  private formatMessages(messages: LLMMessage[]) {
    return messages
      .filter(m => m.role !== 'system') // Google handles system prompts differently
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: msg.images && msg.images.length > 0 
          ? [
              { text: msg.content },
              ...msg.images.map(img => ({
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: img.split(',')[1] || img,
                }
              }))
            ]
          : [{ text: msg.content }]
      }));
  }
}