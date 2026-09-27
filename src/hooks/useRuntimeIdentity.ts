import { useEffect, useState } from 'react';

const RUNTIME_IDENTITY_PATH = '/api/runtime/identity';
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