
import { executeAwsCommand } from './providers/aws';
import { getAzureProviderClient } from './providers/azure';
import { getGcpProviderClient } from './providers/gcp';
import { simulateCommandExecution } from './simulator';
import { classifyCloudError } from './errorHandling';
import type { CloudCommandResult, ExecuteCommandOptions } from './types';

// Export types and utility functions
export type { CloudCommandResult, ExecuteCommandOptions };
export { 
  classifyCloudError,
  getAzureProviderClient,
  getGcpProviderClient
};

// Main command execution function that routes to the appropriate provider
export const executeCloudCommand = async (options: ExecuteCommandOptions): Promise<CloudCommandResult> => {
  const { provider } = options;
  
  // Route to provider-specific implementation when available
  switch (provider) {
    case 'aws':
      // Use AWS SDK implementation
      return executeAwsCommand(options.command || '', options);
    
    case 'azure':
    case 'gcp':
    case 'custom':
      // Fall back to simulation for other providers for now
      return simulateCommandExecution(options);
    
    default:
      return {
        success: false,
        logs: [`Unsupported cloud provider: ${provider}`],
        error: `Unsupported cloud provider: ${provider}`
      };
  }
};
