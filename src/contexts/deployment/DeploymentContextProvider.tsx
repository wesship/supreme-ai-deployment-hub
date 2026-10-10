
import React, { createContext, useState, useCallback, useMemo, useRef } from 'react';
import { 
  DeploymentContextType, 
  DeploymentProviderProps, 
  LogType,
  DeploymentStep,
  DeploymentEnvironment,
  CloudProvider
} from './DeploymentContextTypes';
import { useDeploymentLogs } from '@/hooks/useDeploymentLogs';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

// Default deployment steps
const defaultDeploymentSteps: DeploymentStep[] = [
  {
    id: 'validate',
    title: 'Validate Configuration',
    description: 'Validate deployment configuration and dependencies',
    status: 'pending',
    progress: 0
  },
  {
    id: 'prepare',
    title: 'Prepare Resources',
    description: 'Prepare deployment resources and environments',
    status: 'pending',
    progress: 0,
    dependencies: ['validate']
  },
  {
    id: 'deploy',
    title: 'Deploy Infrastructure',
    description: 'Deploy infrastructure components',
    status: 'pending',
    progress: 0,
    dependencies: ['prepare'],
    canRollback: true
  },
  {
    id: 'config',
    title: 'Configure Services',
    description: 'Configure deployed services and applications',
    status: 'pending',
    progress: 0,
    dependencies: ['deploy'],
    canRollback: true
  },
  {
    id: 'verify',
    title: 'Verify Deployment',
    description: 'Run tests and verify deployment success',
    status: 'pending',
    progress: 0,
    dependencies: ['config']
  }
];

// Create the context with default values
export const DeploymentContext = createContext<DeploymentContextType>({
  isDeploying: false,
  progress: 0,
  logs: [],
  status: 'idle',
  deploymentSteps: [],
  currentStep: null,
  runStep: async () => false,
  startDeployment: () => {},
  cancelDeployment: () => {},
  resetDeployment: () => {},
  addLog: () => {},
  clearLogs: () => {},
  environment: 'development',
  setEnvironment: () => {},
  provider: 'aws',
  setProvider: () => {},
  isConnected: false,
  isConnecting: false,
  connectToCluster: async () => false,
  disconnectFromCluster: () => {},
  setCloudProvider: () => {},
  setDeploymentEnvironment: () => {},
  getDeploymentSummary: () => ({})
});

