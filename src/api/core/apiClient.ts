
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

// Configuration options for the API client
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

/**
 * Creates and configures an API client instance
 */
export const createApiClient = (config: ApiClientConfig): AxiosInstance => {
  const defaultConfig: AxiosRequestConfig = {
    baseURL: config.baseURL,
    headers: {
      'Content-Type': 'application/json',
      ...config.headers,
    },
    timeout: config.timeout || 30000, // 30 second default timeout
  };

  return axios.create(defaultConfig);
};

// Global API client instance using environment variables
export const apiClient = createApiClient({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
});

/**
 * Enhanced error handler for API errors
 */
export const handleApiError = (
  error: unknown, 
  customMessage: string,
  options: { rethrow?: boolean; logLevel?: 'error' | 'warn' | 'info' } = {}
): never => {
  const { rethrow = true, logLevel = 'error' } = options;
  
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    const errorDetails = {
      message: axiosError.message,
      status: axiosError.response?.status,
      data: axiosError.response?.data,
      url: axiosError.config?.url
    };

    console[logLevel](`${customMessage}:`, errorDetails);
    
    if (rethrow) {
      throw error;
    }
    
    throw new Error(customMessage);
  }
  
  console[logLevel](`${customMessage} (Non-Axios error):`, error);
  throw (rethrow ? error : new Error(customMessage));
};

/**
 * Retry mechanism for API calls
 */
export const withRetry = async <T>(
  fn: () => Promise<T>,
  options: {
    retries?: number;
    delay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> => {
  const { retries = 3, delay = 1000, onRetry } = options;
  let lastError: Error;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }
      
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError!;
};
