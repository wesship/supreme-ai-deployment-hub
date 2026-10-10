
import { CloudProvider, DeploymentEnvironment, DeploymentStep } from '../../types/deployment';
import { createLogger } from './loggingService';

// Define error severity levels
export type ErrorSeverity = 'critical' | 'major' | 'minor' | 'warning' | 'info';

// Define error categories for better classification
export type ErrorCategory = 
  | 'authentication' 
  | 'authorization' 
  | 'configuration' 
  | 'connection'
  | 'resource' 
  | 'validation' 
  | 'timeout'
  | 'dependency'
  | 'execution'
  | 'unknown';

// Define a structured error object for deployment
export interface DeploymentError {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  provider?: CloudProvider;
  step?: string;
  timestamp: Date;
  details?: Record<string, any>;
  originalError?: Error;
  recoverable: boolean;
  recommendedAction?: string;
}

// Define error codes and their default metadata
interface ErrorDefinition {
  code: string;
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  recommendedAction?: string;
}

// Standard error definitions for common deployment errors
const standardErrors: Record<string, ErrorDefinition> = {
  'DEPLOY_AUTH_001': {
    code: 'DEPLOY_AUTH_001',
    message: 'Authentication failed with cloud provider',
    category: 'authentication',
    severity: 'critical',
    recoverable: true,
    recommendedAction: 'Check credentials and try again'
  },
  'DEPLOY_AUTH_002': {
    code: 'DEPLOY_AUTH_002',
    message: 'Insufficient permissions for deployment operation',
    category: 'authorization',
    severity: 'critical',
    recoverable: false,
    recommendedAction: 'Contact your administrator to grant necessary permissions'
  },
  'DEPLOY_CONFIG_001': {
    code: 'DEPLOY_CONFIG_001',
    message: 'Invalid deployment configuration',
    category: 'configuration',
    severity: 'major',
    recoverable: true,
    recommendedAction: 'Correct configuration settings and try again'
  },
  'DEPLOY_CONN_001': {
    code: 'DEPLOY_CONN_001',
    message: 'Failed to connect to cluster',
    category: 'connection',
    severity: 'critical',
    recoverable: true,
    recommendedAction: 'Check network connectivity and cluster endpoint'
  },
  'DEPLOY_RESOURCE_001': {
    code: 'DEPLOY_RESOURCE_001',
    message: 'Resource not found',
    category: 'resource',
    severity: 'major',
    recoverable: false,
    recommendedAction: 'Verify resource name and try again'
  },
  'DEPLOY_TIMEOUT_001': {
    code: 'DEPLOY_TIMEOUT_001',
    message: 'Operation timed out',
    category: 'timeout',
    severity: 'major',
    recoverable: true,
    recommendedAction: 'Increase timeout value or check resource health'
  },
  'DEPLOY_DEP_001': {
    code: 'DEPLOY_DEP_001',
    message: 'Dependency step failed',
    category: 'dependency',
    severity: 'major',
    recoverable: false,
    recommendedAction: 'Fix the failed dependency step first'
  },
  'DEPLOY_UNKNOWN': {
    code: 'DEPLOY_UNKNOWN',
    message: 'Unknown deployment error',
    category: 'unknown',
    severity: 'major',
    recoverable: false,
    recommendedAction: 'Check logs for more details'
  }
};

/**
 * Maps cloud provider specific error codes to our standard error codes
 * @param errorCode Provider-specific error code
 * @param provider Cloud provider
 * @returns Standard error code
 */
