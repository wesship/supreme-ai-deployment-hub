import type { CloudCommandResult, ExecuteCommandOptions } from '../types';
import { classifyCloudError } from '../errorHandling';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Call the AWS EKS deployment edge function
 */
async function callAWSEdgeFunction(operation: string, params: any = {}): Promise<any> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Not authenticated. Please log in to use AWS services.');
  }

  const response = await supabase.functions.invoke('aws-eks-deploy-v2', {
    body: {
      operation,
      ...params,
    },
  });

  if (response.error) {
    throw new Error(response.error.message || 'AWS operation failed');
  }

  if (!response.data.success) {
    throw new Error(response.data.error || 'AWS operation failed');
  }

  return response.data.data;
}

/**
 * Validate AWS credentials
 */
export const validateAWSCredentials = async (): Promise<any> => {
  try {
    const result = await callAWSEdgeFunction('validate');
    return {
      valid: result.valid,
      account: result.account,
      arn: result.arn,
      userId: result.userId,
    };
  } catch (error) {
    console.error('AWS credential validation failed:', error);
    throw error;
  }
};

/**
 * List EKS clusters
 */
export const listEksClusters = async (region?: string): Promise<string[]> => {
  try {
    const result = await callAWSEdgeFunction('list-clusters', { region });
    return result.clusters || [];
  } catch (error) {
    console.error('Failed to list EKS clusters:', error);
    throw error;
  }
};

/**
 * Describe an EKS cluster
 */
export const describeEksCluster = async (clusterName: string, region?: string): Promise<any> => {
  try {
    const result = await callAWSEdgeFunction('describe-cluster', { clusterName, region });
    return result.cluster;
  } catch (error) {
    console.error(`Failed to describe EKS cluster ${clusterName}:`, error);
    throw error;
  }
};

/**
 * Get cluster status
 */
export const getClusterStatus = async (clusterName: string, region?: string): Promise<any> => {
  try {
    const result = await callAWSEdgeFunction('get-status', { clusterName, region });
    return result;
  } catch (error) {
    console.error(`Failed to get cluster status for ${clusterName}:`, error);
    throw error;
  }
};

/**
 * Create a new EKS cluster
 */
export const createEksCluster = async (
  clusterName: string,
  nodeCount: number = 2,
  instanceType: string = 't3.medium',
  region?: string
): Promise<any> => {
  try {
    const result = await callAWSEdgeFunction('create-cluster', {
      clusterName,
      nodeCount,
      instanceType,
      region,
    });
    return result;
  } catch (error) {
    console.error(`Failed to create EKS cluster ${clusterName}:`, error);
    throw error;
  }
};

/**
 * Delete an EKS cluster
 */
export const deleteEksCluster = async (clusterName: string, region?: string): Promise<any> => {
  try {
    const result = await callAWSEdgeFunction('delete-cluster', { clusterName, region });
    return result;
  } catch (error) {
    console.error(`Failed to delete EKS cluster ${clusterName}:`, error);
    throw error;
  }
};

/**
 * Deploy to an EKS cluster
 */
export const deployToEksCluster = async (
  clusterName: string,
  config: any = {},
  region?: string
): Promise<any> => {
  try {
    const result = await callAWSEdgeFunction('deploy', {
      clusterName,
      config,
      region,
    });
    return result;
  } catch (error) {
    console.error(`Failed to deploy to cluster ${clusterName}:`, error);
    throw error;
  }
};

/**
 * Execute AWS command (compatibility with existing interface)
 */
export const executeAwsCommand = async (
  command: string,
  options: ExecuteCommandOptions
): Promise<CloudCommandResult> => {
  try {
    console.log('Executing AWS command:', command);

    // Parse command to determine operation
    if (command.includes('validate') || command.includes('sts get-caller-identity')) {
      const result = await validateAWSCredentials();
      return {
        success: true,
        logs: [`AWS credentials validated for account ${result.account}`],
        data: result,
      };
    } else if (command.includes('list-clusters') || command.includes('eks list-clusters')) {
      const clusters = await listEksClusters(options.environment);
      return {
        success: true,
        logs: [`Found ${clusters.length} EKS clusters`],
        data: { clusters },
      };
    } else if (command.includes('describe-cluster')) {
      const clusterName = command.match(/--name\s+([^\s]+)/)?.[1] || 'default-cluster';
      const cluster = await describeEksCluster(clusterName, options.environment);
      return {
        success: true,
        logs: [`Successfully retrieved cluster information for ${clusterName}`],
        data: { cluster },
      };
    } else if (command.includes('create-cluster')) {
      const clusterName = command.match(/--name\s+([^\s]+)/)?.[1] || 'devonn-eks-cluster';
      const result = await createEksCluster(clusterName, 2, 't3.medium', options.environment);
      return {
        success: true,
        logs: [result.message || 'Cluster creation initiated'],
        data: result,
      };
    } else if (command.includes('deploy')) {
      const clusterName = command.match(/--cluster\s+([^\s]+)/)?.[1] || 'devonn-eks-prod';
      const result = await deployToEksCluster(clusterName, { environment: options.environment }, options.environment);
      return {
        success: result.success,
        logs: result.steps?.map((s: any) => s.message) || ['Deployment completed'],
        data: result,
      };
    }

    // Fallback for unknown commands
    return {
      success: false,
      logs: ['Command not recognized'],
      error: 'Unknown AWS command',
      errorCode: 'UNKNOWN_COMMAND',
    };
  } catch (error) {
    const { errorCode, errorMessage, errorDetails } = classifyCloudError(error, 'aws');
    return {
      success: false,
      logs: [`[ERROR] ${errorMessage}`],
      error: errorMessage,
      errorCode,
      errorDetails,
    };
  }
};

/**
 * Get AWS provider client (compatibility function)
 */
export const getAwsProviderClient = async (): Promise<{
  sts: any;
  eks?: any;
}> => {
  // Validate credentials first
  await validateAWSCredentials();

  // Return mock client objects that delegate to edge function
  return {
    sts: {
      send: async () => {
        const result = await validateAWSCredentials();
        return result;
      },
    },
    eks: {
      send: async (command: any) => {
        const commandName = command.constructor.name;

        if (commandName.includes('ListClusters')) {
          const clusters = await listEksClusters();
          return { clusters };
        } else if (commandName.includes('DescribeCluster')) {
          const cluster = await describeEksCluster(command.input.name);
          return { cluster };
        }

        return {};
      },
    },
  };
};
