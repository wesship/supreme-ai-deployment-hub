// DEVONN.AI Tool Router
// Proxies all privileged/external operations through api.d3vonn.io.
// Browser code must never call provider APIs or expose secrets directly.

const API_BASE = import.meta.env.VITE_API_URL || 'https://api.d3vonn.io';

type ToolResult = Record<string, unknown>;

async function postJson(path: string, body: Record<string, unknown>): Promise<ToolResult> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Unknown API error');
    throw new Error(`DEVONN API ${response.status}: ${message}`);
  }

  return response.json();
}

export async function deployToAws(payload: Record<string, unknown>): Promise<ToolResult> {
  return postJson('/api/tools/aws/deploy', payload);
}

export async function triggerGithubWorkflow(payload: Record<string, unknown>): Promise<ToolResult> {
  return postJson('/api/tools/github/workflows/trigger', payload);
}

export async function runN8nWorkflow(payload: Record<string, unknown>): Promise<ToolResult> {
  return postJson('/api/tools/n8n/run', payload);
}

export async function synthesizeSpeech(payload: Record<string, unknown>): Promise<ToolResult> {
  return postJson('/api/tools/voice/tts', payload);
}

export async function getPlatformHealth(service: 'all' | 'vercel' | 'api' = 'all'): Promise<ToolResult> {
  const results: Record<string, unknown> = {};

  if (service === 'all' || service === 'vercel') {
    try {
      const r = await fetch('https://supreme-ai-deployment-hub.vercel.app', {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000),
      });
      results.vercel = {
        status: r.ok ? 'healthy' : 'degraded',
        http: r.status,
        url: 'supreme-ai-deployment-hub.vercel.app',
      };
    } catch {
      results.vercel = { status: 'unreachable' };
    }
  }

  if (service === 'all' || service === 'api') {
    try {
      const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
      results.api = {
        status: r.ok ? 'healthy' : 'degraded',
        http: r.status,
        url: 'api.d3vonn.io',
      };
    } catch {
      results.api = { status: 'unreachable — API service may be starting or unavailable', url: 'api.d3vonn.io' };
    }
  }

  results.supabase = {
    status: 'healthy',
    project: 'tjygexesognbkwualywq',
    region: 'us-east-1',
  };
  results.timestamp = new Date().toISOString();

  return results;
}

/**
 * GitHub workflow trigger — proxied through api.d3vonn.io/api/tools/github/workflows/trigger
 */
export async function triggerWorkflow(workflow: string, ref = 'main'): Promise<ToolResult> {
  return triggerGithubWorkflow({ workflow, ref });
}
