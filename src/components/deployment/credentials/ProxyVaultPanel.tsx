/**
 * src/components/deployment/credentials/ProxyVaultPanel.tsx
 *
 * UI panel for managing the backend proxy API key vault.
 * Displays vault status, lists stored key names, and allows
 * adding or removing keys.
 *
 * Security note: key *values* are cleared from state immediately
 * after the POST request completes. They are never rendered or
 * stored beyond the controlled input lifetime.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useProxyVault } from '@/hooks/useProxyVault';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ── Sub-components ────────────────────────────────────────────────────────────

function VaultStatusBadge({ encrypted }: { encrypted: boolean }) {
  return encrypted ? (
    <Badge variant="default" className="bg-green-600 text-white text-xs">
      Encrypted
    </Badge>
  ) : (
    <Badge variant="secondary" className="text-xs">
      Plaintext (set API_KEY_VAULT_SECRET)
    </Badge>
  );
}

function KeyRow({
  name,
  onDelete,
  disabled,
}: {
  name: string;
  onDelete: (name: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md bg-white/5 border border-white/10">
      <span className="font-mono text-sm text-gray-200">{name}</span>
      <Button
        variant="ghost"
        size="sm"
        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-7 px-2"
        onClick={() => onDelete(name)}
        disabled={disabled}
        aria-label={`Remove ${name}`}
      >
        Remove
      </Button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const ProxyVaultPanel: React.FC = () => {
  const {
    config,
    keyList,
    loading,
    error,
    fetchConfig,
    fetchKeys,
    storeKey,
    deleteKey,
    clearError,
  } = useProxyVault();

  // Controlled form state — value is cleared after submit
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const valueRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void fetchConfig();
    void fetchKeys();
  }, [fetchConfig, fetchKeys]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = newKeyName.trim().toUpperCase();
    if (!/^[A-Z0-9_]+$/.test(name)) {
      setFormError('Key name must only contain uppercase letters, digits, and underscores.');
      return;
    }
    if (!newKeyValue.trim()) {
      setFormError('Key value cannot be empty.');
      return;
    }

    const success = await storeKey({ name, value: newKeyValue });
    if (success) {
      setNewKeyName('');
      // Immediately clear the value from state and DOM
      setNewKeyValue('');
      if (valueRef.current) {
        valueRef.current.value = '';
      }
    }
  };

  const handleDelete = async (name: string) => {
    clearError();
    await deleteKey(name);
  };

  return (
    <Card className="border-white/10 bg-black/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base text-white">API Key Vault</CardTitle>
          {config && <VaultStatusBadge encrypted={config.vaultEncrypted} />}
        </div>
        <CardDescription className="text-gray-400 text-xs">
          Keys are stored encrypted on the server. Values are never displayed after entry.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Vault metadata */}
        {config && (
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-400">
            <span>Mode</span>
            <span className="text-gray-200 font-mono">{config.mode}</span>
            <span>Keys configured</span>
            <span className="text-gray-200 font-mono">{config.keysConfigured}</span>
            <span>Status</span>
            <span className="text-green-400 font-mono">{config.status}</span>
          </div>
        )}

        {/* Error banner */}
        {(error ?? formError) && (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">
              {formError ?? error?.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Key list */}
        {keyList && keyList.total > 0 ? (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Stored Keys ({keyList.total})
            </p>
            {keyList.keys.map((name) => (
              <KeyRow
                key={name}
                name={name}
                onDelete={handleDelete}
                disabled={loading}
              />
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No keys stored yet.</p>
        )}

        {/* Add key form */}
        <form onSubmit={handleAdd} className="space-y-2 pt-2 border-t border-white/10">
          <p className="text-xs text-gray-400 font-medium">Add / Rotate Key</p>
          <Input
            placeholder="KEY_NAME (e.g. OPENAI_API_KEY)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value.toUpperCase())}
            className="font-mono text-sm bg-black/30 border-white/20 text-white placeholder:text-gray-600"
            autoComplete="off"
            spellCheck={false}
            disabled={loading}
          />
          <Input
            ref={valueRef}
            type="password"
            placeholder="sk-… (value is never displayed again)"
            value={newKeyValue}
            onChange={(e) => setNewKeyValue(e.target.value)}
            className="font-mono text-sm bg-black/30 border-white/20 text-white placeholder:text-gray-600"
            autoComplete="new-password"
            disabled={loading}
          />
          <Button
            type="submit"
            size="sm"
            className="w-full"
            disabled={loading || !newKeyName || !newKeyValue}
          >
            {loading ? 'Saving…' : 'Save Key'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProxyVaultPanel;
