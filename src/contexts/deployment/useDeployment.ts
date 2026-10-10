
import { useContext } from 'react';
import { DeploymentContext } from './DeploymentContextProvider';

// Custom hook for using the deployment context
export const useDeployment = () => {
  const context = useContext(DeploymentContext);
  if (context === undefined) {
    throw new Error('useDeployment must be used within a DeploymentProvider');
  }
  return context;
};
