
import { UseDeploymentProcessProps, RetryStrategy } from '../types';
import { executeWithRetry } from '../retry/retryStrategy';
import { canAutoRecover } from '../../../services/deployment/errorHandling';
import { validateDeploymentConfig } from '../../../services/deployment/configValidation';
import { createDeploymentError } from '../../../services/deployment/errorHandling';
import { createLogger } from '../../../services/deployment/loggingService';
import { findStepById, validateExecutionEnvironment } from '../stepUtils';
import { executeStepCommand, executeConnectStep } from './specialSteps';

/**
 * Executes a deployment step with enhanced error handling and retry logic
 * @param stepId ID of the step to execute
 * @param props Deployment process props
 * @param timeoutMs Timeout in milliseconds
 * @param retryStrategy Optional retry strategy
 * @returns Promise resolving to true if successful, false otherwise
 */
export const executeDeploymentStep = async (
  stepId: string,
  props: UseDeploymentProcessProps,
  timeoutMs: number = 120000,
  retryStrategy?: Partial<RetryStrategy>
): Promise<boolean> => {
  const { 
    deploymentSteps, 
    updateStep, 
    setCurrentStep, 
    addLog, 
    deploymentConfig, 
    environment 
  } = props;
  
  // Create a logger for this operation
  const logger = createLogger(environment, deploymentConfig?.provider || 'aws');
  
  // Validate deployment configuration before proceeding
  const validationResult = validateDeploymentConfig(deploymentConfig, environment);
  if (!validationResult.valid) {
    const configError = createDeploymentError(
      { code: 'DEPLOY_CONFIG_001', message: `Deployment configuration is invalid: ${validationResult.errors.join(', ')}` },
      undefined,
      'aws',
      environment
    );
    addLog(getUserFriendlyErrorMessage(configError), 'error');
    return false;
  }

  // Validate execution environment
  const validationCheck = validateExecutionEnvironment(stepId, props);
  if (!validationCheck.valid) {
    return false;
  }

  const step = findStepById(stepId, deploymentSteps)!; // We already validated this exists
  setCurrentStep(stepId);
  updateStep(stepId, { status: 'in-progress', progress: 0, outputLog: [] });
  addLog(`[${step.title}] - Starting...`);

  // Create a complete retry strategy by merging with defaults
  const completeRetryStrategy: RetryStrategy = {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffFactor: 2,
    maxDelayMs: 30000,
    ...retryStrategy
  };

  // Execute the step operation with retry capabilities
  try {
    return await executeWithRetry(
      // The operation to execute
      async (attemptNumber) => {
        // If this is a retry attempt, log it
        if (attemptNumber > 0) {
          addLog(`[${step.title}] - Retry attempt ${attemptNumber + 1}...`, 'info');
        }
        
        if (step.id === 'connect-cluster') {
          return await executeConnectStep(step, stepId, props);
        } else {
          return await executeStepCommand(step, stepId, props, timeoutMs);
        }
      },
      // Function to determine if we can retry
      (error) => canAutoRecover(error),
      // Retry strategy
      completeRetryStrategy,
      // On retry callback
      (attemptNumber, delay) => {
        addLog(
          `[${step.title}] - Command failed, will retry in ${Math.round(delay / 1000)} seconds...`, 
          'warning'
        );
      }
    );
  } catch (error: any) {
    // This will be called if all retries failed or the error is not recoverable
    logger.error(`[${step.title}] - All retry attempts failed:`, {
      error,
      stack: error.stack
    });
    
    const executionError = createDeploymentError(
      error,
      step,
      deploymentConfig?.provider || 'aws',
      environment
    );
    
    addLog(`[${step.title}] - ${getUserFriendlyErrorMessage(executionError)}`, 'error');
    updateStep(stepId, { 
      status: 'error',
      progress: 0,
      errorMessage: executionError.message,
      errorCode: executionError.code,
      errorDetails: executionError.details
    });
    
    return false;
  }
};

/**
 * Get a user-friendly error message
 */
const getUserFriendlyErrorMessage = (error: any, isDetailed?: boolean): string => {
  if (isDetailed) {
    return error.message;
  }
  return error.message.split(':')[0];
};
