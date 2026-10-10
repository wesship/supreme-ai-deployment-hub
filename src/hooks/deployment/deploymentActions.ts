
import { RetryStrategy } from './types';
import { executeDeploymentStep } from './stepExecution';
import { UseDeploymentProcessProps } from './types';
import { validateDeploymentBeforeStart } from './deploymentValidator';
import { runDeploymentProcess } from './orchestration/deploymentOrchestrator';
import { toast } from '@/hooks/use-toast';

/**
 * Handles running a specific deployment step
 */
export const runDeploymentStep = async (
  stepId: string,
  props: UseDeploymentProcessProps,
  timeoutMs: number = 120000,
  retryStrategy?: Partial<RetryStrategy>
): Promise<boolean> => {
  const result = await executeDeploymentStep(stepId, props, timeoutMs, retryStrategy);
  
  // Show success toast when a step completes successfully
  if (result) {
    const step = props.deploymentSteps.find(s => s.id === stepId);
    if (step) {
      toast({
        title: "Step Completed",
        description: `${step.title} was completed successfully`,
        variant: "success",
        duration: 3000,
      });
    }
  }
  
  return result;
};

/**
 * Handles retrying a failed deployment step with more aggressive retry strategy
 */
export const retryDeploymentStep = async (
  stepId: string,
  props: UseDeploymentProcessProps,
  retryStrategy?: Partial<RetryStrategy>
): Promise<boolean> => {
  const { deploymentSteps, addLog } = props;
  
  const step = deploymentSteps.find(step => step.id === stepId);
  if (!step) {
    addLog(`Step with id ${stepId} not found.`, 'error');
    return false;
  }

  if (step.status !== 'error') {
    addLog(`Step with id ${stepId} is not in error state.`, 'warning');
    return false;
  }

  addLog(`Retrying step: ${step.title}`);
  
  // Use more aggressive retry strategy for explicit retries
  const aggressiveRetryStrategy: Partial<RetryStrategy> = {
    maxAttempts: 5,
    initialDelayMs: 500,
    backoffFactor: 1.5,
    ...retryStrategy
  };
  
  return runDeploymentStep(stepId, props, 180000, aggressiveRetryStrategy); // Extended timeout for retries
};

/**
 * Initiates the deployment process
 */
export const startDeploymentProcess = async (
  props: UseDeploymentProcessProps,
  isDeploying: boolean,
  setIsDeploying: (val: boolean) => void
): Promise<void> => {
  // Validate deployment configuration first
  if (!validateDeploymentBeforeStart(props)) {
    return;
  }
  
  // Show toast when deployment starts
  toast({
    title: "Deployment Started",
    description: `Deploying to ${props.environment} environment`,
    variant: "default",
    duration: 3000,
  });
  
  // Run the deployment process
  await runDeploymentProcess(props, isDeploying, setIsDeploying);
};

/**
 * Attempts to cancel an ongoing deployment
 */
export const cancelDeploymentProcess = (
  isDeploying: boolean,
  setIsDeploying: (val: boolean) => void,
  addLog: UseDeploymentProcessProps['addLog']
): void => {
  if (!isDeploying) {
    addLog('No active deployment to cancel.', 'info');
    return;
  }
  
  setIsDeploying(false);
  addLog('Deployment cancellation requested. Waiting for current operations to complete...', 'warning');
  
  // Show toast when deployment is cancelled
  toast({
    title: "Deployment Cancelled",
    description: "The deployment process has been cancelled",
    variant: "destructive",
    duration: 3000,
  });
};
