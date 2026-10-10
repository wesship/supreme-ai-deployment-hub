
import { useState, useCallback } from 'react';
import { ClusterStatus, ServiceStatus, CloudProvider, CloudProviderCredentials } from '../types/deployment';
import { toast } from 'sonner';
import { connectToKubernetesCluster } from '../services/deployment/kubernetesService';

export const useClusterConnection = (addLog: (message: string, type: 'info' | 'success' | 'warning' | 'error') => void) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [connectionAttempts, setConnectionAttempts] = useState<number>(0);
  const [provider, setProvider] = useState<CloudProvider>('aws');
  const [providerCredentials, setProviderCredentials] = useState<CloudProviderCredentials | null>(null);
  const [clusterStatus, setClusterStatus] = useState<ClusterStatus>({
    nodes: 0,
    pods: 0,
    services: 0,
    deployments: 0,
    status: 'Disconnected',
  });
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Connect to Kubernetes cluster
  const connectToCluster = useCallback(async (kubeConfig?: string): Promise<boolean> => {
    if (isConnecting) {
      addLog('Connection attempt already in progress', 'warning');
      return false;
    }
    
    setIsConnecting(true);
    setConnectionError(null);
    addLog('Attempting to connect to Kubernetes cluster...', 'info');
    
    // Log connection details (excluding sensitive parts)
    addLog(`Connection provider: ${provider}`, 'info');
    addLog(`Using local config: ${!kubeConfig ? 'Yes' : 'No'}`, 'info');
    
    // Increment connection attempts
    const attempts = connectionAttempts + 1;
    setConnectionAttempts(attempts);
    
    try {
      // Add brief delay to allow UI to update
      await new Promise(resolve => setTimeout(resolve, 300));
      
      console.log('Connecting to cluster with provider:', provider);
      console.log('Connection attempt:', attempts);
      
      if (kubeConfig) {
        console.log('Using provided kubeconfig (length):', kubeConfig.length);
        // Log first few characters for debugging (avoid sensitive data)
        const safePart = kubeConfig.substring(0, 20).replace(/\n/g, ' ');
        console.log('Kubeconfig starts with:', safePart + '...');
      } else {
        console.log('Using local kubeconfig from default path');
      }
      
      // Use the actual Kubernetes connection service
      const result = await connectToKubernetesCluster({
        kubeConfig,
        provider,
        attempt: attempts
      });
      
      console.log('Connection result:', { 
        connected: result.connected,
        clusterInfo: result.clusterInfo,
        error: result.error,
        kubeConfig: '[REDACTED]' 
      });
      
      if (result.connected) {
        // Successfully connected
        setIsConnected(true);
        setClusterStatus({
          nodes: result.clusterInfo.nodes,
          pods: result.clusterInfo.pods,
          services: result.clusterInfo.services,
          deployments: result.clusterInfo.deployments,
          status: result.clusterInfo.status,
          provider: result.clusterInfo.provider,
          region: result.clusterInfo.region,
          version: result.clusterInfo.version,
          uptime: result.clusterInfo.uptime,
        });
        
        setServiceStatus(result.serviceStatuses || []);
        setConnectionError(null);
        
        // Update provider credentials if available
        if (result.providerCredentials) {
          setProviderCredentials(result.providerCredentials);
          setProvider(result.providerCredentials.provider);
        }
        
        addLog('Successfully connected to Kubernetes cluster', 'success');
        addLog(`Cluster info: ${result.clusterInfo.nodes} nodes, ${result.clusterInfo.pods} pods`, 'info');
        
        if (result.clusterInfo.version) {
          addLog(`Kubernetes version: ${result.clusterInfo.version}`, 'info');
        }
        
        if (result.clusterInfo.provider) {
          addLog(`Cloud provider: ${result.clusterInfo.provider}${result.clusterInfo.region ? ` (${result.clusterInfo.region})` : ''}`, 'info');
        }
        
        toast.success('Connected to Kubernetes cluster');
        setIsConnecting(false);
        return true;
      } else {
        throw new Error(result.error || 'Failed to connect to cluster');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setConnectionError(errorMessage);
      
      // Log detailed error information
      console.error('Cluster connection error:', error);
      addLog(`Connection attempt ${attempts} failed: ${errorMessage}`, 'error');
      
      // Check for common connection errors
      if (errorMessage.includes('unauthorized') || errorMessage.includes('permission')) {
        addLog('Authentication error: Check your kubeconfig credentials', 'error');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('no connection')) {
        addLog('Network error: Unable to reach the Kubernetes API server', 'error');
      } else if (errorMessage.includes('YAML') || errorMessage.includes('parse')) {
        addLog('Invalid kubeconfig format: Check your YAML syntax', 'error');
      } else if (errorMessage.includes('certificate')) {
        addLog('Certificate error: Your kubeconfig may contain expired certificates', 'error');
      } else if (errorMessage.includes('context')) {
        addLog('Context error: The specified context may not exist in your kubeconfig', 'error');
      }
      
      // Auto-retry logic for first and second attempts with exponential backoff
      if (attempts < 3) {
        const retryDelay = Math.pow(2, attempts - 1) * 1000; // 1s, 2s
        addLog(`Automatically retrying connection in ${retryDelay/1000}s (attempt ${attempts + 1}/3)...`, 'warning');
        toast.warning(`Connection failed. Retrying (${attempts + 1}/3)...`);
        setIsConnecting(false);
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        return connectToCluster(kubeConfig);
      }
      
      toast.error('Failed to connect to Kubernetes cluster after multiple attempts');
      setIsConnecting(false);
      return false;
    }
  }, [isConnecting, provider, connectionAttempts, addLog]);

  // Set cloud provider
  const setCloudProvider = useCallback((newProvider: CloudProvider) => {
    if (isConnected) {
      addLog('Cannot change provider while connected to a cluster', 'warning');
      toast.warning('Disconnect from the current cluster first');
      return false;
    }
    
    setProvider(newProvider);
    addLog(`Cloud provider set to ${newProvider}`, 'info');
    return true;
  }, [isConnected, addLog]);

  // Disconnect from cluster
  const disconnectFromCluster = useCallback(() => {
    if (isConnected) {
      setIsConnected(false);
      setClusterStatus({
        nodes: 0,
        pods: 0,
        services: 0,
        deployments: 0,
        status: 'Disconnected',
      });
      setServiceStatus([]);
      setConnectionAttempts(0);
      setProviderCredentials(null);
      setConnectionError(null);
      addLog('Disconnected from Kubernetes cluster', 'info');
      toast.info('Disconnected from cluster');
      return true;
    }
    return false;
  }, [isConnected, addLog]);

  return {
    isConnected,
    isConnecting,
    clusterStatus,
    serviceStatus,
    provider,
    providerCredentials,
    connectionError,
    connectToCluster,
    disconnectFromCluster,
    setCloudProvider
  };
};
