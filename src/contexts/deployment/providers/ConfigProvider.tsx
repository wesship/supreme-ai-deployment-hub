
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { 
  CloudProvider, 
  DeploymentConfig, 
  DeploymentEnvironment 
} from '../../../types/deployment';
import { createLogger } from '../../../services/deployment/loggingService';

interface ConfigContextType {
  deploymentConfig: DeploymentConfig | null;
  environment: DeploymentEnvironment;
  setDeploymentEnvironment: (environment: DeploymentEnvironment) => void;
  updateDeploymentConfig: (config: Partial<DeploymentConfig>) => void;
  updateDeploymentConfigWithDefaults: (env: DeploymentEnvironment, prov: CloudProvider) => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

interface ConfigProviderProps {
  children: React.ReactNode;
  provider: CloudProvider;
  isDeploying: boolean;
  addLog: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
}

export const ConfigProvider: React.FC<ConfigProviderProps> = ({ 
  children, 
  provider, 
  isDeploying,
  addLog
}) => {
  const [environment, setEnvironment] = useState<DeploymentEnvironment>('development');
  const [deploymentConfig, setDeploymentConfig] = useState<DeploymentConfig | null>(null);
  const logger = createLogger(environment, provider);
  const initializedRef = useRef(false);

  const updateDeploymentConfigWithDefaults = useCallback((env: DeploymentEnvironment, prov: CloudProvider) => {
    logger.info('Updating deployment configuration', { provider: prov, environment: env });
    
    setDeploymentConfig({
      provider: prov,
      environment: env,
      region: prov === 'aws' ? 'us-west-2' : 
              prov === 'azure' ? 'eastus' : 
              prov === 'gcp' ? 'us-central1' : '',
      clusterName: `devonn-${env}`,
      namespace: 'default',
      useExistingCluster: false,
      resourcePrefix: `devonn-${env}`,
      tags: {
        environment: env,
        project: 'd3vonn-io',
        managedBy: 'devonn-dashboard'
      }
    });
  }, [logger]);

  // Fix the infinite loop by using a ref to track initialization
  useEffect(() => {
    if (!initializedRef.current) {
      updateDeploymentConfigWithDefaults(environment, provider);
      initializedRef.current = true;
    }
  }, [provider, environment, updateDeploymentConfigWithDefaults]);

  const setDeploymentEnvironment = useCallback((newEnvironment: DeploymentEnvironment) => {
    if (isDeploying) {
      addLog('Cannot change environment while deployment is in progress', 'warning');
      return;
    }
    
    logger.info(`Changing deployment environment to ${newEnvironment}`);
    setEnvironment(newEnvironment);
    
    addLog(`Deployment environment set to ${newEnvironment}`, 'info');
  }, [isDeploying, addLog, logger]);

  const updateDeploymentConfig = useCallback((config: Partial<DeploymentConfig>) => {
    if (isDeploying) {
      addLog('Cannot update configuration while deployment is in progress', 'warning');
      return;
    }
    
    if (deploymentConfig) {
      logger.info('Updating deployment configuration', { 
        changes: Object.keys(config),
        provider: config.provider || deploymentConfig.provider
      });
      
      setDeploymentConfig(prevConfig => ({
        ...prevConfig!,
        ...config
      }));
      
      addLog('Deployment configuration updated', 'info');
    }
  }, [isDeploying, addLog, logger, deploymentConfig]);

  const value = useMemo(() => ({
    deploymentConfig,
    environment,
    setDeploymentEnvironment,
    updateDeploymentConfig,
    updateDeploymentConfigWithDefaults
  }), [
    deploymentConfig, 
    environment, 
    setDeploymentEnvironment, 
    updateDeploymentConfig, 
    updateDeploymentConfigWithDefaults
  ]);

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
};
