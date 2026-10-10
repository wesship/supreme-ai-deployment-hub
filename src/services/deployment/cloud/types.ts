
// Cloud provider types
export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'custom';

export interface CloudProviderConfig {
  // Common properties
  region?: string;
  
  // AWS specific
  profile?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  
  // Azure specific
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  subscriptionId?: string;
  
  // GCP specific
  projectId?: string;
  keyFilePath?: string;
  credentials?: any;
  
  // Advanced configuration
  tags?: Record<string, string>;
  assumeRoleArn?: string;
  endpointOverride?: string;
  retryOptions?: RetryStrategy;
  timeout?: number;
  proxyConfiguration?: ProxyConfig;
  securityOptions?: SecurityOptions;
  telemetryEnabled?: boolean;
}

export interface RetryStrategy {
  maxAttempts: number;
  initialDelayMs: number;
  backoffFactor: number;
  maxDelayMs?: number;
  retryableErrors?: string[];
  retryableStatusCodes?: number[];
}

export interface ProxyConfig {
  host: string;
  port: number;
  protocol?: string;
  username?: string;
  password?: string;
  noProxy?: string[];
}

export interface SecurityOptions {
  strictSSL?: boolean;
  caCertPath?: string;
  clientCertPath?: string;
  clientKeyPath?: string;
  tlsV1_2Only?: boolean;
}

export interface CloudCommandResult {
  success: boolean;
  logs?: string[];
  data?: any;
  output?: string;
  error?: string;
  errorCode?: string;
  errorDetails?: Record<string, any>;
  metrics?: CloudOperationMetrics;
}

export interface CloudOperationMetrics {
  startTime: string;
  endTime: string;
  durationMs: number;
  apiCalls: number;
  bytesTransferred?: number;
  resourcesModified?: number;
  region?: string;
  costEstimate?: number;
}

export interface ExecuteCommandOptions {
  provider?: CloudProvider;
  region?: string;
  command?: string;
  dryRun?: boolean;
  timeout?: number;
  environment?: string;
  onProgress?: (progress: number) => void; // Added onProgress callback
  retryCount?: number; // Added retryCount which seems to be used in commandExecution.ts
  traceId?: string;
  priority?: 'high' | 'normal' | 'low';
  tags?: Record<string, string>;
  rollbackStrategy?: 'auto' | 'manual' | 'none';
  validateResources?: boolean;
  notificationTargets?: string[];
  loggingLevel?: 'debug' | 'info' | 'warn' | 'error';
}
