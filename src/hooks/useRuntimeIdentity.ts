import { useEffect, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL?.trim() || 'https://api.d3vonn.io').replace(/\/$/, '');
const RUNTIME_IDENTITY_PATH = `${API_BASE}/api/runtime/identity`;
const EXPECTED_REPOSITORY = 'wesship/supreme-ai-deployment-hub';

export type RuntimeIdentity = {
  service: string;
  repository: string;
  contract_version: string;
  commit_sha: string | null;
  ui_authority: string;
};

export function useRuntimeIdentity() {
  const [identity, setIdentity] = useState<RuntimeIdentity | null>(null);
  const [state, setState] = useState<'checking' | 'connected' | 'mismatch' | 'unavailable'>('checking');

  useEffect(() => {
    const controller = new AbortController();

    const check = async () => {
      const host = window.location.hostname.toLowerCase();
      if (host === '127.0.0.1' || host === 'localhost' || host === '0.0.0.0') {
        setState('unavailable');
        return;
      }

      try {
        const response = await fetch(RUNTIME_IDENTITY_PATH, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
          cache: 'no-store',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const payload = (await response.json()) as RuntimeIdentity;
        if (controller.signal.aborted) return;

        setIdentity(payload);
        setState(
          payload.repository === EXPECTED_REPOSITORY && payload.ui_authority === 'repository'
            ? 'connected'
            : 'mismatch',
        );
      } catch {
        if (!controller.signal.aborted) setState('unavailable');
      }
    };

    void check();
    return () => controller.abort();
  }, []);

  return { identity, state };
}