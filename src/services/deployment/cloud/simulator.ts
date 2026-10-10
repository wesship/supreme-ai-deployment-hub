
import { CloudProvider, CloudCommandResult, ExecuteCommandOptions } from './types';

// Simulate command execution for browser environment
export const simulateCommandExecution = async (
  options: ExecuteCommandOptions
): Promise<CloudCommandResult> => {
  // Add slight delay to simulate network call
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const { provider = 'aws', region = 'us-west-2' } = options;
  
  // Generate random success/failure (mostly success)
  const success = Math.random() > 0.1;
  
  if (success) {
    return {
      success: true,
      logs: [
        `[INFO] Running command in ${region}`,
        `[INFO] Provider: ${provider}`,
        '[INFO] Command executed successfully',
        '[INFO] Operation completed in 0.85s'
      ],
      data: generateMockData(provider, options.command)
    };
  } else {
    // Generate mock error
    const errorCodes = {
      aws: ['AccessDenied', 'ResourceNotFound', 'ValidationError'],
      azure: ['AuthorizationFailed', 'ResourceNotFound', 'InvalidParameter'],
      gcp: ['PERMISSION_DENIED', 'NOT_FOUND', 'INVALID_ARGUMENT']
    };
    
    const errorIndex = Math.floor(Math.random() * 3);
    const errorCode = errorCodes[provider]?.[errorIndex] || 'UnknownError';
    
    return {
      success: false,
      logs: [
        `[INFO] Running command in ${region}`,
        `[INFO] Provider: ${provider}`,
        `[ERROR] Command execution failed: ${errorCode}`,
        '[ERROR] Operation failed after 0.65s'
      ],
      error: `Simulated ${errorCode} error`,
      errorCode
    };
  }
};

// Generate mock data based on provider and command
function generateMockData(provider: CloudProvider, command?: string): any {
  const now = new Date();
  const timestamp = now.toISOString();
  
  switch (provider) {
    case 'aws':
      if (command?.includes('eks') || command?.includes('cluster')) {
        return {
          clusters: ['dev-cluster', 'staging-cluster', 'prod-cluster'],
          status: 'ACTIVE',
          version: '1.25',
          created: timestamp
        };
      }
      return {
        requestId: `req-${Math.random().toString(36).substring(2, 10)}`,
        timestamp,
        region: 'us-west-2'
      };
      
    case 'azure':
      return {
        id: `/subscriptions/00000000-0000-0000-0000-000000000000/resourceGroups/${command?.includes('resource') ? 'myResourceGroup' : 'defaultGroup'}`,
        name: command?.includes('aks') ? 'myAksCluster' : 'defaultResource',
        location: 'westus2',
        tags: {
          environment: 'dev'
        },
        properties: {
          provisioningState: 'Succeeded',
          timestamp
        }
      };
      
    case 'gcp':
      return {
        name: command?.includes('gke') ? 'my-gke-cluster' : 'default-resource',
        zone: 'us-central1-a',
        status: 'RUNNING',
        createTime: timestamp,
        projectId: 'my-project-id'
      };
      
    default:
      return {
        success: true,
        timestamp,
        provider
      };
  }
}