export const mapProviderErrorCode = (errorCode: string, provider: CloudProvider): string => {
  // AWS error mappings
  const awsMappings: Record<string, string> = {
    'AccessDeniedException': 'DEPLOY_AUTH_002',
    'AuthFailure': 'DEPLOY_AUTH_001',
    'InvalidParameterException': 'DEPLOY_CONFIG_001',
    'ResourceNotFoundException': 'DEPLOY_RESOURCE_001',
    'RequestTimeout': 'DEPLOY_TIMEOUT_001',
    // Add more mappings as needed
  };
  
  // Azure error mappings
  const azureMappings: Record<string, string> = {
    'AuthorizationFailed': 'DEPLOY_AUTH_002',
    'InvalidAuthenticationTokenTenant': 'DEPLOY_AUTH_001',
    'ResourceNotFound': 'DEPLOY_RESOURCE_001',
    'GatewayTimeout': 'DEPLOY_TIMEOUT_001',
    // Add more mappings as needed
  };
  
  // GCP error mappings
  const gcpMappings: Record<string, string> = {
    'PERMISSION_DENIED': 'DEPLOY_AUTH_002',
    'UNAUTHENTICATED': 'DEPLOY_AUTH_001',
    'NOT_FOUND': 'DEPLOY_RESOURCE_001',
    'DEADLINE_EXCEEDED': 'DEPLOY_TIMEOUT_001',
    // Add more mappings as needed
  };
  
  // Select mapping based on provider
  const mapping = provider === 'aws' ? awsMappings :
                 provider === 'azure' ? azureMappings :
                 provider === 'gcp' ? gcpMappings : {};
  
  // Return mapped code or DEPLOY_UNKNOWN if not found
  return mapping[errorCode] || 'DEPLOY_UNKNOWN';
};

/**
 * Creates a standardized deployment error from any caught error
 * @param error Original error that was caught
 * @param step Deployment step where the error occurred
 * @param provider Cloud provider
 * @param environment Deployment environment
 * @returns Structured DeploymentError object
 */
export const createDeploymentError = (
  error: any,
  step?: DeploymentStep,
  provider: CloudProvider = 'aws',
  environment: DeploymentEnvironment = 'development'
): DeploymentError => {
  const logger = createLogger(environment, provider);
  
  // Extract error code from various error shapes
  const errorCode = error.code || error.errorCode || error.name || 'DEPLOY_UNKNOWN';
  
  // Map provider-specific error code to our standard codes
  const standardErrorCode = mapProviderErrorCode(errorCode, provider);
  const standardError = standardErrors[standardErrorCode];
  
  // Extract error message
  const errorMessage = error.message || error.errorMessage || 'An unknown error occurred';
  
  // Create structured error
  const deploymentError: DeploymentError = {
    code: standardError?.code || errorCode,
    message: standardError?.message || errorMessage,
    category: standardError?.category || 'unknown',
    severity: standardError?.severity || 'major',
    provider,
    step: step?.id,
    timestamp: new Date(),
    details: {
      ...error.details,
      ...error.errorDetails,
      originalCode: errorCode,
      originalMessage: errorMessage,
      environment,
      stepTitle: step?.title
    },
    originalError: error instanceof Error ? error : new Error(errorMessage),
    recoverable: standardError?.recoverable ?? false,
    recommendedAction: standardError?.recommendedAction || 'Contact support for assistance'
  };
  
  // Log the structured error
  logger.error(`[${deploymentError.code}] ${deploymentError.message}`, deploymentError.details);
  
  return deploymentError;
};

/**
 * Updates DeploymentStep with error information
 * @param step Deployment step to update
 * @param error Deployment error
 * @returns Updated DeploymentStep
 */
export const updateStepWithError = (
  step: DeploymentStep, 
  error: DeploymentError
): Partial<DeploymentStep> => {
  return {
    status: 'error',
    progress: 0,
    errorMessage: error.message,
    errorCode: error.code,
    errorDetails: {
      category: error.category,
      severity: error.severity,
      recoverable: error.recoverable,
      recommendedAction: error.recommendedAction,
      timestamp: error.timestamp.toISOString(),
      ...error.details
    }
  };
};

/**
 * Creates a user-friendly error message based on the environment and error details
 * @param error Deployment error
 * @param includeDetails Whether to include technical details
 * @returns User-friendly error message
 */
export const getUserFriendlyErrorMessage = (
  error: DeploymentError,
  includeDetails: boolean = false
): string => {
  let message = `${error.message}`;
  
  if (error.recommendedAction) {
    message += `. ${error.recommendedAction}`;
  }
  
  if (includeDetails && error.details) {
    message += ` (Error code: ${error.code})`;
  }
  
  return message;
};

/**
 * Determines if an error is recoverable automatically
 * @param error Deployment error to evaluate
 * @returns True if the error can be automatically recovered from
 */
export const canAutoRecover = (error: DeploymentError): boolean => {
  // Automatically recoverable error categories
  const autoRecoverableCategories: ErrorCategory[] = ['timeout', 'connection'];
  
  return error.recoverable && autoRecoverableCategories.includes(error.category);
};
