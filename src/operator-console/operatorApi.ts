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

export type OperatorDeployments = Record<string, string>;

export type OperatorGovernance = {
  mainProtected: boolean;
  manualReviewRequired: boolean;
  stagingProtected: boolean;
  governanceMode: string;
  requiredProductionChecks: string[];
};

export type OperatorRuntime = Record<string, string>;

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

async function fetchOperator<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}/api/operator${path}`, {
      headers: { Accept: 'application/json' },
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
    status: 'green',
    requiredChecks: [
      'CI - Hardened Build Pipeline',
      'Devonn.AI Testing',
      'CodeQL SAST',
      'Secrets Elimination & Scanning',
      'Final Green Check',
    ],
    advisoryTools: ['ci:doctor', 'workflow:audit', 'workflow:classify', 'repo:entropy'],
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
      'Devonn.AI Testing',
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
};

export const operatorApi = {
  status: () => fetchOperator<OperatorStatus>('/status', operatorFallbacks.status),
  ci: () => fetchOperator<OperatorCI>('/ci', operatorFallbacks.ci),
  memory: () => fetchOperator<OperatorMemory>('/memory', operatorFallbacks.memory),
  connectors: () => fetchOperator<OperatorConnectors>('/connectors', operatorFallbacks.connectors),
  deployments: () => fetchOperator<OperatorDeployments>('/deployments', operatorFallbacks.deployments),
  governance: () => fetchOperator<OperatorGovernance>('/governance', operatorFallbacks.governance),
  runtime: () => fetchOperator<OperatorRuntime>('/runtime', operatorFallbacks.runtime),
};
