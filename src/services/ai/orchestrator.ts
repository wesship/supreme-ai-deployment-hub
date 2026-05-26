/**
 * Devonn.ai AI Orchestrator
 * Multi-provider LLM routing with streaming, fallback, and tool-calling support.
 * Providers: OpenAI (primary) → api.devonn.ai (secondary) → future: Ollama, Gemini, DeepSeek
 * Phase 2: RAG context injection via Pinecone vector retrieval.
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

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEVONN_API_URL = `${import.meta.env.VITE_API_URL || 'https://api.devonn.ai'}/api/chat`;

/**
 * Stream a chat response from OpenAI with SSE parsing
 */
async function* streamOpenAI(
  messages: ChatMessage[],
  config: OrchestratorConfig
): AsyncGenerator<StreamChunk> {
  if (config.signal?.aborted) {
    yield { delta: '', done: true };
    return;
  }
  const apiKey = config.apiKey || import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    yield { delta: '', done: true, error: 'No OpenAI API key configured' };
    return;
  }

  const model = config.model || 'gpt-4.1-mini';

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    signal: config.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: config.maxTokens || 2048,
      temperature: config.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    yield { delta: '', done: true, error: `OpenAI error ${response.status}: ${err}` };
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
      if (!trimmed || trimmed === 'data: [DONE]') {
        if (trimmed === 'data: [DONE]') {
          yield { delta: '', done: true, provider: 'openai', model };
          return;
        }
        continue;
      }
      if (trimmed.startsWith('data: ')) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content || '';
          if (delta) {
            yield { delta, done: false, provider: 'openai', model };
          }
        } catch {
          // skip malformed chunks
        }
      }
    }
  }
  yield { delta: '', done: true, provider: 'openai', model };
}

/**
 * Stream from Devonn backend (fallback)
 */
async function* streamDevonn(
  messages: ChatMessage[],
  config: OrchestratorConfig
): AsyncGenerator<StreamChunk> {
  try {
    const response = await fetch(DEVONN_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model: config.model || 'gpt-4.1-mini', stream: true }),
    });

    if (!response.ok) throw new Error(`Devonn API error: ${response.status}`);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            if (json.done) {
              yield { delta: '', done: true, provider: 'devonn' };
              return;
            }
            if (json.delta) yield { delta: json.delta, done: false, provider: 'devonn' };
          } catch { /* skip */ }
        }
      }
    }
    yield { delta: '', done: true, provider: 'devonn' };
  } catch (err) {
    yield { delta: '', done: true, error: String(err) };
  }
}

/**
 * Main orchestrator: routes to primary provider with automatic fallback
 */
export async function* streamChat(
  messages: ChatMessage[],
  config: OrchestratorConfig = {}
): AsyncGenerator<StreamChunk> {
  const provider = config.provider || 'openai';

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
    if (provider === 'openai') {
      let hasContent = false;
      for await (const chunk of streamOpenAI(fullMessages, config)) {
        if (chunk.error && !hasContent) {
          // Fallback to devonn backend
          yield { delta: '[Falling back to Devonn backend...]\n', done: false };
          yield* streamDevonn(fullMessages, config);
          return;
        }
        hasContent = hasContent || !!chunk.delta;
        yield chunk;
      }
    } else if (provider === 'devonn') {
      yield* streamDevonn(fullMessages, config);
    } else {
      yield { delta: '', done: true, error: `Provider "${provider}" not yet implemented` };
    }
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
