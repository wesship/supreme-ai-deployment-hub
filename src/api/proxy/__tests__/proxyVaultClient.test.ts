/**
 * Tests for proxyVaultClient.ts
 * All network calls are mocked — no real API keys used.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getProxyConfig,
  listVaultKeys,
  storeVaultKey,
  deleteVaultKey,
  type ProxyVaultError,
} from '../proxyVaultClient';

// ── Mock Supabase ─────────────────────────────────────────────────────────────
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'fake-jwt-token' } },
      }),
    },
  },
}));

// ── Mock fetch ────────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockResponse(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── getProxyConfig ────────────────────────────────────────────────────────────
describe('getProxyConfig', () => {
  it('returns config on 200', async () => {
    const payload = {
      mode: 'env-first',
      status: 'active',
      vaultPath: '.devonn/api-vault/keys.json',
      keysConfigured: 3,
      vaultEncrypted: false,
    };
    mockResponse(200, payload);
    const result = await getProxyConfig();
    expect(result).toEqual(payload);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/proxy/config'),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer fake-jwt-token' }) })
    );
  });

  it('throws UNAUTHORIZED error on 401', async () => {
    mockResponse(401, { detail: 'Authorization header required' });
    await expect(getProxyConfig()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    } as ProxyVaultError);
  });

  it('throws SERVER_ERROR on 500', async () => {
    mockResponse(500, { detail: 'Internal Server Error' });
    await expect(getProxyConfig()).rejects.toMatchObject({
      code: 'SERVER_ERROR',
    } as ProxyVaultError);
  });
});

// ── listVaultKeys ─────────────────────────────────────────────────────────────
describe('listVaultKeys', () => {
  it('returns key list on 200', async () => {
    const payload = { keys: ['OPENAI_API_KEY', 'PINECONE_API_KEY'], total: 2 };
    mockResponse(200, payload);
    const result = await listVaultKeys();
    expect(result.total).toBe(2);
    expect(result.keys).toContain('OPENAI_API_KEY');
  });
});

// ── storeVaultKey ─────────────────────────────────────────────────────────────
describe('storeVaultKey', () => {
  it('returns success response on 201', async () => {
    const payload = { success: true, name: 'FAKE_API_KEY', encrypted: false };
    mockResponse(201, payload);
    const result = await storeVaultKey({ name: 'FAKE_API_KEY', value: 'sk-fake-value' });
    expect(result.success).toBe(true);
    expect(result.name).toBe('FAKE_API_KEY');
  });

  it('throws VALIDATION error on 422', async () => {
    mockResponse(422, { detail: 'Invalid key name format' });
    await expect(
      storeVaultKey({ name: 'invalid-name', value: 'sk-fake' })
    ).rejects.toMatchObject({ code: 'VALIDATION' } as ProxyVaultError);
  });

  it('sends POST with correct body', async () => {
    mockResponse(201, { success: true, name: 'TEST_KEY', encrypted: false });
    await storeVaultKey({ name: 'TEST_KEY', value: 'sk-fake-value' });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'TEST_KEY',
      value: 'sk-fake-value',
    });
  });
});

// ── deleteVaultKey ────────────────────────────────────────────────────────────
describe('deleteVaultKey', () => {
  it('resolves on 204', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null) });
    await expect(deleteVaultKey('FAKE_API_KEY')).resolves.toBeUndefined();
  });

  it('throws NOT_FOUND on 404', async () => {
    mockResponse(404, { detail: "Key 'MISSING' not found in vault" });
    await expect(deleteVaultKey('MISSING')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    } as ProxyVaultError);
  });

  it('URL-encodes the key name', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve(null) });
    await deleteVaultKey('SOME_KEY');
    const [url] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/proxy/vault/keys/SOME_KEY');
  });
});
