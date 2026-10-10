
import { DeploymentStep, DeploymentConfig, DeploymentEnvironment, CloudProvider } from '../../types/deployment';

// Added structured error types for better error handling
export type DeploymentErrorSeverity = 'critical' | 'major' | 'minor' | 'warning' | 'info';
export type DeploymentErrorCategory = 
  | 'authentication' 
  | 'authorization' 
  | 'configuration' 
  | 'connection'
  | 'resource' 
  | 'validation' 
  | 'timeout'
  | 'dependency'
  | 'execution'
  | 'unknown';

export interface DeploymentError {
  code: string;
  message: string;
  category: DeploymentErrorCategory;
  severity: DeploymentErrorSeverity;
  details?: Record<string, any>;
  recoverable: boolean;
  recommendedAction?: string;
}

export interface UseDeploymentProcessProps {
  deploymentSteps: DeploymentStep[];
  isConnected: boolean;
  updateStep: (stepId: string, updates: Partial<DeploymentStep>) => void;
  setCurrentStep: (stepId: string) => void;
  connectToCluster: (kubeConfig?: string) => Promise<boolean>;
  addLog: (log: string, type?: 'info' | 'error' | 'warning' | 'success') => void; // Updated to include 'success'
  deploymentConfig: DeploymentConfig | undefined;
  environment: DeploymentEnvironment;
}

export interface UseDeploymentProcess {
  isDeploying: boolean;
  runStep: (stepId: string, timeoutMs?: number) => Promise<boolean>;
  retryStep: (stepId: string) => Promise<boolean>;
  startDeployment: () => Promise<void>;
  cancelDeployment: () => void;
}

// New interface for deployment configuration validation
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// New interface for retry strategies
export interface RetryStrategy {
  maxAttempts: number;
  initialDelayMs: number;
  backoffFactor: number;
  maxDelayMs: number;
}

// Default retry strategy
export const DEFAULT_RETRY_STRATEGY: RetryStrategy = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffFactor: 2,
  maxDelayMs: 30000
};
