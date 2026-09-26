import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type HermesStreamEvent = {
  id: string;
  type: string;
  message: string;
  level: string;
  taskId?: string | null;
  runId?: string | null;
  agentName?: string | null;
  correlationId?: string | null;
  timestamp?: string | null;
  data?: Record<string, unknown>;
};

type StreamState = 'idle' | 'connecting' | 'live' | 'error' | 'closed';

const API_BASE = (import.meta.env.VITE_API_URL?.trim() || 'https://api.d3vonn.io').replace(/\/$/, '');

const parseSseBlock = (block: string): HermesStreamEvent | null => {
  const dataLines = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim());
  if (!dataLines.length) return null;
  try {
    const parsed = JSON.parse(dataLines.join('\n'));
    return parsed && typeof parsed === 'object' ? (parsed as HermesStreamEvent) : null;
  } catch {
    return null;
  }
};

export function useHermesEvents(correlationId?: string | null) {
  const [events, setEvents] = useState<HermesStreamEvent[]>([]);
  const [state, setState] = useState<StreamState>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!correlationId) {
      setEvents([]);
      setState('idle');
      setError(null);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    const run = async () => {
      setState('connecting');
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Sign in to follow a live Hermes execution.');

        const response = await fetch(
          `${API_BASE}/api/hermes/events/stream?correlation_id=${encodeURIComponent(correlationId)}`,
          {
            signal: controller.signal,
            headers: {
              Accept: 'text/event-stream',
              Authorization: `Bearer ${session.access_token}`,
              'Cache-Control': 'no-cache',
            },
          },
        );

        if (!response.ok || !response.body) {
          throw new Error(`Hermes event stream returned HTTP ${response.status}.`);
        }

        setState('live');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = blocks.pop() ?? '';

          for (const block of blocks) {
            const event = parseSseBlock(block);
            if (!event?.id) continue;
            setEvents((current) => {
              if (current.some((item) => item.id === event.id)) return current;
              return [...current, event].slice(-250);
            });
          }
        }

        if (!cancelled) setState('closed');
      } catch (err) {
        if (controller.signal.aborted || cancelled) return;
        setState('error');
        setError(err instanceof Error ? err.message : 'Hermes event stream failed.');
      }
    };

    void run();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [correlationId]);

  return useMemo(() => ({ events, state, error }), [events, state, error]);
}
