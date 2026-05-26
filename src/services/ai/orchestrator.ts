/**
 * Devonn.ai AI Orchestrator
 * Multi-provider LLM routing with streaming, fallback, and tool-calling support.
 *
 * Security architecture:
 *   ALL LLM calls are proxied through api.devonn.ai/api/chat.
 *   OPENAI_API_KEY is a server-side secret only — never in the browser bundle.
 *   Frontend → api.devonn.ai/api/chat (SSE streaming) → OpenAI / Gemini / Ollama
 *
 * Phase 2: RAG context injection via Pinecone vector retrieval.
 * Phase 3: Tool-calling support via server-side function dispatch.
 */
import { retrieveContext, isRAGAvailable } from './ragService';

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
- **Infrastructure**: AWS EKS/Kubernetes, ALB, Route 53, Vercel, Supabase, CI/CD pipelines
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

Current platform status: Production deployment active at devonn.ai via Vercel + AWS EKS backend.`;

// ─── Proxy endpoint ────────────────────────────────────────────────────────────
// All LLM calls go through the server-side proxy. The backend holds OPENAI_API_KEY.
const API_BASE = import.meta.env.VITE_API_URL || 'https://api.devonn.ai';
const CHAT_PROXY_URL = `${API_BASE}/api/chat`;

/**
 * Stream a chat response via the api.devonn.ai proxy (SSE).
 * The proxy forwards to OpenAI (or other providers) using server-side secrets.
 *
 * Expected SSE format from proxy:
 *   data: {"delta":"token","done":false,"provider":"openai","model":"gpt-4.1-mini"}
 *   data: {"delta":"","done":true,"provider":"openai","model":"gpt-4.1-mini"}
 */
async function* streamProxy(
  messages: ChatMessage[],
  config: OrchestratorConfig
): AsyncGenerator<StreamChunk> {
  if (config.signal?.aborted) {
    yield { delta: '', done: true };
    return;
  }

  const model = config.model || 'gpt-4.1-mini';
  const provider = config.provider || 'openai';

  let response: Response;
  try {
    response = await fetch(CHAT_PROXY_URL, {
      method: 'POST',
      signal: config.signal,
      headers: { 'Content-Type': 'application/json' },
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
    yield { delta: '', done: true, error: `Proxy connection failed: ${String(err)}` };
    return;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => `HTTP ${response.status}`);
    yield { delta: '', done: true, error: `Proxy error ${response.status}: ${errText}` };
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    if (config.signal?.aborted) break;
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Handle OpenAI-compatible SSE format
      if (trimmed === 'data: [DONE]') {
        yield { delta: '', done: true, provider, model };
        return;
      }

      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));

          // Devonn proxy format: { delta, done, provider, model }
          if ('delta' in json) {
            if (json.done) {
              yield { delta: '', done: true, provider: json.provider || provider, model: json.model || model };
              return;
            }
            if (json.delta) {
              yield { delta: json.delta, done: false, provider: json.provider || provider, model: json.model || model };
            }
            continue;
          }

          // OpenAI passthrough format: { choices: [{ delta: { content } }] }
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            yield { delta, done: false, provider, model };
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }

  yield { delta: '', done: true, provider, model };
}

/**
 * Main orchestrator: routes through server-side proxy with RAG injection.
 */
export async function* streamChat(
  messages: ChatMessage[],
  config: OrchestratorConfig = {}
): AsyncGenerator<StreamChunk> {
  // ── RAG: retrieve relevant context for the latest user message ──────────
  let ragContext = '';
  if (config.useRAG !== false && isRAGAvailable()) {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) {
      ragContext = await retrieveContext(lastUserMsg.content);
    }
  }

  // Build system prompt — inject RAG context when available
  const systemContent = ragContext
    ? `${DEVONN_SYSTEM_PROMPT}\n\n---\n\n## Retrieved Context (from your document store)\n\nThe following excerpts are relevant to the user's question. Use them to inform your response:\n\n${ragContext}\n\n---`
    : DEVONN_SYSTEM_PROMPT;

  // Prepend system prompt if not already present
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

/**
 * Non-streaming single response (for simple use cases)
 */
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
