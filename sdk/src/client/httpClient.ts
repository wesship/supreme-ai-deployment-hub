/**
 * Low-level HTTP client for the D3VONN.IO Runtime API.
 * Handles authentication, serialization, error mapping, and retries.
 */

import type { DevonnClientConfig, ApiError } from "../types/index.js";
import { DevonnApiError } from "../types/index.js";
import { withRetry, RetryableError, NetworkError, isRetryableStatusCode } from "../utils/retry.js";

const DEFAULT_BASE_URL = "https://api.d3vonn.io/v1/runtime";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;

export interface RawResponse<T> {
  data: T;
  headers: Record<string, string>;
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;
  private readonly extraHeaders: Record<string, string>;

  constructor(config: DevonnClientConfig) {
    this.baseUrl = config.baseUrl?.replace(/\/$/, "") ?? DEFAULT_BASE_URL;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.extraHeaders = (config as Record<string, unknown>)["headers"] as Record<string, string> ?? {};
  }

  async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = this.buildUrl(path, params);
    return withRetry(
      () => this.doRequest<T>("GET", url, undefined),
      { maxRetries: this.maxRetries, baseDelayMs: this.retryBaseDelayMs }
    );
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return withRetry(
      () => this.doRequest<T>("POST", url, body),
      { maxRetries: this.maxRetries, baseDelayMs: this.retryBaseDelayMs }
    );
  }

  // Fixed: removed invalid <void> type parameter from method name
  async delete(path: string): Promise<void> {
    const url = this.buildUrl(path);
    return withRetry(
      () => this.doRequest<void>("DELETE", url, undefined),
      { maxRetries: this.maxRetries, baseDelayMs: this.retryBaseDelayMs }
    );
  }

  /**
   * Low-level request that returns both data and response headers.
   * Used by DevonnClient to capture rate limit and tenant headers.
   */
  async requestRaw<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      params?: Record<string, string | number>;
    }
  ): Promise<RawResponse<T>> {
    const url = this.buildUrl(path, options?.params);
    return withRetry(
      () => this.doRequestRaw<T>(method, url, options?.body),
      { maxRetries: this.maxRetries, baseDelayMs: this.retryBaseDelayMs }
    );
  }

  private buildUrl(path: string, params?: Record<string, string | number>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private async doRequest<T>(method: string, url: string, body: unknown): Promise<T> {
    const raw = await this.doRequestRaw<T>(method, url, body);
    return raw.data;
  }

  private async doRequestRaw<T>(method: string, url: string, body: unknown): Promise<RawResponse<T>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "devonn-sdk/1.0.0",
          ...this.extraHeaders,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new NetworkError(`Request timed out after ${this.timeoutMs}ms: ${url}`);
      }
      throw new NetworkError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }

    // Capture response headers for rate limit tracking
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    if (response.status === 204) {
      return { data: undefined as unknown as T, headers };
    }

    let data: unknown;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const apiError = (data as ApiError) ?? { code: "UNKNOWN", message: String(data) };
      const err = isRetryableStatusCode(response.status)
        ? new RetryableError(response.status, apiError.message)
        : new DevonnApiError(response.status, apiError);
      // Attach headers so TenantAwareClient can read Retry-After
      Object.assign(err, { headers });
      throw err;
    }

    return { data: data as T, headers };
  }
}
