
/**
 * Retry mechanism for cloud operations
 */
export const retryOperation = async <T>(
  operation: () => Promise<T>,
  options: {
    retryCount: number;
    retryDelay: number;
    onRetry?: (attempt: number, error: Error) => void;
  }
): Promise<T> => {
  const { retryCount, retryDelay, onRetry } = options;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Log retry attempt
      if (onRetry) {
        onRetry(attempt, lastError);
      }
      
      // If this was the last attempt, throw the error
      if (attempt >= retryCount) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = retryDelay * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // This should never happen due to the throw in the loop
  throw new Error('Retry mechanism failed in an unexpected way');
};
