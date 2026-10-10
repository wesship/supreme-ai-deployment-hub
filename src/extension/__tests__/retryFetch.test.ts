import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchWithRetry, isRetryableError } from '../api/retryFetch';

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('retries a transient 503 and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('temporarily unavailable', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = fetchWithRetry(
      'https://example.test/data',
      undefined,
      {
        maxRetries: 1,
        initialDelay: 1,
        maxDelay: 1,
        factor: 1,
        timeoutMs: 1000,
      },
    );

    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-transient 400 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('bad request', {
        status: 400,
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchWithRetry('https://example.test/data', undefined, {
        maxRetries: 3,
        initialDelay: 1,
        maxDelay: 1,
        factor: 1,
        timeoutMs: 1000,
      }),
    ).rejects.toThrow('HTTP Error 400');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries an internal timeout and succeeds on the next attempt', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true },
          );
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ recovered: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = fetchWithRetry(
      'https://example.test/data',
      undefined,
      {
        maxRetries: 1,
        initialDelay: 1,
        maxDelay: 1,
        factor: 1,
        timeoutMs: 5,
      },
    );

    await vi.runAllTimersAsync();

    await expect(resultPromise).resolves.toEqual({ recovered: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('honors caller cancellation without retrying', async () => {
    const callerController = new AbortController();
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => {
              const error = new Error('aborted');
              error.name = 'AbortError';
              reject(error);
            },
            { once: true },
          );
        }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const resultPromise = fetchWithRetry(
      'https://example.test/data',
      { signal: callerController.signal },
      {
        maxRetries: 3,
        initialDelay: 1,
        maxDelay: 1,
        factor: 1,
        timeoutMs: 1000,
      },
    );

    const rejection = expect(resultPromise).rejects.toMatchObject({ name: 'AbortError' });
    callerController.abort();
    await vi.runAllTimersAsync();

    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('isRetryableError', () => {
  it('treats browser network TypeErrors as retryable', () => {
    expect(isRetryableError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('does not retry caller-style AbortErrors', () => {
    const error = new Error('aborted');
    error.name = 'AbortError';

    expect(isRetryableError(error)).toBe(false);
  });
});
