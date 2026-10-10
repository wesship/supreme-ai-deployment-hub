
import { createApiClient, ApiClientConfig, handleApiError } from './apiClient';
import { toast } from '@/hooks/use-toast';

// Create the default API client configuration
const defaultConfig: ApiClientConfig = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
};

// Create a single unified API client instance
export const apiClient = createApiClient(defaultConfig);

/**
 * Makes an API request with standardized error handling
 * @param requestFn Function that makes the actual API request
 * @param errorMessage Custom error message to display on failure
 * @param options Additional options for error handling
 */
export const makeApiRequest = async <T>(
  requestFn: () => Promise<T>,
  errorMessage: string,
  options: {
    rethrow?: boolean;
    logLevel?: 'error' | 'warn' | 'info';
    addToast?: boolean;
    toastOptions?: {
      title?: string;
      description?: string;
      variant?: 'default' | 'destructive' | 'success';
    };
  } = {}
): Promise<T | null> => {
  const { 
    rethrow = true, 
    logLevel = 'error', 
    addToast = true,
    toastOptions = {}
  } = options;
  
  try {
    return await requestFn();
  } catch (error) {
    // Show toast notification if enabled
    if (addToast) {
      const { title = 'Error', description = errorMessage, variant = 'destructive' } = toastOptions;
      toast({
        title,
        description,
        variant,
        duration: 5000,
      });
    }
    
    // Use the existing error handler
    return handleApiError(
      error,
      errorMessage,
      { rethrow, logLevel }
    );
  }
};

// Export all from the original apiClient for backward compatibility
export * from './apiClient';
