
/**
 * Utility for making fetch requests with retry capability
 */

interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  factor: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  factor: 2
};

/**
 * Calculate the delay time for exponential backoff
 */
function getBackoffDelay(retryCount: number, options: RetryOptions): number {
  const delay = Math.min(
    options.initialDelay * Math.pow(options.factor, retryCount),
    options.maxDelay
  );
  
  // Add some jitter to prevent all clients from retrying at exactly the same time
  return delay * (0.8 + Math.random() * 0.4);
}

/**
 * Fetch with automatic retry using exponential backoff
 */
export async function fetchWithRetry(
  url: string, 
  options?: RequestInit, 
  retryOptions: Partial<RetryOptions> = {}
): Promise<any> {
  const fullRetryOptions: RetryOptions = { ...DEFAULT_OPTIONS, ...retryOptions };
  
  let lastError: Error | null = null;
  
  for (let retryCount = 0; retryCount <= fullRetryOptions.maxRetries; retryCount++) {
    try {
      // Add timeout to fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const fetchOptions = {
        ...options,
        signal: controller.signal
      };
      
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    } catch (error: any) {
      lastError = error;
      
      // If we've reached the max retries or the error is not retryable, throw it
      if (
        retryCount >= fullRetryOptions.maxRetries || 
        error.name === 'AbortError' || 
        (options?.signal as AbortSignal)?.aborted
      ) {
        throw error;
      }
      
      // Calculate delay time
      const delay = getBackoffDelay(retryCount, fullRetryOptions);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Continue to next retry
      console.log(`Retrying fetch (${retryCount + 1}/${fullRetryOptions.maxRetries}) after ${delay}ms`);
    }
  }
  
  // This should never be reached because of the throw in the loop,
  // but TypeScript needs this
  throw lastError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const nonRetryableErrors = [
    'AbortError',        // User aborted the request
    'NotAllowedError',   // Security error
    'SecurityError',     // CORS or other security error
    'TypeError'          // Usually indicates a network error
  ];
  
  // Don't retry if error is in the non-retryable list
  if (nonRetryableErrors.includes(error.name)) {
    return false;
  }
  
  // Consider network errors retryable
  const networkErrorMessages = [
    'Failed to fetch',
    'NetworkError',
    'Network request failed',
    'network error',
    'timeout',
    'connection',
    'ECONNREFUSED',
    'ECONNRESET'
  ];
  
  return networkErrorMessages.some(msg => 
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}
