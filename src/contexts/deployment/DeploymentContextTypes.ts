
import { ReactNode } from 'react';

// Types for logging
export type LogType = 'info' | 'error' | 'warning' | 'success' | 'debug';

// Deployment step status type
export type DeploymentStatus = 
  | 'success'
  | 'error' 
  | 'warning' 
  | 'pending' 
  | 'in-progress'
  | 'rolling-back'
  | 'rolled-back'
  | 'rollback-skipped'
  | 'rollback-failed';

// Deployment step interface
export interface DeploymentStep {
  id: string;
  title: string;
  description: string;
  status: DeploymentStatus;
  progress: number;
  canRollback?: boolean;
  dependencies?: string[];
}

// Environment types
export type DeploymentEnvironment = 'development' | 'staging' | 'production';

// Cloud provider types
export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'custom';

// Deployment configuration interface
export interface DeploymentConfig {
  name: string;
  environment: DeploymentEnvironment;
  provider: CloudProvider;
  resources?: Record<string, any>;
}

// Main deployment context type
export interface DeploymentContextType {
  // State
  isDeploying: boolean;
  progress: number;
  logs: string[];
  status: 'idle' | 'running' | 'success' | 'error' | 'canceled';
  
  // Steps
  deploymentSteps: DeploymentStep[];
  currentStep: string | null;
  runStep: (stepId: string, timeoutMs?: number) => Promise<boolean>;
  
  // Actions
  startDeployment: () => void;
  cancelDeployment: () => void;
  resetDeployment: () => void;
  addLog: (message: string, type?: LogType, context?: Record<string, any>) => void;
  clearLogs: () => void;
  
  // Configuration
  environment: string;
  setEnvironment: (env: string) => void;
  provider: string;
  setProvider: (provider: string) => void;
  
  // Cluster connection
  isConnected: boolean;
  isConnecting: boolean;
  connectToCluster: (kubeConfig?: string) => Promise<boolean>;
  disconnectFromCluster: () => void;
  
  // Cloud provider
  setCloudProvider: (provider: CloudProvider) => void;
  setDeploymentEnvironment: (env: DeploymentEnvironment) => void;
  
  // Summary
  getDeploymentSummary: () => Record<string, any>;
}

export interface DeploymentProviderProps {
  children: ReactNode;
}
