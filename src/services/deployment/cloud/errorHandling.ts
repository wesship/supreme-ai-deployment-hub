
import { CloudProvider } from './types';

/**
 * Classify cloud provider errors for better error messages
 */
export function classifyCloudError(error: any, provider: CloudProvider): {
  errorCode: string;
  errorMessage: string;
  errorDetails?: Record<string, any>;
} {
  // Default values
  let errorCode = 'UnknownError';
  let errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
  let errorDetails = {};
  
  // Determine if this is an API error
  const isApiError = error && (
    error.response || 
    error.statusCode || 
    error.code || 
    error.name === 'HttpError' ||
    error.name === 'ApiError'
  );
  
  if (isApiError) {
    // Extract error information based on provider
    switch (provider) {
      case 'aws':
        errorCode = error.code || 'AWSError';
        
        if (error.code === 'AccessDeniedException' || error.code === 'AccessDenied') {
          errorMessage = 'AWS access denied. Please check your credentials and permissions.';
        } else if (error.code === 'ResourceNotFoundException' || error.code === 'ResourceNotFound') {
          errorMessage = 'The requested AWS resource was not found.';
        } else if (error.code === 'ValidationException' || error.code === 'ValidationError') {
          errorMessage = 'Invalid parameters for AWS operation.';
        } else if (error.code === 'ExpiredToken') {
          errorMessage = 'Your AWS credentials have expired. Please refresh them and try again.';
        } else if (error.code === 'ThrottlingException' || error.code === 'Throttling') {
          errorMessage = 'AWS API rate limit exceeded. Please retry with backoff.';
        } else if (error.code === 'NetworkingError') {
          errorMessage = 'Network connectivity issue when connecting to AWS services.';
        }
        break;
        
      case 'azure':
        errorCode = error.code || (error.response?.data?.error?.code) || 'AzureError';
        
        if (errorCode === 'AuthorizationFailed' || errorCode === 'Unauthorized') {
          errorMessage = 'Azure authorization failed. Please check your credentials and permissions.';
        } else if (errorCode === 'ResourceNotFound' || errorCode === 'ResourceGroupNotFound') {
          errorMessage = 'The requested Azure resource was not found.';
        } else if (errorCode === 'InvalidParameter' || errorCode === 'ValidationError') {
          errorMessage = 'Invalid parameters for Azure operation.';
        } else if (errorCode === 'TokenExpired') {
          errorMessage = 'Your Azure credentials have expired. Please refresh them and try again.';
        } else if (errorCode === 'TooManyRequests' || errorCode === 'RateLimitExceeded') {
          errorMessage = 'Azure API rate limit exceeded. Please retry with backoff.';
        } else if (errorCode === 'NetworkError') {
          errorMessage = 'Network connectivity issue when connecting to Azure services.';
        }
        break;
        
      case 'gcp':
        errorCode = error.code || (error.response?.data?.error?.status) || 'GCPError';
        
        if (errorCode === 'PERMISSION_DENIED' || errorCode === 'UNAUTHENTICATED') {
          errorMessage = 'GCP permission denied. Please check your credentials and permissions.';
        } else if (errorCode === 'NOT_FOUND') {
          errorMessage = 'The requested GCP resource was not found.';
        } else if (errorCode === 'INVALID_ARGUMENT' || errorCode === 'FAILED_PRECONDITION') {
          errorMessage = 'Invalid parameters for GCP operation.';
        } else if (errorCode === 'RESOURCE_EXHAUSTED') {
          errorMessage = 'GCP API rate limit exceeded. Please retry with backoff.';
        } else if (errorCode === 'UNAVAILABLE' || errorCode === 'DEADLINE_EXCEEDED') {
          errorMessage = 'GCP service unavailable or request timeout.';
        } else if (error.response?.data?.error?.message) {
          errorMessage = error.response.data.error.message;
        }
        break;
        
      case 'custom':
        errorCode = error.code || 'CustomProviderError';
        errorMessage = error.message || 'Error in custom provider implementation';
        break;
        
      default:
        // Use generic error handling for other providers
        errorCode = 'ProviderError';
        errorMessage = 'Cloud provider error occurred. Please check your configuration.';
    }
    
    // Extract detailed error information if available
    if (error.response?.data) {
      errorDetails = error.response.data;
    }
  } else if (error.message && error.message.includes('ECONNREFUSED')) {
    // Connection errors
    errorCode = 'ConnectionError';
    errorMessage = 'Could not connect to the cloud provider. Please check your network connection.';
  } else if (error.message && error.message.includes('ETIMEDOUT')) {
    errorCode = 'TimeoutError'; 
    errorMessage = 'The request to the cloud provider timed out. Please try again later.';
  } else if (error.message && error.message.includes('certificate')) {
    errorCode = 'CertificateError';
    errorMessage = 'SSL certificate validation failed. Please check your system certificates.';
  } else if (error.message && error.message.includes('rate limit')) {
    errorCode = 'RateLimitError';
    errorMessage = 'API rate limit exceeded. Please implement exponential backoff.';
  }
  
  // Add more context to error details
  errorDetails = {
    ...errorDetails,
    provider,
    timestamp: new Date().toISOString(),
    originalErrorMessage: error.message
  };
  
  return {
    errorCode,
    errorMessage,
    errorDetails
  };
}

/**
 * Enhanced error handler with retry capabilities
 */
export function handleCloudError(error: any, provider: CloudProvider, retryCount = 0, maxRetries = 3): {
  shouldRetry: boolean;
  errorClassification: ReturnType<typeof classifyCloudError>;
  retryDelay?: number;
} {
  const errorClassification = classifyCloudError(error, provider);
  let shouldRetry = false;
  let retryDelay: number | undefined = undefined;
  
  // Determine if this error is retryable
  const retryableCodes = [
    'ThrottlingException', 'Throttling', 'TooManyRequests',
    'RateLimitExceeded', 'RESOURCE_EXHAUSTED', 'UNAVAILABLE',
    'TimeoutError', 'ConnectionError', 'RequestTimeout',
    'ServiceUnavailable', 'InternalError', 'InternalServerError',
    'INTERNAL', 'DEADLINE_EXCEEDED'
  ];
  
  const isRetryableError = retryableCodes.some(code => 
    errorClassification.errorCode.includes(code) || 
    (errorClassification.errorDetails && JSON.stringify(errorClassification.errorDetails).includes(code))
  );
  
  if (isRetryableError && retryCount < maxRetries) {
    shouldRetry = true;
    // Exponential backoff with jitter
    const baseDelay = 1000; // 1 second
    const exponentialFactor = Math.pow(2, retryCount);
    const jitter = Math.random() * 0.5 + 0.5; // 0.5 to 1.0 randomization factor
    retryDelay = Math.floor(baseDelay * exponentialFactor * jitter);
  }
  
  return {
    shouldRetry,
    errorClassification,
    retryDelay
  };
}
