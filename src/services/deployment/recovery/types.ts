
import { CloudProvider, CloudProviderConfig, CloudCommandResult } from '../cloud/types';

export interface RecoveryPoint {
  id: string;
  timestamp: string;
  description: string;
  provider: CloudProvider;
  environment: string;
  resources: RecoveryResource[];
  tags?: Record<string, string>;
}

export interface RecoveryResource {
  resourceId: string;
  resourceType: string;
  configuration: any;
  dependencies?: string[];
}

export interface RecoveryPlan {
  id: string;
  name: string;
  description: string;
  rto: number;
  rpo: number;
  source: {
    provider: CloudProvider;
    region: string;
    environment: string;
  };
  target: {
    provider: CloudProvider;
    region: string;
    environment: string;
  };
  resourceSelectors: string[];
  excludedResources?: string[];
  automatedTesting: boolean;
  testSchedule?: string;
  alertContacts?: string[];
}

export interface RecoveryExecution {
  id: string;
  planId: string;
  startTime: string;
  endTime?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'cancelled';
  recoveryPointId: string;
  resources: {
    resourceId: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
    details?: string;
  }[];
  metrics?: {
    totalDuration: number;
    resourcesRecovered: number;
    resourcesFailed: number;
    dataTransferred: number;
  };
  logs: string[];
}

export interface TargetOverride {
  provider?: CloudProvider;
  region?: string;
  environment?: string;
}

