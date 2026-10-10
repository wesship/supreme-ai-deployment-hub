
import { DeploymentStep } from '../../../types/deployment';
import { createLogger } from '../../../services/deployment/loggingService';
import { executeDeploymentStep } from '../stepExecution';
import { UseDeploymentProcessProps } from '../types';
import { validateEnvironmentReadiness } from '../deploymentValidator';
import { toast } from '@/hooks/use-toast';
import { runOrchestrationProcess } from './processRunner';
import { performRollback } from './rollbackHandler';

/**
 * Handles the execution of the entire deployment process
 */
export const runDeploymentProcess = async (
  props: UseDeploymentProcessProps,
  isDeploying: boolean,
  setIsDeploying: (val: boolean) => void
): Promise<void> => {
  const { addLog, environment } = props;
  const logger = createLogger(environment, props.deploymentConfig?.provider || 'aws');
  
  setIsDeploying(true);
  addLog('Deployment started.', 'success');
  
  try {
    // Run the main orchestration process
    await runOrchestrationProcess(props, isDeploying, setIsDeploying);
  } catch (error: any) {
    addLog(`Deployment failed: ${error.message}`, 'error');
    logger.error('Deployment process failed', { error });
    
    toast({
      title: "Unexpected Error",
      description: error.message || "Deployment process failed",
      variant: "destructive",
      duration: 5000,
    });
    
    setIsDeploying(false);
  }
};

// Re-export the rollback handler for direct access
export { performRollback } from './rollbackHandler';
