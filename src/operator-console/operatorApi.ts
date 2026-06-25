import { operatorAuthHeaders } from './operatorSession';

export type OperatorStatus = {
  readiness: string;
  mode: string;
  timestamp: string;
  surfaces: string[];
};

export type OperatorCI = {
  status: string;
  requiredChecks: string[];
  advisoryTools: string[];
  githubActions?: {
    configured?: boolean;
    status?: string;
    runs?: Array<Record<string, unknown>>;
    summary?: { total?: number; failures?: number; healthy?: boolean };
  };
};

export type OperatorMemory = {
  vaultPath: string;
  entries: number;
  lastExport: string | null;
  mode: string;
};

export type OperatorConnectors = {
  production: string[];
  staging: string[];
  future: string[];
};

export type OperatorDeployments = Record<string, unknown>;

export type OperatorGovernance = {
  mainProtected: boolean;
  manualReviewRequired: boolean;
  stagingProtected: boolean;
  governanceMode: string;
  requiredProductionChecks: string[];
};

export type OperatorRuntime = Record<string, string>;

export type OperatorMetrics = {
  timestamp: string;
  source: string;
  integrationStatus?: string;
  prometheus?: {
    configured?: boolean;
    results?: Record<string, { status?: string; configured?: boolean; data?: unknown[] }>;
  };
  series?: Array<{ name: string; value: number; unit: string; status: string }>;
};

export type OperatorLogs = {
  timestamp: string;
  source: string;
  entries: Array<{ timestampNs?: string; labels?: Record<string, string>; line?: string }>;
};

export type OperatorTraces = {
  timestamp: string;
  source: string;
  spans: Array<{ traceId?: string; name?: string; durationMs?: number; status?: string }>;
};

export type OperatorQueues = {
  timestamp: string;
  redisReady?: boolean;
  provider?: string;
  configured?: boolean;
  queues: Array<{ name: string; depth: number; status: string }>;
};

export type OperatorGraphNode = {
  id: string;
  label: string;
  type: string;
  status: string;
};

export type OperatorGraphEdge = {
  source: string;
  target: string;
  label?: string;
};

export type OperatorGraph = {
  timestamp?: string;
  source?: string;
  nodes: OperatorGraphNode[];
  edges: OperatorGraphEdge[];
};

export type OperatorTopology = {
  timestamp: string;
  integrationStatus?: string;
  layers: Array<{ name: string; status: string; components: string[] }>;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function fetchOperator<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}/api/operator${path}`, {
      headers: {
        Accept: 'application/json',
        ...operatorAuthHeaders(),
      },
    });

    if (!response.ok) return fallback;
    return (await response.json()) as T;
  } catch {
    return fallback;
  }
}

export const operatorFallbacks = {
  status: {
    readiness: 'yellow',
    mode: 'stabilization',
    timestamp: new Date(0).toISOString(),
    surfaces: ['ci', 'memory', 'connectors', 'deployments', 'governance', 'runtime'],
  } satisfies OperatorStatus,
  ci: {
    status: 'observing',
    requiredChecks: [
      'CI - Hardened Build Pipeline',
      'D3VONN.IO Testing',
      'CodeQL SAST',
      'Secrets Elimination & Scanning',
      'Final Green Check',
    ],
    advisoryTools: ['ci:doctor', 'workflow:audit', 'workflow:classify', 'repo:entropy'],
    githubActions: { configured: false, runs: [], summary: { total: 0, failures: 0, healthy: false } },
  } satisfies OperatorCI,
  memory: {
    vaultPath: '.devonn/memory-vault',
    entries: 0,
    lastExport: null,
    mode: 'local-first',
  } satisfies OperatorMemory,
  connectors: {
    production: ['GitHub', 'AWS', 'Vercel'],
    staging: ['Supabase', 'n8n', 'Appsmith'],
    future: ['Slack', 'Notion'],
  } satisfies OperatorConnectors,
  deployments: {
    frontend: 'staging-ready',
    api: 'pending',
    database: 'pending',
    redis: 'pending',
    observability: 'pending',
  } satisfies OperatorDeployments,
  governance: {
    mainProtected: true,
    manualReviewRequired: true,
    stagingProtected: false,
    governanceMode: 'manual-review-during-stabilization',
    requiredProductionChecks: [
      'CI - Hardened Build Pipeline',
      'D3VONN.IO Testing',
      'CodeQL SAST',
      'Secrets Elimination & Scanning',
      'Final Green Check',
    ],
  } satisfies OperatorGovernance,
  runtime: {
    agents: 'pending-live-check',
    queues: 'pending-live-check',
    memory: 'local-first',
    dag: 'pending-live-check',
    gitnexus: 'pending-live-check',
  } satisfies OperatorRuntime,
  metrics: {
    timestamp: new Date(0).toISOString(),
    source: 'fallback',
    prometheus: { configured: false, results: {} },
    series: [],
  } satisfies OperatorMetrics,
  logs: {
    timestamp: new Date(0).toISOString(),
    source: 'fallback',
    entries: [],
  } satisfies OperatorLogs,
  traces: {
    timestamp: new Date(0).toISOString(),
    source: 'fallback',
    spans: [],
  } satisfies OperatorTraces,
  queues: {
    timestamp: new Date(0).toISOString(),
    redisReady: false,
    queues: [],
  } satisfies OperatorQueues,
  graph: {
    timestamp: new Date(0).toISOString(),
    source: 'fallback',
    nodes: [],
    edges: [],
  } satisfies OperatorGraph,
  topology: {
    timestamp: new Date(0).toISOString(),
    integrationStatus: 'unknown',
    layers: [],
  } satisfies OperatorTopology,
};

export const operatorApi = {
  status: () => fetchOperator<OperatorStatus>('/status', operatorFallbacks.status),
  ci: () => fetchOperator<OperatorCI>('/ci', operatorFallbacks.ci),
  memory: () => fetchOperator<OperatorMemory>('/memory', operatorFallbacks.memory),
  connectors: () => fetchOperator<OperatorConnectors>('/connectors', operatorFallbacks.connectors),
  deployments: () => fetchOperator<OperatorDeployments>('/deployments', operatorFallbacks.deployments),
  governance: () => fetchOperator<OperatorGovernance>('/governance', operatorFallbacks.governance),
  runtime: () => fetchOperator<OperatorRuntime>('/runtime', operatorFallbacks.runtime),
  metrics: () => fetchOperator<OperatorMetrics>('/metrics', operatorFallbacks.metrics),
  logs: () => fetchOperator<OperatorLogs>('/logs', operatorFallbacks.logs),
  traces: () => fetchOperator<OperatorTraces>('/traces', operatorFallbacks.traces),
  queues: () => fetchOperator<OperatorQueues>('/queues', operatorFallbacks.queues),
  graph: () => fetchOperator<OperatorGraph>('/graph', operatorFallbacks.graph),
  dag: () => fetchOperator<OperatorGraph>('/dag', operatorFallbacks.graph),
  topology: () => fetchOperator<OperatorTopology>('/topology', operatorFallbacks.topology),
};
