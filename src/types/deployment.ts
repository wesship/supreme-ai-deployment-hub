export type DeploymentStatus = 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'pending' 
  | 'in-progress' 
  | 'rolling-back' 
  | 'rolled-back' 
  | 'rollback-skipped' 
  | 'rollback-failed';
export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'custom';
export type DeploymentEnvironment = 'development' | 'staging' | 'production';

export interface DeploymentStep {
  id: string;
  title: string;
  description: string;
  status: DeploymentStatus;
  icon: string;
  progress: number;
  command?: string;
  outputLog?: string[];
  errorMessage?: string;
  dependsOn?: string[];
  providerSpecific?: boolean;
  provider?: CloudProvider;
  errorCode?: string;
  errorDetails?: Record<string, any>;
  rollback?: () => Promise<void>;
}

export interface ServiceStatus {
  name: string;
  status: string;
  pods: string;
  cpu: string;
  memory: string;
  namespace?: string;
  type?: string;
  endpoints?: string[];
  age?: string;
}

export interface ClusterStatus {
  nodes: number;
  pods: number;
  services: number;
  deployments: number;
  status: string;
  provider?: CloudProvider;
  region?: string;
  version?: string;
  uptime?: string;
}

export interface DeploymentConfig {
  provider: CloudProvider;
  environment: DeploymentEnvironment;
  region: string;
  clusterName: string;
  namespace: string;
  useExistingCluster: boolean;
  resourcePrefix: string;
  tags: Record<string, string>;
}

export interface CloudProviderCredentials {
  provider: CloudProvider;
  authenticated: boolean;
  profileName?: string;
  region?: string;
  expiresAt?: Date;
}
