/**
 * Devonn.ai AI Orchestrator
 * Multi-provider LLM routing with streaming, fallback, and tool-calling support.
 *
 * Security architecture:
 *   ALL LLM calls are proxied through api.d3vonn.io/api/chat.
 *   OPENAI_API_KEY is a server-side secret only — never in the browser bundle.
 *   Frontend → api.d3vonn.io/api/chat (SSE streaming) → OpenAI / Gemini / Ollama
 *
 * Phase 2: RAG context injection via Pinecone vector retrieval.
 * Phase 3: Tool-calling support via server-side function dispatch.
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
  /** @deprecated — never pass API keys from the frontend. Use server-side secrets. */
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
  signal?: AbortSignal;
  /** When true, retrieves relevant document context from Pinecone before responding */
  useRAG?: boolean;
}

export const DEVONN_SYSTEM_PROMPT = `You are Devonn, the AI core of the Devonn.ai Supreme AI Deployment Hub — an advanced multi-agent orchestration platform built for enterprise AI operations.

You deeply understand:
- **Devonn.ai ecosystem**: Supreme AI Deployment Hub, agent mesh architecture, multi-agent orchestration
- **Infrastructure**: Vercel frontend, Railway API service, Supabase, Hostinger DNS, CI/CD pipelines
- **AI operations**: Model deployment, monitoring, token tracking, cost optimization, RAG pipelines
- **Development**: React/Vite/TypeScript frontend, FastAPI backend, GitHub Actions, Docker
- **Agents**: LangGraph orchestration, tool-calling, MCP compatibility, workflow automation
- **Education**: Devonn Blue learning system, AI literacy, operator training

Your personality:
- Precise, technical, and direct — like a senior AI infrastructure engineer
- Proactive: anticipate follow-up needs and surface relevant context
- Operator-focused: always consider production impact and reliability
- Cyberpunk aesthetic: you are the intelligence layer of a sovereign AI platform

When users ask about deployments, agents, workflows, or infrastructure — you have full context of the platform and can guide, execute, or explain any operation.

Current platform status: Production deployment active at d3vonn.io via Vercel frontend and Railway-backed API service.`;

const API_BASE = (import.meta.env.VITE_API_URL || 'https://api.d3vonn.io')
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');
const CHAT_PROXY_URL = `${API_BASE}/api/chat`;

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
    const { data: { session } } = await (await import('@/integrations/supabase/client')).supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

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
  } catch (err) {
    const message = err instanceof ChatTimeoutError
      ? err.message
      : linked.controller.signal.aborted && !config.signal?.aborted
        ? 'D3VONN chat connection timed out. Please try again.'
        : `Proxy connection failed: ${String(err)}`;
    yield { delta: '', done: true, error: message };
    linked.clear();
    return;
  }
  linked.clear();

  if (!response.ok) {
    const errText = await response.text().catch(() => `HTTP ${response.status}`);
    yield { delta: '', done: true, error: `Proxy error ${response.status}: ${errText}` };
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
            yield {
              delta: '',
              done: true,
              error: 'D3VONN received an empty response from the AI provider. Please retry.',
            };
            return;
          }
          yield { delta: '', done: true, provider, model };
          return;
        }

        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));

          if ('delta' in json) {
            if (json.done) {
              if (!emittedContent) {
                yield {
                  delta: '',
                  done: true,
                  error: 'D3VONN received an empty response from the AI provider. Please retry.',
                };
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
            if (json.delta) {
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

          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            emittedContent = true;
            yield { delta, done: false, provider, model };
          }
        } catch {
          // Ignore malformed individual SSE chunks; the empty-stream guard below
          // still prevents a silent successful completion.
        }
      }
    }
  } catch (err) {
    const message = err instanceof ChatTimeoutError
      ? err.message
      : `D3VONN stream failed: ${String(err)}`;
    yield { delta: '', done: true, error: message };
    return;
  } finally {
    reader.releaseLock();
  }

  if (!emittedContent) {
    yield {
      delta: '',
      done: true,
      error: 'D3VONN received no response data. Please retry.',
    };
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
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      ragContext = await retrieveContext(lastUserMsg.content);
    }
  }

  const systemContent = ragContext
    ? `${DEVONN_SYSTEM_PROMPT}\n\n---\n\n## Retrieved Context (from your document store)\n\nThe following excerpts are relevant to the user's question. Use them to inform your response:\n\n${ragContext}\n\n---`
    : DEVONN_SYSTEM_PROMPT;

  const fullMessages: ChatMessage[] =
    messages[0]?.role === 'system'
      ? [{ role: 'system', content: systemContent }, ...messages.slice(1)]
      : [{ role: 'system', content: systemContent }, ...messages];

  try {
    yield* streamProxy(fullMessages, config);
  } catch (err) {
    yield { delta: '', done: true, error: String(err) };
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
