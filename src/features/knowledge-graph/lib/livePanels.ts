import type { HermesStreamEvent } from '../hooks/useHermesEvents';

export type LiveAgentSummary = {
  name: string;
  events: number;
  lastEvent: string;
};

export type LiveInfrastructureSummary = {
  name: string;
  events: number;
  state: 'active' | 'observed';
};

export type LiveExecutionPanels = {
  status: 'idle' | 'connecting' | 'running' | 'complete' | 'failed';
  latestActivity: HermesStreamEvent[];
  agents: LiveAgentSummary[];
  infrastructure: LiveInfrastructureSummary[];
  costUsd: number | null;
  tokensUsed: number | null;
  durationMs: number | null;
  asOf: string | null;
};

const numeric = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const eventNumbers = (event: HermesStreamEvent) => {
  const data = event.data ?? {};
  return {
    costUsd:
      numeric(data.cost_usd) ??
      numeric(data.costUsd) ??
      numeric(data.cost) ??
      null,
    tokensUsed:
      numeric(data.tokens_used) ??
      numeric(data.tokensUsed) ??
      numeric(data.total_tokens) ??
      numeric(data.totalTokens) ??
      null,
    durationMs:
      numeric(data.duration_ms) ??
      numeric(data.durationMs) ??
      null,
  };
};

const infrastructureName = (event: HermesStreamEvent): string | null => {
  const data = event.data ?? {};
  const candidates = [
    data.infrastructure,
    data.service,
    data.provider,
    data.tool,
    data.tool_name,
    data.toolName,
    data.runtime,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  const haystack = `${event.type} ${event.message}`.toLowerCase();
  const known: Array<[string, string]> = [
    ['redis', 'Redis'],
    ['postgres', 'Postgres'],
    ['supabase', 'Supabase'],
    ['vector', 'Vector DB'],
    ['qdrant', 'Qdrant'],
    ['pinecone', 'Pinecone'],
    ['gpu', 'GPU Runtime'],
    ['jetson', 'Jetson Edge'],
    ['mcp', 'MCP'],
    ['elevenlabs', 'ElevenLabs'],
    ['vapi', 'Vapi'],
    ['twelvelabs', 'TwelveLabs'],
  ];
  return known.find(([needle]) => haystack.includes(needle))?.[1] ?? null;
};

export function deriveLiveExecutionPanels(
  events: HermesStreamEvent[],
  streamState: string,
): LiveExecutionPanels {
  const latestActivity = [...events].slice(-8).reverse();
  const agentMap = new Map<string, LiveAgentSummary>();
  const infrastructureMap = new Map<string, LiveInfrastructureSummary>();

  let costUsd = 0;
  let tokensUsed = 0;
  let durationMs = 0;
  let hasCost = false;
  let hasTokens = false;
  let hasDuration = false;

  for (const event of events) {
    if (event.agentName?.trim()) {
      const name = event.agentName.trim();
      const current = agentMap.get(name);
      agentMap.set(name, {
        name,
        events: (current?.events ?? 0) + 1,
        lastEvent: event.type,
      });
    }

    const infrastructure = infrastructureName(event);
    if (infrastructure) {
      const current = infrastructureMap.get(infrastructure);
      infrastructureMap.set(infrastructure, {
        name: infrastructure,
        events: (current?.events ?? 0) + 1,
        state: 'active',
      });
    }

    const metrics = eventNumbers(event);
    if (metrics.costUsd !== null) {
      costUsd += metrics.costUsd;
      hasCost = true;
    }
    if (metrics.tokensUsed !== null) {
      tokensUsed += metrics.tokensUsed;
      hasTokens = true;
    }
    if (metrics.durationMs !== null) {
      durationMs += metrics.durationMs;
      hasDuration = true;
    }
  }

  const last = events[events.length - 1];
  const type = last?.type.toLowerCase() ?? '';
  const level = last?.level.toLowerCase() ?? '';
  const status: LiveExecutionPanels['status'] =
    !events.length
      ? streamState === 'connecting'
        ? 'connecting'
        : 'idle'
      : level === 'error' || type.includes('failed') || type.includes('error')
        ? 'failed'
        : type.includes('complete') || type.includes('completed')
          ? 'complete'
          : 'running';

  return {
    status,
    latestActivity,
    agents: [...agentMap.values()].sort((a, b) => b.events - a.events).slice(0, 5),
    infrastructure: [...infrastructureMap.values()].sort((a, b) => b.events - a.events).slice(0, 6),
    costUsd: hasCost ? costUsd : null,
    tokensUsed: hasTokens ? tokensUsed : null,
    durationMs: hasDuration ? durationMs : null,
    asOf: last?.timestamp ?? null,
  };
}
