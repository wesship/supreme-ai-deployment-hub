import { useEffect, useMemo, useState } from 'react';

export type RuntimeEvent = {
  type: string;
  timestamp: string;
  message: string;
  severity?: string;
  surface?: string;
  status?: string;
};

const MAX_EVENTS = 24;

export function useOperatorRuntimeStream() {
  const [events, setEvents] = useState<RuntimeEvent[]>([]);
  const [connected, setConnected] = useState(false);

  const endpoint = useMemo(() => {
    const base = import.meta.env.VITE_API_BASE_URL ?? window.location.origin;
    const url = new URL(base);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/api/operator/runtime/stream';
    return url.toString();
  }, []);

  useEffect(() => {
    let socket: WebSocket | null = null;

    try {
      socket = new WebSocket(endpoint);

      socket.onopen = () => {
        setConnected(true);
      };

      socket.onclose = () => {
        setConnected(false);
      };

      socket.onerror = () => {
        setConnected(false);
      };

      socket.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as RuntimeEvent;
          setEvents((current) => [parsed, ...current].slice(0, MAX_EVENTS));
        } catch {
          // Ignore malformed stream payloads.
        }
      };
    } catch {
      setConnected(false);
    }

    return () => {
      socket?.close();
    };
  }, [endpoint]);

  return {
    connected,
    events,
  };
}

export default useOperatorRuntimeStream;