export const DeploymentProvider: React.FC<DeploymentProviderProps> = ({ children }) => {
  // Basic deployment state
  const [isDeploying, setIsDeploying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error' | 'canceled'>('idle');
  const [environment, setEnvironment] = useState<string>('development');
  const [provider, setProvider] = useState<string>('aws');
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>(defaultDeploymentSteps);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  
  // Cluster connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Use the deployment logs hook
  const { 
    logs, 
    addLog: addLogInternal, 
    clearLogs: clearLogsInternal 
  } = useDeploymentLogs(
    environment as any, 
    provider as any
  );
  
  // Connect to cluster
  const connectToCluster = useCallback(async (kubeConfig?: string) => {
    if (isConnected) {
      return true;
    }
    
    setIsConnecting(true);
    addLogInternal('Connecting to Kubernetes cluster...', 'info');
    
    try {
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock successful connection
      setIsConnected(true);
      addLogInternal('Successfully connected to Kubernetes cluster', 'success');
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addLogInternal(`Failed to connect to cluster: ${errorMsg}`, 'error');
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, [isConnected, addLogInternal]);
  
  // Disconnect from cluster
  const disconnectFromCluster = useCallback(() => {
    if (!isConnected) {
      return;
    }
    
    setIsConnected(false);
    addLogInternal('Disconnected from Kubernetes cluster', 'info');
  }, [isConnected, addLogInternal]);
  
  // Run a specific deployment step
  const runStep = useCallback(async (stepId: string, timeoutMs: number = 10000) => {
    const step = deploymentSteps.find(s => s.id === stepId);
    if (!step) {
      addLogInternal(`Step ${stepId} not found`, 'error');
      return false;
    }
    
    // Check if dependencies are complete
    if (step.dependencies && step.dependencies.length > 0) {
      const incompleteDepends = step.dependencies.filter(depId => {
        const depStep = deploymentSteps.find(s => s.id === depId);
        return !depStep || depStep.status !== 'success';
      });
      
      if (incompleteDepends.length > 0) {
        addLogInternal(`Cannot run step ${step.title}: dependencies not satisfied`, 'warning');
        return false;
      }
    }
    
    // Update step status
    setDeploymentSteps(prevSteps => 
      prevSteps.map(s => s.id === stepId ? { ...s, status: 'in-progress', progress: 5 } : s)
    );
    setCurrentStep(stepId);
    
    addLogInternal(`Starting step: ${step.title}`, 'info');
    
    // Simulate step execution with progress updates
    const updateInterval = setInterval(() => {
      setDeploymentSteps(prevSteps => {
        const updatingStep = prevSteps.find(s => s.id === stepId);
        if (!updatingStep || updatingStep.progress >= 100) {
          clearInterval(updateInterval);
          return prevSteps;
        }
        
        const newProgress = Math.min(updatingStep.progress + Math.random() * 15, 99);
        return prevSteps.map(s => s.id === stepId ? { ...s, progress: newProgress } : s);
      });
    }, 800);
    
    // Simulate completion after timeout
    try {
      await new Promise(resolve => setTimeout(resolve, timeoutMs));
      
      // 10% chance of failure for demo purposes
      const success = Math.random() > 0.1;
      
      if (success) {
        setDeploymentSteps(prevSteps => 
          prevSteps.map(s => s.id === stepId ? { ...s, status: 'success', progress: 100 } : s)
        );
        addLogInternal(`Step completed successfully: ${step.title}`, 'success');
        return true;
      } else {
        setDeploymentSteps(prevSteps => 
          prevSteps.map(s => s.id === stepId ? { ...s, status: 'error', progress: Math.floor(Math.random() * 60) + 30 } : s)
        );
        addLogInternal(`Error during step: ${step.title}`, 'error');
        return false;
      }
    } catch (error) {
      setDeploymentSteps(prevSteps => 
        prevSteps.map(s => s.id === stepId ? { ...s, status: 'error', progress: Math.floor(Math.random() * 80) } : s)
      );
      addLogInternal(`Step execution error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      return false;
    } finally {
      clearInterval(updateInterval);
    }
  }, [deploymentSteps, addLogInternal]);
  
  // Start deployment
  const startDeployment = useCallback(() => {
    if (isDeploying) return;
    
    setIsDeploying(true);
    setStatus('running');
    setProgress(0);
    addLogInternal('Deployment started', 'info');
    
    // Reset all steps
    setDeploymentSteps(prevSteps => 
      prevSteps.map(step => ({ ...step, status: 'pending', progress: 0 }))
    );
    
    // Start the first step
    const firstStep = deploymentSteps.find(step => !step.dependencies || step.dependencies.length === 0);
    if (firstStep) {
      runStep(firstStep.id);
    }
    
    // Simulate deployment progress
    const interval = setInterval(() => {
      setProgress(prev => {
        const completed = deploymentSteps.filter(s => s.status === 'success').length;
        const total = deploymentSteps.length;
        const newProgress = (completed / total) * 100;
        
        if (newProgress >= 100 || status !== 'running') {
          clearInterval(interval);
          if (newProgress >= 100) {
            setStatus('success');
            setIsDeploying(false);
            addLogInternal('Deployment completed successfully', 'success');
          }
          return Math.min(newProgress, 100);
        }
        return newProgress;
      });
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isDeploying, status, deploymentSteps, addLogInternal, runStep]);
  
  // Cancel deployment
  const cancelDeployment = useCallback(() => {
    setIsDeploying(false);
    setStatus('canceled');
    addLogInternal('Deployment canceled by user', 'warning');
  }, [addLogInternal]);
  
  // Reset deployment
  const resetDeployment = useCallback(() => {
    setIsDeploying(false);
    setProgress(0);
    setStatus('idle');
    setCurrentStep(null);
    addLogInternal('Deployment reset', 'info');
    
    // Reset all steps
    setDeploymentSteps(defaultDeploymentSteps);
  }, [addLogInternal]);
  
  // Add log
  const addLog = useCallback((message: string, type: LogType = 'info', context?: Record<string, any>) => {
    addLogInternal(message, type, context);
  }, [addLogInternal]);
  
  // Clear logs
  const clearLogs = useCallback(() => {
    clearLogsInternal();
  }, [clearLogsInternal]);
  
  // Cloud provider and environment setters
  const setCloudProvider = useCallback((newProvider: CloudProvider) => {
    setProvider(newProvider);
    addLogInternal(`Cloud provider changed to ${newProvider}`, 'info');
  }, [setProvider, addLogInternal]);
  
  const setDeploymentEnvironment = useCallback((newEnv: DeploymentEnvironment) => {
    setEnvironment(newEnv);
    addLogInternal(`Deployment environment changed to ${newEnv}`, 'info');
  }, [setEnvironment, addLogInternal]);
  
  // Get deployment summary
  const getDeploymentSummary = useCallback(() => {
    const completedSteps = deploymentSteps.filter(step => step.status === 'success').length;
    const totalSteps = deploymentSteps.length;
    const failedSteps = deploymentSteps.filter(step => step.status === 'error').length;
    
    return {
      status: status,
      progress: progress,
      provider: provider,
      environment: environment,
      completedSteps,
      totalSteps,
      failedSteps,
      isComplete: completedSteps === totalSteps,
      hasErrors: failedSteps > 0
    };
  }, [status, progress, provider, environment, deploymentSteps]);
  
  // Create the context value
  const value = useMemo(() => ({
    isDeploying,
    progress,
    logs,
    status,
    deploymentSteps,
    currentStep,
    runStep,
    startDeployment,
    cancelDeployment,
    resetDeployment,
    addLog,
    clearLogs,
    environment,
    setEnvironment,
    provider,
    setProvider,
    isConnected,
    isConnecting,
    connectToCluster,
    disconnectFromCluster,
    setCloudProvider,
    setDeploymentEnvironment,
    getDeploymentSummary
  }), [
    isDeploying, 
    progress, 
    logs, 
    status, 
    deploymentSteps,
    currentStep,
    runStep,
    startDeployment, 
    cancelDeployment, 
    resetDeployment,
    addLog,
    clearLogs,
    environment,
    setEnvironment,
    provider,
    setProvider,
    isConnected,
    isConnecting,
    connectToCluster,
    disconnectFromCluster,
    setCloudProvider,
    setDeploymentEnvironment,
    getDeploymentSummary
  ]);
  
  return (
    <DeploymentContext.Provider value={value}>
      {children}
    </DeploymentContext.Provider>
  );
};
