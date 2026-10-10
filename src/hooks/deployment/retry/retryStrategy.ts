
import { RetryStrategy, DEFAULT_RETRY_STRATEGY } from '../types';

/**
 * Creates a complete retry strategy by merging defaults with provided options
 */
export const createRetryStrategy = (retryStrategy?: Partial<RetryStrategy>): RetryStrategy => {
  return {
    ...DEFAULT_RETRY_STRATEGY,
    ...retryStrategy
  };
};

/**
 * Calculates the delay for the next retry attempt with jitter
 */
export const calculateRetryDelay = (strategy: RetryStrategy, attemptNumber: number): number => {
  // Calculate backoff delay with jitter
  const baseDelay = Math.min(
    strategy.initialDelayMs * Math.pow(strategy.backoffFactor, attemptNumber),
    strategy.maxDelayMs
  );
  
  // Add 20% jitter to avoid thundering herd problem
  return baseDelay * (0.8 + Math.random() * 0.4);
};

/**
 * Executes a function with retry logic based on the provided strategy
 */
export const executeWithRetry = async <T>(
  operation: (attemptNumber: number) => Promise<T>,
  canRetry: (error: any) => boolean,
  strategy: RetryStrategy,
  onRetry?: (attemptNumber: number, delay: number) => void
): Promise<T> => {
  let attemptNumber = 0;
  
  while (true) {
    try {
      return await operation(attemptNumber);
    } catch (error) {
      attemptNumber++;
      
      if (attemptNumber >= strategy.maxAttempts || !canRetry(error)) {
        throw error;
      }
      
      const delay = calculateRetryDelay(strategy, attemptNumber);
      
      if (onRetry) {
        onRetry(attemptNumber, delay);
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};
