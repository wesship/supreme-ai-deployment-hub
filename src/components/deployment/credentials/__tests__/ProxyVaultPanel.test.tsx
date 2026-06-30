/**
 * Tests for ProxyVaultPanel component.
 * All API calls are mocked — no real keys used.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProxyVaultPanel from '../ProxyVaultPanel';

// ── Mock the hook ─────────────────────────────────────────────────────────────
const mockFetchConfig = vi.fn();
const mockFetchKeys = vi.fn();
const mockStoreKey = vi.fn();
const mockDeleteKey = vi.fn();
const mockClearError = vi.fn();

const defaultHookState = {
  config: {
    mode: 'env-first' as const,
    status: 'active' as const,
    vaultPath: '.d3vonn/api-vault/keys.json',
    keysConfigured: 2,
    vaultEncrypted: false,
  },
  keyList: {
    keys: ['OPENAI_API_KEY', 'PINECONE_API_KEY'],
    total: 2,
  },
  loading: false,
  error: null,
  fetchConfig: mockFetchConfig,
  fetchKeys: mockFetchKeys,
  storeKey: mockStoreKey,
  deleteKey: mockDeleteKey,
  clearError: mockClearError,
};

vi.mock('@/hooks/useProxyVault', () => ({
  useProxyVault: () => defaultHookState,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProxyVaultPanel', () => {
  it('renders the panel title', () => {
    render(<ProxyVaultPanel />);
    expect(screen.getByText('API Key Vault')).toBeInTheDocument();
  });

  it('shows vault metadata from config', async () => {
    render(<ProxyVaultPanel />);
    await waitFor(() => {
      expect(screen.getByText('env-first')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });
  });

  it('renders stored key names', async () => {
    render(<ProxyVaultPanel />);
    await waitFor(() => {
      expect(screen.getByText('OPENAI_API_KEY')).toBeInTheDocument();
      expect(screen.getByText('PINECONE_API_KEY')).toBeInTheDocument();
    });
  });

  it('shows "Plaintext" badge when vault is not encrypted', () => {
    render(<ProxyVaultPanel />);
    expect(screen.getByText(/Plaintext/i)).toBeInTheDocument();
  });

  it('calls fetchConfig and fetchKeys on mount', () => {
    render(<ProxyVaultPanel />);
    expect(mockFetchConfig).toHaveBeenCalledTimes(1);
    expect(mockFetchKeys).toHaveBeenCalledTimes(1);
  });

  it('calls deleteKey when Remove button is clicked', async () => {
    mockDeleteKey.mockResolvedValue(true);
    render(<ProxyVaultPanel />);
    const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
    await userEvent.click(removeButtons[0]);
    expect(mockDeleteKey).toHaveBeenCalledWith('OPENAI_API_KEY');
  });

  it('calls storeKey with correct name and value on form submit', async () => {
    mockStoreKey.mockResolvedValue(true);
    render(<ProxyVaultPanel />);
    const nameInput = screen.getByPlaceholderText(/KEY_NAME/i);
    const valueInput = screen.getByPlaceholderText(/sk-/i);
    const submitButton = screen.getByRole('button', { name: /Save Key/i });

    await userEvent.type(nameInput, 'FAKE_API_KEY');
    await userEvent.type(valueInput, 'sk-fake-value');
    await userEvent.click(submitButton);

    expect(mockStoreKey).toHaveBeenCalledWith({
      name: 'FAKE_API_KEY',
      value: 'sk-fake-value',
    });
  });

  it('shows validation error for invalid key name', async () => {
    render(<ProxyVaultPanel />);
    const nameInput = screen.getByPlaceholderText(/KEY_NAME/i);
    const valueInput = screen.getByPlaceholderText(/sk-/i);
    const submitButton = screen.getByRole('button', { name: /Save Key/i });

    await userEvent.type(nameInput, 'invalid-name');
    await userEvent.type(valueInput, 'sk-fake');
    await userEvent.click(submitButton);

    expect(
      screen.getByText(/uppercase letters, digits, and underscores/i)
    ).toBeInTheDocument();
    expect(mockStoreKey).not.toHaveBeenCalled();
  });
});
