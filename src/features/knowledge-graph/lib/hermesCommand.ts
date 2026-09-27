import { supabase } from '@/integrations/supabase/client';

const PRODUCTION_API_URL = 'https://api.d3vonn.io';

const getApiBaseUrl = (): string =>
  (import.meta.env.VITE_API_URL?.trim() || PRODUCTION_API_URL).replace(/\/$/, '');

export type HermesBrowserAction = 'run' | 'monitor' | 'connect' | 'ask' | 'command';

export type HermesBrowserCommandRequest = {
  action: HermesBrowserAction;
  title?: string;
  prompt?: string;
  node_id?: string;
  target_node_id?: string;
  ui_session_id?: string;
  surface?: string;
  route?: string;
};

export type HermesBrowserCommandResponse = {
  status: 'queued' | 'approval_required';
  action: HermesBrowserAction;
  task_id?: string | null;
  correlation_id: string;
  node_id?: string | null;
  target_node_id?: string | null;
  governed_execution: true;
};

export async function sendHermesBrowserCommand(
  command: HermesBrowserCommandRequest,
): Promise<HermesBrowserCommandResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Sign in to send governed instructions to Hermes.');
  }

  const response = await fetch(`${getApiBaseUrl()}/api/voice/hermes/command`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(detail?.detail || `Hermes returned HTTP ${response.status}.`);
  }

  return response.json() as Promise<HermesBrowserCommandResponse>;
}