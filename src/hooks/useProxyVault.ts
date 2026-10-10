/**
 * src/hooks/useProxyVault.ts
 *
 * React hook that wraps the proxy vault API client.
 * Provides loading/error state management and a clean interface
 * for the ProxyVaultPanel UI component.
 *
 * Security note: key *values* are never stored in component state.
 * Only key *names* and metadata are held in memory.
 */

import { useState, useCallback } from 'react';
import {
  getProxyConfig,
  listVaultKeys,
  storeVaultKey,
  deleteVaultKey,
  type ProxyConfig,
  type KeyListResponse,
  type StoreKeyRequest,
  type ProxyVaultError,
} from '@/api/proxy';

export interface UseProxyVaultState {
  config: ProxyConfig | null;
  keyList: KeyListResponse | null;
  loading: boolean;
  error: ProxyVaultError | null;
}

export interface UseProxyVaultActions {
  fetchConfig: () => Promise<void>;
  fetchKeys: () => Promise<void>;
  storeKey: (request: StoreKeyRequest) => Promise<boolean>;
  deleteKey: (name: string) => Promise<boolean>;
  clearError: () => void;
}

export function useProxyVault(): UseProxyVaultState & UseProxyVaultActions {
  const [config, setConfig] = useState<ProxyConfig | null>(null);
  const [keyList, setKeyList] = useState<KeyListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ProxyVaultError | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getProxyConfig();
      setConfig(data);
    } catch (err) {
      setError(err as ProxyVaultError);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listVaultKeys();
      setKeyList(data);
    } catch (err) {
      setError(err as ProxyVaultError);
    } finally {
      setLoading(false);
    }
  }, []);

  const storeKey = useCallback(async (request: StoreKeyRequest): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await storeVaultKey(request);
      // Refresh the key list after a successful store
      const updated = await listVaultKeys();
      setKeyList(updated);
      return true;
    } catch (err) {
      setError(err as ProxyVaultError);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteKey = useCallback(async (name: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await deleteVaultKey(name);
      // Refresh the key list after deletion
      const updated = await listVaultKeys();
      setKeyList(updated);
      return true;
    } catch (err) {
      setError(err as ProxyVaultError);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    config,
    keyList,
    loading,
    error,
    fetchConfig,
    fetchKeys,
    storeKey,
    deleteKey,
    clearError,
  };
}
