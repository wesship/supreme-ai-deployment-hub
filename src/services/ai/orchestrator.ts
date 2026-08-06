/**
 * Devonn.ai AI Orchestrator
 * All model calls are proxied through the Railway backend; no provider secret is
 * ever exposed to the browser.
 */
import { retrieveContext, isRAGAvailable } from './ragService';
import {
  ChatTimeoutError,
  createLinkedAbortController,
  readWithIdleTimeout,
} from './chatStreamGuard';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  delta: string;
  done: boolean;
  provider?: string;
  model?: string;
  error?: string;
}

export interface OrchestratorConfig {
  provider?: 'openai' | 'devonn' | 'gemini' | 'ollama';
  model?: string;
  /** @deprecated Provider keys must remain server-side. */
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  signal?: AbortSignal;
  useRAG?: boolean;
}

export const DEVONN_SYSTEM_PROMPT = `You are Devonn, the AI core of the D3VONN.IO Supreme AI Deployment Hub.

You understand the D3VONN.IO agent mesh, Hermes orchestration, Vercel frontend, Railway API, Supabase, RAG, CI/CD, deployments, monitoring, security, and business automation.

Be precise, direct, production-aware, and honest. Never claim an action completed unless a connected tool confirms it.`;

const API_BASE = (import.meta.env.VITE_API_URL || 'https://api.d3vonn.io')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');
const CHAT_PROXY_URL = `${API_BASE}/api/chat`;

function providerErrorMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const message = value.trim();
  return message.length > 0 ? message : null;
}

async function* streamProxy(
  messages: ChatMessage[],
  config: OrchestratorConfig
): AsyncGenerator<StreamChunk> {
  if (config.signal?.aborted) {
    yield { delta: '', done: true, error: 'Chat request was cancelled.' };
    return;
  }

  const model = config.model || 'gpt-4.1-mini';
  const provider = config.provider || 'openai';
  const linked = createLinkedAbortController(config.signal);

  let response: Response;
  try {
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

    response = await fetch(CHAT_PROXY_URL, {
      method: 'POST',
      signal: linked.controller.signal,
      headers,
      body: JSON.stringify({
        messages,
        model,
        provider,
        stream: true,
        max_tokens: config.maxTokens || 2048,
        temperature: config.temperature ?? 0.7,
      }),
    });
  } catch (error) {
    const message = error instanceof ChatTimeoutError
      ? error.message
      : linked.controller.signal.aborted && !config.signal?.aborted
        ? 'D3VONN chat connection timed out. Please try again.'
        : `Proxy connection failed: ${String(error)}`;
    yield { delta: '', done: true, error: message };
    linked.clear();
    return;
  }
  linked.clear();

  if (!response.ok) {
    const body = await response.text().catch(() => `HTTP ${response.status}`);
    yield { delta: '', done: true, error: `Proxy error ${response.status}: ${body}` };
    return;
  }
  if (!response.body) {
    yield { delta: '', done: true, error: 'Proxy response contained no stream body.' };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let emittedContent = false;

  try {
    while (true) {
      if (config.signal?.aborted) {
        yield { delta: '', done: true, error: 'Chat request was cancelled.' };
        return;
      }

      const { value, done } = await readWithIdleTimeout(reader);
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed === 'data: [DONE]') {
          if (!emittedContent) {
            yield { delta: '', done: true, error: 'D3VONN received an empty response from the AI provider. Please retry.' };
            return;
          }
          yield { delta: '', done: true, provider, model };
          return;
        }
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));

          // The Railway proxy includes `error` together with `delta` and `done`.
          // Error must be checked first or a provider 401/429 is mistaken for an
          // empty successful completion.
          const backendError = providerErrorMessage(json.error);
          if (backendError) {
            yield { delta: '', done: true, error: backendError };
            return;
          }

          if ('delta' in json) {
            if (json.done) {
              if (!emittedContent) {
                yield { delta: '', done: true, error: 'D3VONN received an empty response from the AI provider. Please retry.' };
                return;
              }
              yield {
                delta: '',
                done: true,
                provider: json.provider || provider,
                model: json.model || model,
              };
              return;
            }
            if (typeof json.delta === 'string' && json.delta.length > 0) {
              emittedContent = true;
              yield {
                delta: json.delta,
                done: false,
                provider: json.provider || provider,
                model: json.model || model,
              };
            }
            continue;
          }

          const passthroughError = providerErrorMessage(json?.error?.message);
          if (passthroughError) {
            yield { delta: '', done: true, error: passthroughError };
            return;
          }

          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            emittedContent = true;
            yield { delta, done: false, provider, model };
          }
        } catch {
          // Ignore an individual malformed event. The final empty-stream guard
          // prevents malformed streams from appearing successful.
        }
      }
    }
  } catch (error) {
    yield {
      delta: '',
      done: true,
      error: error instanceof ChatTimeoutError
        ? error.message
        : `D3VONN stream failed: ${String(error)}`,
    };
    return;
  } finally {
    reader.releaseLock();
  }

  if (!emittedContent) {
    yield { delta: '', done: true, error: 'D3VONN received no response data. Please retry.' };
    return;
  }
  yield { delta: '', done: true, provider, model };
}

export async function* streamChat(
  messages: ChatMessage[],
  config: OrchestratorConfig = {}
): AsyncGenerator<StreamChunk> {
  let ragContext = '';
  if (config.useRAG !== false && isRAGAvailable()) {
    const lastUser = [...messages].reverse().find(message => message.role === 'user');
    if (lastUser) ragContext = await retrieveContext(lastUser.content);
  }

  const systemContent = ragContext
    ? `${DEVONN_SYSTEM_PROMPT}\n\nRetrieved context:\n${ragContext}`
    : DEVONN_SYSTEM_PROMPT;
  const fullMessages: ChatMessage[] = messages[0]?.role === 'system'
    ? [{ role: 'system', content: systemContent }, ...messages.slice(1)]
    : [{ role: 'system', content: systemContent }, ...messages];

  try {
    yield* streamProxy(fullMessages, config);
  } catch (error) {
    yield { delta: '', done: true, error: String(error) };
  }
}

export async function chatOnce(
  messages: ChatMessage[],
  config: OrchestratorConfig = {}
): Promise<string> {
  let result = '';
  for await (const chunk of streamChat(messages, config)) {
    if (chunk.error) throw new Error(chunk.error);
    result += chunk.delta;
  }
  return result;
}
