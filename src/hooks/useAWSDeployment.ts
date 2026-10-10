import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DeploymentStep } from '@/types/deployment';

export const useAWSDeployment = () => {
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentSteps, setDeploymentSteps] = useState<DeploymentStep[]>([]);

  const listClusters = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('aws-eks-deploy', {
        body: { action: 'list-clusters' },
      });

      if (error) throw error;
      return data.clusters || [];
    } catch (error: any) {
      console.error('Error listing clusters:', error);
      toast.error(error.message || 'Failed to list clusters');
      return [];
    }
  }, []);

  const describeCluster = useCallback(async (clusterName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('aws-eks-deploy', {
        body: { 
          action: 'describe-cluster',
          clusterName,
        },
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error describing cluster:', error);
      toast.error(error.message || 'Failed to describe cluster');
      return null;
    }
  }, []);

  const deployToCluster = useCallback(async (
    clusterName: string,
    environment: string,
    config?: any
  ) => {
    setIsDeploying(true);
    setDeploymentSteps([]);

    try {
      toast.info('Starting deployment...');

      const { data, error } = await supabase.functions.invoke('aws-eks-deploy', {
        body: {
          action: 'deploy',
          clusterName,
          environment,
          config,
        },
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Deployment completed successfully!');
        setDeploymentSteps(data.steps || []);
        return { success: true, data };
      } else {
        toast.error(data.error || 'Deployment failed');
        setDeploymentSteps(data.steps || []);
        return { success: false, error: data.error };
      }
    } catch (error: any) {
      console.error('Deployment error:', error);
      toast.error(error.message || 'Deployment failed');
      return { success: false, error: error.message };
    } finally {
      setIsDeploying(false);
    }
  }, []);

  const getClusterStatus = useCallback(async (clusterName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('aws-eks-deploy', {
        body: {
          action: 'get-status',
          clusterName,
        },
      });

      if (error) throw error;
      return data;
    } catch (error: any) {
      console.error('Error getting cluster status:', error);
      toast.error(error.message || 'Failed to get cluster status');
      return null;
    }
  }, []);

  return {
    isDeploying,
    deploymentSteps,
    listClusters,
    describeCluster,
    deployToCluster,
    getClusterStatus,
  };
};
