
import React, { createContext, useCallback, useContext, useMemo } from 'react';
import { 
  CloudProvider, 
  ClusterStatus, 
  DeploymentEnvironment, 
  DeploymentStep, 
  ServiceStatus 
} from '../../../types/deployment';

interface SummaryContextType {
  getDeploymentSummary: () => string;
}

const SummaryContext = createContext<SummaryContextType | undefined>(undefined);

export const useSummary = () => {
  const context = useContext(SummaryContext);
  if (!context) {
    throw new Error('useSummary must be used within a SummaryProvider');
  }
  return context;
};

interface SummaryProviderProps {
  children: React.ReactNode;
  deploymentSteps: DeploymentStep[];
  isConnected: boolean;
  provider: CloudProvider;
  clusterStatus: ClusterStatus;
  isDeploying: boolean;
  environment: DeploymentEnvironment;
  overallProgress: number;
  serviceStatus: ServiceStatus[];
}

export const SummaryProvider: React.FC<SummaryProviderProps> = ({ 
  children,
  deploymentSteps,
  isConnected,
  provider,
  clusterStatus,
  isDeploying,
  environment,
  overallProgress,
  serviceStatus
}) => {
  const getDeploymentSummary = useCallback((): string => {
    const completedSteps = deploymentSteps.filter(step => step.status === 'success').length;
    const totalSteps = deploymentSteps.length;
    const failedSteps = deploymentSteps.filter(step => step.status === 'error').length;
    
    let status = '';
    if (isConnected) {
      status += `Connected to ${provider} cluster in ${clusterStatus.region || 'unknown region'}. `;
    } else {
      status += `Not connected to any cluster. `;
    }
    
    if (isDeploying) {
      status += `Deployment in progress (${environment} environment): ${Math.round(overallProgress)}% complete. `;
    }
    
    status += `${completedSteps}/${totalSteps} steps completed. `;
    
    if (failedSteps > 0) {
      status += `${failedSteps} step(s) failed. `;
    }
    
    if (serviceStatus.length > 0) {
      const runningServices = serviceStatus.filter(s => s.status === 'Running').length;
      status += `${runningServices}/${serviceStatus.length} services running.`;
    }
    
    return status;
  }, [
    deploymentSteps, 
    isConnected, 
    provider, 
    clusterStatus.region, 
    isDeploying, 
    environment, 
    overallProgress, 
    serviceStatus
  ]);

  const value = useMemo(() => ({
    getDeploymentSummary
  }), [getDeploymentSummary]);

  return (
    <SummaryContext.Provider value={value}>
      {children}
    </SummaryContext.Provider>
  );
};
