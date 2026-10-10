
import { DeploymentConfig, DeploymentEnvironment, CloudProvider } from '../../types/deployment';
import { validateDeploymentConfig } from '../../services/deployment/configValidation';
import { validateEnvironmentVariables } from './stepUtils';
import { UseDeploymentProcessProps } from './types';
import { toast } from '@/hooks/use-toast';

/**
 * Validates if the environment is ready for deployment
 */
export const validateEnvironmentReadiness = (
  environment: DeploymentEnvironment,
  provider: CloudProvider,
  addLog: (log: string, type?: 'info' | 'error' | 'warning' | 'success') => void
): boolean => {
  // Check for required environment variables
  const envVarsCheck = validateEnvironmentVariables(environment);
  if (!envVarsCheck.valid) {
    addLog(
      `Missing required environment variables: ${envVarsCheck.missing.join(', ')}`,
      'error'
    );
    
    toast({
      title: "Environment Error",
      description: `Missing variables: ${envVarsCheck.missing.join(', ')}`,
      variant: "destructive",
      duration: 5000,
    });
    
    // For development, we can continue despite missing variables
    if (environment === 'development') {
      addLog('Continuing with deployment in development mode despite missing variables.', 'warning');
      return true;
    }
    
    return false;
  }

  // Additional checks could be added here: network connectivity, permissions, etc.
  
  return true;
};

/**
 * Validates if deployment can start
 */
export const validateDeploymentBeforeStart = (
  props: UseDeploymentProcessProps
): boolean => {
  const { deploymentConfig, addLog, environment } = props;
  
  if (!deploymentConfig) {
    addLog('Deployment configuration is not set. Please configure before starting deployment.', 'error');
    
    toast({
      title: "Configuration Error",
      description: "Deployment configuration is not set",
      variant: "destructive",
      duration: 5000,
    });
    
    return false;
  }

  // Validate deployment configuration
  const validationResult = validateDeploymentConfig(deploymentConfig, environment);
  if (!validationResult.valid) {
    addLog(
      `Deployment configuration is invalid: ${validationResult.errors.join(', ')}`,
      'error'
    );
    
    toast({
      title: "Validation Error",
      description: validationResult.errors[0] || "Invalid configuration",
      variant: "destructive",
      duration: 5000,
    });
    
    return false;
  }

  // Show warnings but don't block deployment
  if (validationResult.warnings && validationResult.warnings.length > 0) {
    validationResult.warnings.forEach(warning => {
      addLog(`Warning: ${warning}`, 'warning');
    });
    
    toast({
      title: "Configuration Warning",
      description: validationResult.warnings[0] || "Check deployment settings",
      variant: "warning",
      duration: 5000,
    });
  }

  // Validate environment readiness
  const isEnvironmentReady = validateEnvironmentReadiness(
    environment,
    deploymentConfig.provider,
    addLog
  );
  
  if (!isEnvironmentReady && environment !== 'development') {
    addLog('Environment is not ready for deployment.', 'error');
    return false;
  }

  return true;
};
