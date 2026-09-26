/**
 * Server-side HNFPORTAL.one client for the D3VONN.IO Hermes bridge.
 * Never bundle HNF_HERMES_API_KEY into browser code.
 */
export type HNFActorType = 'user' | 'agent' | 'service';

export interface HNFWorkflowRequest {
  request_id: string;
  actor_id: string;
  actor_type?: HNFActorType;
  context?: Record<string, unknown>;
  persona_id?: string;
  budget_max_usd?: number;
  priority?: number;
}

export interface HNFDecision {
  approved: boolean;
  actor_id: string;
  note?: string;
}

export interface HNFHermesClientOptions {
  baseUrl?: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export class HNFHermesClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: HNFHermesClientOptions) {
    this.baseUrl = (options.baseUrl ?? 'https://api.d3vonn.io').replace(/\/$/, '');
    this.apiKey = options.apiKey.trim();
    this.fetchImpl = options.fetchImpl ?? fetch;
    if (!this.apiKey) throw new Error('HNF_HERMES_API_KEY is required');
  }

  private async request(path: string, init: RequestInit = {}) {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-HNF-Service-Key': this.apiKey,
        ...(init.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = typeof body?.detail === 'string' ? body.detail : `Hermes request failed (${response.status})`;
      throw new Error(detail);
    }
    return body;
  }

  health() {
    return this.fetchImpl(`${this.baseUrl}/api/hnf/v1/health`).then(async response => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Hermes health failed (${response.status})`);
      return body;
    });
  }

  capabilities() {
    return this.request('/api/hnf/v1/capabilities');
  }

  runWorkflow(workflow: string, request: HNFWorkflowRequest) {
    return this.request(`/api/hnf/v1/workflows/${encodeURIComponent(workflow)}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  getRequest(requestId: string) {
    return this.request(`/api/hnf/v1/requests/${encodeURIComponent(requestId)}`);
  }

  decide(requestId: string, decision: HNFDecision) {
    return this.request(`/api/hnf/v1/requests/${encodeURIComponent(requestId)}/decision`, {
      method: 'POST',
      body: JSON.stringify(decision),
    });
  }

  mcp(payload: Record<string, unknown>) {
    return this.request('/api/hnf/v1/mcp', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

export function buildHNFRequestId(surface: string, purpose: string, nonce = crypto.randomUUID()) {
  const clean = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${clean(surface)}-${clean(purpose)}-${nonce}`;
}
