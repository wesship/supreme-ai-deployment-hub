
import { DeploymentStep } from '../../../types/deployment';
import { UseDeploymentProcessProps } from '../types';
import { CloudCommandResult, executeCloudCommand } from '../../../services/deployment/cloudExecutionService';
import { createLogger } from '../../../services/deployment/loggingService';
import { handleStepSuccess, handleStepFailure } from '../stepUtils';
import { createDeploymentError, getUserFriendlyErrorMessage, canAutoRecover } from '../../../services/deployment/errorHandling';
import { toast } from '@/hooks/use-toast';

/**
 * Executes a command for a deployment step
 */
export const executeStepCommand = async (
  step: DeploymentStep,
  stepId: string,
  props: UseDeploymentProcessProps,
  timeoutMs: number
): Promise<boolean> => {
  const { deploymentConfig, environment, updateStep, addLog } = props;
  const logger = createLogger(environment, deploymentConfig?.provider || 'aws');

  if (!step.command) {
    addLog(`[${step.title}] - No command to execute.`, 'warning');
    updateStep(stepId, { status: 'warning', progress: 100, outputLog: ['No command to execute.'] });
    return true;
  }

  try {
    const commandResult = await executeCloudCommand({
      command: step.command,
      provider: deploymentConfig?.provider || 'aws',
      timeout: timeoutMs,
      environment: environment,
      onProgress: (progress: number) => {
        updateStep(stepId, { progress: progress });
      },
      retryCount: 1 // Internal retry handled by command execution
    });

    if (commandResult.logs) {
      commandResult.logs.forEach(log => addLog(`[${step.title}] - ${log}`));
    }

    if (commandResult.success) {
      handleStepSuccess(stepId, step, commandResult.logs, updateStep, addLog);
      return true;
    } else {
      // Create structured error from command failure
      const commandError = createDeploymentError(
        {
          code: commandResult.errorCode || 'DEPLOY_UNKNOWN',
          message: commandResult.error || 'Command execution failed',
          details: commandResult.errorDetails
        },
        step,
        deploymentConfig?.provider || 'aws',
        environment
      );
      
      // Log friendly error message
      addLog(`[${step.title}] - ${getUserFriendlyErrorMessage(commandError, true)}`, 'error');
      
      // Add toast notification for command error
      toast({
        title: "Command Error",
        description: `${step.title}: ${commandResult.error || 'Execution failed'}`,
        variant: "destructive",
        duration: 5000,
      });
      
      // Update step with error details
      updateStep(stepId, {
        status: 'error',
        progress: 0,
        errorMessage: commandError.message,
        errorCode: commandError.code,
        errorDetails: commandError.details
      });
      
      // Check if auto-recovery should be attempted for certain errors
      if (canAutoRecover(commandError) && step.id !== 'connect-cluster') {
        addLog(`[${step.title}] - Attempting automatic recovery...`, 'info');
        // Logic for auto-recovery would go here in a real implementation
      }
      
      return false;
    }
  } catch (error: any) {
    logger.error(`[${step.title}] - Execution error:`, { error, stack: error.stack });
    handleStepFailure(stepId, step, error, updateStep, addLog, deploymentConfig?.provider || 'aws', environment);
    
    toast({
      title: "Execution Error",
      description: `${step.title}: ${error.message || 'Unknown error'}`,
      variant: "destructive",
      duration: 5000,
    });
    
    return false;
  }
};

/**
 * Executes the special connect-to-cluster step
 */
export const executeConnectStep = async (
  step: DeploymentStep,
  stepId: string,
  props: UseDeploymentProcessProps
): Promise<boolean> => {
  const { connectToCluster, updateStep, addLog, deploymentConfig, environment } = props;
  
  try {
    const success = await connectToCluster();
    if (success) {
      updateStep(stepId, { status: 'success', progress: 100 });
      
      toast({
        title: "Connection Successful",
        description: "Successfully connected to cluster",
        variant: "success",
        duration: 3000,
      });
      
      return true;
    } else {
      const connectionError = createDeploymentError(
        { code: 'DEPLOY_CONN_001', message: 'Failed to connect to cluster' },
        step,
        deploymentConfig?.provider || 'aws',
        environment
      );
      updateStep(stepId, {
        status: 'error',
        progress: 0,
        errorMessage: connectionError.message,
        errorCode: connectionError.code,
        errorDetails: connectionError.details
      });
      addLog(`[${step.title}] - ${getUserFriendlyErrorMessage(connectionError)}`, 'error');
      
      toast({
        title: "Connection Failed",
        description: "Failed to connect to cluster",
        variant: "destructive",
        duration: 5000,
      });
      
      return false;
    }
  } catch (error) {
    const connectionError = createDeploymentError(
      error,
      step,
      deploymentConfig?.provider || 'aws',
      environment
    );
    updateStep(stepId, {
      status: 'error',
      progress: 0,
      errorMessage: connectionError.message,
      errorCode: connectionError.code,
      errorDetails: connectionError.details
    });
    addLog(`[${step.title}] - ${getUserFriendlyErrorMessage(connectionError)}`, 'error');
    
    toast({
      title: "Connection Error",
      description: connectionError.message || "Failed to connect to cluster",
      variant: "destructive",
      duration: 5000,
    });
    
    return false;
  }
};
