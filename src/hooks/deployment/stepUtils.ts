import { DeploymentStep, CloudProvider, DeploymentEnvironment } from '../../types/deployment';
import { createDeploymentError } from '../../services/deployment/errorHandling';
import { UseDeploymentProcessProps } from './types';
import { toast } from '@/hooks/use-toast';

/**
 * Find a deployment step by its ID
 */
export const findStepById = (
  stepId: string,
  deploymentSteps: DeploymentStep[]
): DeploymentStep | undefined => {
  return deploymentSteps.find(step => step.id === stepId);
};

/**
 * Validates if the environment is ready for step execution
 */
export const validateExecutionEnvironment = (
  stepId: string,
  props: UseDeploymentProcessProps
): { valid: boolean; error?: Error } => {
  const { deploymentSteps, isConnected, addLog, deploymentConfig, environment } = props;
  
  if (!deploymentConfig) {
    const configError = createDeploymentError(
      { code: 'DEPLOY_CONFIG_001', message: 'Deployment configuration is not set' },
      undefined,
      'aws',
      environment
    );
    addLog(configError.message, 'error');
    return { valid: false, error: new Error(configError.message) };
  }

  const step = findStepById(stepId, deploymentSteps);
  if (!step) {
    const stepError = createDeploymentError(
      { code: 'DEPLOY_RESOURCE_001', message: `Step with id ${stepId} not found` },
      undefined,
      deploymentConfig.provider,
      environment
    );
    addLog(stepError.message, 'error');
    return { valid: false, error: new Error(stepError.message) };
  }

  // Enhanced environment-specific validation
  if (environment === 'production') {
    // For production, perform stricter validation checks
    if (step.id === 'finalize' || step.id === 'monitoring') {
      // Validate that security and infrastructure steps are complete
      const requiredSteps = ['prerequisites', 'infrastructure'];
      const completedRequiredSteps = requiredSteps.every(reqStepId => {
        const reqStep = findStepById(reqStepId, deploymentSteps);
        return reqStep?.status === 'success';
      });
      
      if (!completedRequiredSteps) {
        const envError = createDeploymentError(
          { 
            code: 'DEPLOY_ENV_002', 
            message: 'Production environment requires all prerequisite steps to be completed successfully' 
          },
          step,
          deploymentConfig.provider,
          environment
        );
        addLog(`[${step.title}] - ${envError.message}`, 'warning');
        return { valid: false, error: new Error(envError.message) };
      }
    }
  }

  if (!isConnected && step.id !== 'connect-cluster') {
    const connectionError = createDeploymentError(
      { code: 'DEPLOY_CONN_001', message: 'Not connected to the cluster' },
      step,
      deploymentConfig.provider,
      environment
    );
    addLog(`[${step.title}] - ${connectionError.message}`, 'warning');
    return { valid: false, error: new Error(connectionError.message) };
  }

  return { valid: true };
};

/**
 * Handles successful step execution
 */
export const handleStepSuccess = (
  stepId: string,
  step: DeploymentStep,
  logs: string[] | undefined,
  updateStep: (stepId: string, updates: Partial<DeploymentStep>) => void,
  addLog: (message: string, type?: 'info' | 'error' | 'warning' | 'success') => void
): void => {
  updateStep(stepId, { 
    status: 'success', 
    progress: 100,
    outputLog: logs || []
  });
  
  addLog(`[${step.title}] - Completed successfully.`, 'success');
};

/**
 * Handles failed step execution
 */
export const handleStepFailure = (
  stepId: string,
  step: DeploymentStep,
  error: any,
  updateStep: (stepId: string, updates: Partial<DeploymentStep>) => void,
  addLog: (message: string, type?: 'info' | 'error' | 'warning' | 'success') => void,
  provider: CloudProvider,
  environment: DeploymentEnvironment
): void => {
  const deployError = createDeploymentError(error, step, provider, environment);
  
  updateStep(stepId, {
    status: 'error',
    progress: 0,
    errorMessage: deployError.message,
    errorCode: deployError.code,
    errorDetails: deployError.details
  });
  
  addLog(`[${step.title}] - ${getUserFriendlyErrorMessage(deployError)}`, 'error');
  
  toast({
    title: "Step Failed",
    description: getUserFriendlyErrorMessage(deployError, true),
    variant: "destructive",
    duration: 5000,
  });
};

/**
 * Validates environment variables required for deployment
 */
export const validateEnvironmentVariables = (
  environment: DeploymentEnvironment
): { valid: boolean; missing: string[] } => {
  const requiredVars = ['AWS_REGION'];
  
  if (environment === 'production') {
    requiredVars.push('AWS_ACCOUNT_ID', 'DEPLOYMENT_ROLE_ARN');
  }
  
  const missing = requiredVars.filter(envVar => !process.env[envVar]);
  
  return {
    valid: missing.length === 0,
    missing
  };
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
