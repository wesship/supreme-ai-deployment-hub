import { LLMConfig, LLMMessage, LLMResponse, StreamingLLMResponse } from '@/types/llm';
import { LLMClient } from '../client';

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
}

const DEFAULT_RETRY: Required<RetryOptions> = {
  maxAttempts: 4,
  initialDelayMs: 500,
  maxDelayMs: 8000,
  backoffFactor: 2,
};

/**
 * Custom error type that preserves status codes and surface-level context
 * so callers can distinguish network vs API vs format errors.
 */
export class OpenAIClientError extends Error {
  constructor(
    message: string,
    public readonly kind: 'network' | 'http' | 'format' | 'aborted',
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'OpenAIClientError';
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Decide whether an error/HTTP status is worth retrying.
 * - Network failures: always retry
 * - 408/425/429: retry (rate limit / timeout)
 * - 5xx: retry
 * - 4xx (other): do not retry — request is malformed/auth issue
 */
const isRetryableStatus = (status: number): boolean => {
  if (status === 408 || status === 425 || status === 429) return true;
  return status >= 500 && status < 600;
};

const computeBackoff = (attempt: number, opts: Required<RetryOptions>): number => {
  const base = Math.min(opts.initialDelayMs * Math.pow(opts.backoffFactor, attempt), opts.maxDelayMs);
  // 20% jitter to avoid thundering herd
  return Math.round(base * (0.8 + Math.random() * 0.4));
};

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retry: RetryOptions = {},
): Promise<Response> {
  const opts = { ...DEFAULT_RETRY, ...retry };
  let lastError: unknown;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    const attemptLabel = `[OpenAI] attempt ${attempt + 1}/${opts.maxAttempts}`;
    try {
      const response = await fetch(url, init);

      if (response.ok) {
        if (attempt > 0) {
          console.info(`${attemptLabel} succeeded after ${attempt} retr${attempt === 1 ? 'y' : 'ies'}`);
        }
        return response;
      }

      // Try to read the error body for clearer logging — but don't fail if it's empty
      let bodyText = '';
      try {
        bodyText = await response.text();
      } catch {
        bodyText = '<unreadable response body>';
      }

      const retryable = isRetryableStatus(response.status);
      const retryAfterHeader = response.headers.get('retry-after');
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;

      console.warn(
        `${attemptLabel} HTTP ${response.status} ${response.statusText} — ${
          retryable ? 'will retry' : 'not retryable'
        }. Body: ${bodyText.slice(0, 500)}`,
      );

      if (!retryable || attempt === opts.maxAttempts - 1) {
        throw new OpenAIClientError(
          `OpenAI API error ${response.status} ${response.statusText}: ${bodyText.slice(0, 300)}`,
          'http',
          response.status,
          bodyText,
        );
      }

      const delay = retryAfterMs && Number.isFinite(retryAfterMs)
        ? retryAfterMs
        : computeBackoff(attempt, opts);
      console.info(`${attemptLabel} backing off for ${delay}ms`);
      await sleep(delay);
    } catch (err) {
      lastError = err;

      // OpenAIClientError thrown above for non-retryable HTTP — propagate immediately
      if (err instanceof OpenAIClientError && err.kind === 'http' && !isRetryableStatus(err.status ?? 0)) {
        throw err;
      }

      // AbortError: do not retry
      if (err instanceof Error && err.name === 'AbortError') {
        throw new OpenAIClientError('OpenAI request aborted', 'aborted', undefined, err.message);
      }

      const isNetwork = err instanceof TypeError || (err instanceof Error && /fetch|network/i.test(err.message));
      console.warn(
        `${attemptLabel} ${isNetwork ? 'network error' : 'request error'}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );

      if (attempt === opts.maxAttempts - 1) {
        if (err instanceof OpenAIClientError) throw err;
        throw new OpenAIClientError(
          `OpenAI request failed after ${opts.maxAttempts} attempts: ${
            err instanceof Error ? err.message : String(err)
          }`,
          isNetwork ? 'network' : 'http',
          undefined,
          err,
        );
      }

      const delay = computeBackoff(attempt, opts);
      console.info(`${attemptLabel} backing off for ${delay}ms`);
      await sleep(delay);
    }
  }

  // Defensive — loop should always either return or throw
  throw lastError instanceof Error
    ? lastError
    : new OpenAIClientError('OpenAI request failed for unknown reasons', 'network');
}

/**
 * Safely parse JSON from a Response, throwing a typed format error on failure.
 */
async function safeParseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('[OpenAI] failed to parse JSON response', {
      preview: text.slice(0, 300),
      error: err instanceof Error ? err.message : String(err),
    });
    throw new OpenAIClientError(
      'OpenAI returned a non-JSON response',
      'format',
      response.status,
      text.slice(0, 500),
    );
  }
}

/**
 * Validate the shape we expect from a chat completion (non-streaming).
 */
function validateChatCompletion(data: unknown): asserts data is {
  choices: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
} {
  if (!data || typeof data !== 'object') {
    throw new OpenAIClientError('OpenAI response is not an object', 'format', undefined, data);
  }
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new OpenAIClientError(
      'OpenAI response missing "choices" array',
      'format',
      undefined,
      data,
    );
  }
}

export class OpenAIClient implements LLMClient {
  async generateResponse(messages: LLMMessage[], config: LLMConfig): Promise<LLMResponse> {
    const response = await fetchWithRetry(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: this.formatMessages(messages),
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
      }),
    });

    const data = await safeParseJson(response);
    validateChatCompletion(data);

    const firstChoice = data.choices[0];
    if (!firstChoice) {
      throw new OpenAIClientError('OpenAI response had empty choices', 'format', undefined, data);
    }

    const content = firstChoice.message?.content;
    if (typeof content !== 'string') {
      console.warn('[OpenAI] choice.message.content was not a string — defaulting to empty', {
        finish_reason: firstChoice.finish_reason,
      });
    }

    return {
      content: typeof content === 'string' ? content : '',
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
      },
      finishReason: firstChoice.finish_reason,
    };
  }

  async streamResponse(
    messages: LLMMessage[],
    config: LLMConfig,
    onChunk: (chunk: StreamingLLMResponse) => void,
  ): Promise<void> {
    // Note: only the initial connection is retried. Once the stream is open,
    // partial-stream failures are surfaced to the caller — retrying mid-stream
    // would replay tokens to the consumer.
    const response = await fetchWithRetry(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages: this.formatMessages(messages),
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 4096,
        stream: true,
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) {
      throw new OpenAIClientError('OpenAI streaming response had no body', 'format', response.status);
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';
    let malformedLineCount = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines; keep partial line in buffer
        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line || line.startsWith(':')) continue; // SSE comment / keepalive
          if (!line.startsWith('data: ')) continue;

          const payload = line.slice(6).trim();
          if (payload === '[DONE]') {
            onChunk({ content: fullContent, delta: '', done: true });
            return;
          }

          try {
            const parsed = JSON.parse(payload);
            const choice = parsed?.choices?.[0];
            if (!choice) {
              malformedLineCount++;
              console.warn('[OpenAI] streaming chunk missing "choices[0]"', {
                preview: payload.slice(0, 200),
              });
              continue;
            }
            const delta: string = choice.delta?.content ?? '';
            if (delta) {
              fullContent += delta;
              onChunk({ content: fullContent, delta, done: false });
            }
          } catch (err) {
            malformedLineCount++;
            // A partial JSON chunk may be split across reads; put it back to retry assembly
            buffer = `data: ${payload}\n${buffer}`;
            if (malformedLineCount > 50) {
              throw new OpenAIClientError(
                'Too many malformed streaming chunks from OpenAI',
                'format',
                response.status,
                err instanceof Error ? err.message : String(err),
              );
            }
            break;
          }
        }
      }

      // Stream ended without an explicit [DONE] — emit a final done event so callers can finalize
      console.info('[OpenAI] stream ended without [DONE] sentinel — finalizing');
      onChunk({ content: fullContent, delta: '', done: true });
    } catch (err) {
      if (err instanceof OpenAIClientError) throw err;
      throw new OpenAIClientError(
        `OpenAI stream failed: ${err instanceof Error ? err.message : String(err)}`,
        'network',
        undefined,
        err,
      );
    } finally {
      try {
        reader.releaseLock();
      } catch {
        /* noop */
      }
    }
  }

  private formatMessages(messages: LLMMessage[]) {
    return messages.map((msg) => ({
      role: msg.role,
      content:
        msg.images && msg.images.length > 0
          ? [
              { type: 'text', text: msg.content },
              ...msg.images.map((img) => ({
                type: 'image_url',
                image_url: { url: img },
              })),
            ]
          : msg.content,
    }));
  }
}
