/**
 * Utility for making fetch requests with bounded retries and timeout handling.
 */

interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
  timeoutMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  factor: 2,
  timeoutMs: 30000,
};

class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function createAbortError(message = 'Request aborted'): Error {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
}

function createTimeoutError(timeoutMs: number): Error {
  const error = new Error(`Request timed out after ${timeoutMs}ms`);
  error.name = 'TimeoutError';
  return error;
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

/**
 * Calculate the delay time for exponential backoff.
 */
function getBackoffDelay(retryCount: number, options: RetryOptions): number {
  const delay = Math.min(
    options.initialDelay * Math.pow(options.factor, retryCount),
    options.maxDelay,
  );

  // Add jitter to avoid synchronized retry storms.
  return delay * (0.8 + Math.random() * 0.4);
}

function waitForRetry(delayMs: number, signal?: AbortSignal | null): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);

    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
      reject(createAbortError());
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Fetch with automatic retry using exponential backoff.
 *
 * Retries transient network failures, internal request timeouts, HTTP 408/425/429,
 * and 5xx responses. Caller-requested aborts and non-transient 4xx responses fail
 * immediately.
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryOptions: Partial<RetryOptions> = {},
): Promise<any> {
  const fullRetryOptions: RetryOptions = { ...DEFAULT_OPTIONS, ...retryOptions };
  let lastError: Error | null = null;

  for (let retryCount = 0; retryCount <= fullRetryOptions.maxRetries; retryCount++) {
    if (options?.signal?.aborted) {
      throw createAbortError();
    }

    const controller = new AbortController();
    let timedOut = false;

    const onCallerAbort = () => controller.abort();
    options?.signal?.addEventListener('abort', onCallerAbort, { once: true });

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, fullRetryOptions.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = (await response.text()).slice(0, 512);
        throw new HttpError(
          response.status,
          `HTTP Error ${response.status}${errorText ? `: ${errorText}` : ''}`,
        );
      }

      return await response.json();
    } catch (rawError: unknown) {
      const callerAborted = Boolean(options?.signal?.aborted);
      const error = timedOut
        ? createTimeoutError(fullRetryOptions.timeoutMs)
        : normalizeError(rawError);

      lastError = error;

      if (
        callerAborted ||
        retryCount >= fullRetryOptions.maxRetries ||
        !isRetryableError(error)
      ) {
        throw error;
      }

      const delay = getBackoffDelay(retryCount, fullRetryOptions);
      console.warn(
        `Retrying fetch (${retryCount + 1}/${fullRetryOptions.maxRetries}) after ${Math.round(delay)}ms: ${error.message}`,
      );
      await waitForRetry(delay, options?.signal);
    } finally {
      clearTimeout(timeoutId);
      options?.signal?.removeEventListener('abort', onCallerAbort);
    }
  }

  throw lastError ?? new Error('Fetch failed without an error');
}

/**
 * Check if an error is retryable.
 */
export function isRetryableError(error: Error): boolean {
  if (error instanceof HttpError) {
    return isRetryableStatus(error.status);
  }

  if (error.name === 'AbortError') {
    return false;
  }

  if (error.name === 'TimeoutError' || error.name === 'TypeError') {
    return true;
  }

  const networkErrorMessages = [
    'Failed to fetch',
    'NetworkError',
    'Network request failed',
    'network error',
    'timeout',
    'connection',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
  ];

  return networkErrorMessages.some((message) =>
    error.message.toLowerCase().includes(message.toLowerCase()),
  );
}
