
import { DeploymentEnvironment } from '../../../types/deployment';
import { LoggingOptions } from './types';

// Default logging options based on environment
export const getDefaultLoggingOptions = (environment: DeploymentEnvironment): LoggingOptions => {
  switch (environment) {
    case 'production':
      return {
        logLevel: 'info',
        includeTimestamp: true,
        includeContext: true,
        destination: 'both'
      };
    case 'staging':
      return {
        logLevel: 'info',
        includeTimestamp: true,
        includeContext: true,
        destination: 'both'
      };
    case 'development':
    default:
      return {
        logLevel: 'debug',
        includeTimestamp: true,
        includeContext: true,
        destination: 'console'
      };
  }
};
