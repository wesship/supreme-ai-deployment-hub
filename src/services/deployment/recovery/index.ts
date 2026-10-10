
import { DisasterRecoveryService } from './DisasterRecoveryService';
import { CloudProvider, CloudProviderConfig } from '../cloud/types';
import type { 
  RecoveryPoint,
  RecoveryPlan,
  RecoveryResource,
  RecoveryExecution,
  TargetOverride
} from './types';

export function createDisasterRecoveryService(
  provider: CloudProvider,
  config: CloudProviderConfig
): DisasterRecoveryService {
  return new DisasterRecoveryService(provider, config);
}

export {
  DisasterRecoveryService,
  type RecoveryPoint,
  type RecoveryPlan,
  type RecoveryResource,
  type RecoveryExecution,
  type TargetOverride
};

