
import { UseDeploymentProcessProps } from '../types';
import { toast } from '@/hooks/use-toast';

/**
 * Rolls back completed deployment steps in reverse order
 */
export const performRollback = async (
  completedStepIds: string[],
  props: UseDeploymentProcessProps
): Promise<void> => {
  const { deploymentSteps, addLog, updateStep } = props;
  
  addLog('Starting rollback procedure...', 'warning');
  
  toast({
    title: "Rollback Initiated",
    description: "Reverting deployment changes",
    variant: "warning",
    duration: 5000,
  });
  
  // Process steps in reverse order (most recent first)
  for (const stepId of [...completedStepIds].reverse()) {
    const step = deploymentSteps.find(s => s.id === stepId);
    if (!step) continue;
    
    addLog(`Rolling back: ${step.title}`, 'info');
    updateStep(stepId, { status: 'rolling-back', progress: 0 });
    
    try {
      // Check if step has a rollback handler
      if (step.rollback) {
        // Execute rollback function if available
        await step.rollback();
        addLog(`Rolled back step: ${step.title}`, 'success');
        updateStep(stepId, { status: 'rolled-back', progress: 100 });
      } else {
        // Mark as skipped if no rollback function available
        addLog(`No rollback function for step: ${step.title}. Manual intervention may be required.`, 'warning');
        updateStep(stepId, { status: 'rollback-skipped', progress: 100 });
      }
    } catch (error: any) {
      addLog(`Error during rollback of step ${step.title}: ${error.message}`, 'error');
      updateStep(stepId, { status: 'rollback-failed', progress: 0 });
      // Continue with other rollbacks even if one fails
    }
  }
  
  addLog('Rollback procedure completed. System may require additional manual recovery.', 'warning');
  
  toast({
    title: "Rollback Completed",
    description: "Manual verification recommended",
    variant: "info",
    duration: 5000,
  });
};
