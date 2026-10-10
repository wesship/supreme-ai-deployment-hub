
import { useCallback, useState } from 'react';
import { createLogger } from '../../services/deployment/loggingService';
import { UseDeploymentProcessProps, UseDeploymentProcess, RetryStrategy, DEFAULT_RETRY_STRATEGY } from './types';
import { 
  runDeploymentStep,
  retryDeploymentStep, 
  startDeploymentProcess, 
  cancelDeploymentProcess 
} from './deploymentActions';

/**
 * Hook that handles the deployment process workflow
 */
export const useDeploymentProcess = (props: UseDeploymentProcessProps): UseDeploymentProcess => {
  const [isDeploying, setIsDeploying] = useState(false);
  const logger = createLogger(props.environment, props.deploymentConfig?.provider || 'aws');

  // Run a deployment step with optional timeout and retry strategy
  const runStep = useCallback(async (
    stepId: string, 
    timeoutMs: number = 120000,
    retryStrategy?: Partial<RetryStrategy>
  ): Promise<boolean> => {
    return runDeploymentStep(
      stepId, 
      props, 
      timeoutMs,
      { ...DEFAULT_RETRY_STRATEGY, ...retryStrategy }
    );
  }, [props]);

  // Retry a failed step
  const retryStep = useCallback(async (
    stepId: string,
    retryStrategy?: Partial<RetryStrategy>
  ): Promise<boolean> => {
    return retryDeploymentStep(stepId, props, retryStrategy);
  }, [props]);

  // Start the entire deployment process
  const startDeployment = useCallback(async (): Promise<void> => {
    await startDeploymentProcess(props, isDeploying, setIsDeploying);
  }, [props, isDeploying]);

  // Cancel an ongoing deployment
  const cancelDeployment = useCallback(() => {
    cancelDeploymentProcess(isDeploying, setIsDeploying, props.addLog);
  }, [isDeploying, props.addLog]);

  return { isDeploying, runStep, retryStep, startDeployment, cancelDeployment };
};
