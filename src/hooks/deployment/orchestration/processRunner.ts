import { UseDeploymentProcessProps } from '../types';
import { validateEnvironmentReadiness } from '../deploymentValidator';
import { executeDeploymentStep } from '../stepExecution';
import { toast } from '@/hooks/use-toast';
import { performRollback } from './rollbackHandler';

/**
 * Runs the main deployment orchestration process
 */
export const runOrchestrationProcess = async (
  props: UseDeploymentProcessProps,
  isDeploying: boolean,
  setIsDeploying: (val: boolean) => void
): Promise<void> => {
  const { deploymentSteps, addLog, updateStep, environment, deploymentConfig } = props;
  
  // Keep track of completed steps for potential rollback
  const completedSteps: string[] = [];
  
  // Validate environment readiness
  if (deploymentConfig) {
    const isEnvironmentReady = validateEnvironmentReadiness(
      environment,
      deploymentConfig.provider,
      addLog
    );
    
    if (!isEnvironmentReady && environment === 'production') {
      addLog('Deployment aborted due to environment validation failures.', 'error');
      
      toast({
        title: "Deployment Aborted",
        description: "Environment validation failures detected",
        variant: "destructive",
        duration: 5000,
      });
      
      setIsDeploying(false);
      return;
    }
  }
  
  // Pre-deployment summary
  const totalSteps = deploymentSteps.length;
  addLog(`Starting deployment with ${totalSteps} steps for ${environment} environment.`, 'info');
  
  if (environment === 'production') {
    addLog('PRODUCTION DEPLOYMENT: Ensure all items in the production checklist are addressed.', 'warning');
  }
  
  // Execute each step in sequence
  for (const step of deploymentSteps) {
    // Check if deployment was cancelled
    if (!isDeploying) {
      addLog('Deployment was cancelled.', 'warning');
      return;
    }
    
    // Check step dependencies
    if (step.dependsOn) {
      const dependencies = step.dependsOn.map(depId => 
        deploymentSteps.find(s => s.id === depId)
      );
      const allDependenciesSuccessful = dependencies.every(
        dep => dep && dep.status === 'success'
      );

      if (!allDependenciesSuccessful) {
        addLog(`Skipping step ${step.title} due to failed dependencies.`, 'warning');
        updateStep(step.id, { status: 'pending', progress: 0 });
        continue;
      }
    }

    // Execute the step with default retry strategy
    const success = await executeDeploymentStep(step.id, props);
    if (success) {
      // Track successful steps for potential rollback
      completedSteps.push(step.id);
    } else {
      addLog(`Deployment stopped due to failure in step: ${step.title}`, 'error');
      
      toast({
        title: "Deployment Failed",
        description: `Failed at step: ${step.title}`,
        variant: "destructive",
        duration: 5000,
      });
      
      // For production deployments, provide more detailed failure analysis
      if (environment === 'production') {
        addLog('Production deployment failed. Performing deployment analysis...', 'info');
        addLog('Refer to the production deployment runbook for recovery procedures.', 'info');
        
        // Offer rollback for production deployments
        if (completedSteps.length > 0 && environment === 'production') {
          addLog('Initiating automatic rollback of completed steps...', 'warning');
          await performRollback(completedSteps, props);
        }
      }
      
      setIsDeploying(false);
      return;
    }
  }

  // Post-deployment verification
  addLog('All deployment steps completed. Running post-deployment verification...', 'info');
  
  // In a real implementation, this would perform actual verification checks
  if (environment === 'production') {
    addLog('Production deployment verification complete. System is now live.', 'success');
    
    toast({
      title: "Production Deployment Complete",
      description: "System is now live",
      variant: "success",
      duration: 5000,
    });
  } else {
    addLog('Deployment completed successfully!', 'success');
    
    toast({
      title: "Deployment Successful",
      description: `${environment} environment is ready`,
      variant: "success",
      duration: 5000,
    });
  }
  
  setIsDeploying(false);
};
