/**
 * Low-level HTTP client for the Devonn.AI Runtime API.
 * Handles authentication, serialization, error mapping, and retries.
 */

import type { DevonnClientConfig, ApiError } from "../types/index.js";
import { DevonnApiError } from "../types/index.js";
import { withRetry, RetryableError, NetworkError, isRetryableStatusCode } from "../utils/retry.js";

const DEFAULT_BASE_URL = "https://api.devonn.ai/v1/runtime";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;

export class HttpClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseDelayMs: number;

  constructor(config: DevonnClientConfig) {
    this.baseUrl = config.baseUrl?.replace(/\/$/, "") ?? DEFAULT_BASE_URL;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.retryBaseDelayMs = config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
  }

  async get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
    const url = this.buildUrl(path, params);
    return withRetry(
      () => this.request<T>("GET", url, undefined),
      { maxRetries: this.maxRetries, baseDelayMs: this.retryBaseDelayMs }
    );
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const url = this.buildUrl(path);
    return withRetry(
      () => this.request<T>("POST", url, body),
      { maxRetries: this.maxRetries, baseDelayMs: this.retryBaseDelayMs }
    );
  }

  async delete<void>(path: string): Promise<void> {
    const url = this.buildUrl(path);
    return withRetry(
      () => this.request<void>("DELETE", url, undefined),
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

  private async request<T>(method: string, url: string, body: unknown): Promise<T> {
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

    if (response.status === 204) {
      return undefined as unknown as T;
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
      if (isRetryableStatusCode(response.status)) {
        throw new RetryableError(response.status, apiError.message);
      }
      throw new DevonnApiError(response.status, apiError);
    }

    return data as T;
  }
}
