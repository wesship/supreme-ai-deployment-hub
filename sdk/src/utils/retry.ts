/**
 * Exponential backoff retry utility with jitter.
 * Retries on network errors and 429/5xx HTTP responses.
 */

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
}

/**
 * Executes an async function with exponential backoff retry.
 * Jitter is added to prevent thundering herd on 429 responses.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      const isRetryable =
        err instanceof RetryableError ||
        (err instanceof NetworkError);

      if (!isRetryable || attempt === options.maxRetries) {
        throw err;
      }

      const baseDelay = options.baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * baseDelay * 0.3;
      const delay = Math.min(baseDelay + jitter, 30000);

      await sleep(delay);
    }
  }

  throw lastError;
}

export class RetryableError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "RetryableError";
    this.statusCode = statusCode;
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export function isRetryableStatusCode(statusCode: number): boolean {
  return RETRYABLE_STATUS_CODES.has(statusCode);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
