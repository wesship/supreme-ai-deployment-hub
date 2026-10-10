
import { DeploymentEnvironment, CloudProvider } from '../../../types/deployment';
import { LoggingOptions } from './types';
import { DeploymentLogger } from './logger';

export * from './types';

// Create a singleton logger instance
export const createLogger = (
  environment: DeploymentEnvironment = 'development',
  provider: CloudProvider = 'aws',
  options?: Partial<LoggingOptions>
): DeploymentLogger => {
  return new DeploymentLogger(environment, provider, options);
};

// Re-export the DeploymentLogger class
export { DeploymentLogger };
