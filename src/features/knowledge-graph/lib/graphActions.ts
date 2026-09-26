export type D3GraphAction =
  | 'open'
  | 'select'
  | 'trace'
  | 'run'
  | 'monitor'
  | 'connect'
  | 'expand'
  | 'filter'
  | 'search'
  | 'ask'
  | 'stop';

export type D3GraphActionRequest = {
  action: D3GraphAction;
  nodeId?: string;
  query?: string;
  filter?: string;
  targetNodeId?: string;
  confirmed?: boolean;
  source: 'click' | 'voice';
};

export const READ_ONLY_GRAPH_ACTIONS = new Set<D3GraphAction>([
  'open',
  'select',
  'trace',
  'expand',
  'filter',
  'search',
  'ask',
  'stop',
  'monitor',
]);

export const EXECUTION_GRAPH_ACTIONS = new Set<D3GraphAction>([
  'run',
  'connect',
]);

export const isD3GraphAction = (value: unknown): value is D3GraphAction =>
  typeof value === 'string' &&
  [
    'open',
    'select',
    'trace',
    'run',
    'monitor',
    'connect',
    'expand',
    'filter',
    'search',
    'ask',
    'stop',
  ].includes(value);

export const normalizeGraphActionRequest = (
  value: unknown,
  source: 'click' | 'voice',
): D3GraphActionRequest | null => {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (!isD3GraphAction(data.action)) return null;

  const request: D3GraphActionRequest = {
    action: data.action,
    source,
  };

  for (const [key, sourceKey] of [
    ['nodeId', 'node_id'],
    ['targetNodeId', 'target_node_id'],
    ['query', 'query'],
    ['filter', 'filter'],
  ] as const) {
    const candidate = data[sourceKey];
    if (typeof candidate === 'string' && candidate.trim()) {
      request[key] = candidate.trim();
    }
  }

  if (typeof data.confirmed === 'boolean') request.confirmed = data.confirmed;
  return request;
};
