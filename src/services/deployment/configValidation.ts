
import { DeploymentConfig, CloudProvider, DeploymentEnvironment } from '../../types/deployment';
import { ConfigValidationResult } from '../../hooks/deployment/types';
import { createLogger } from './loggingService';

/**
 * Validates a deployment configuration
 * @param config The deployment configuration to validate
 * @param environment The deployment environment
 * @returns Validation result with any errors or warnings
 */
export const validateDeploymentConfig = (
  config: DeploymentConfig | undefined,
  environment: DeploymentEnvironment
): ConfigValidationResult => {
  const logger = createLogger(environment, config?.provider || 'aws');
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // If config is undefined, return error
  if (!config) {
    errors.push('Deployment configuration is missing');
    return { valid: false, errors, warnings };
  }
  
  // Required fields validation
  if (!config.provider) {
    errors.push('Cloud provider is required');
  }
  
  if (!config.region) {
    errors.push('Region is required');
  }
  
  if (!config.clusterName) {
    errors.push('Cluster name is required');
  }
  
  if (!config.namespace) {
    errors.push('Namespace is required');
  }

  // Provider-specific validations
  switch (config.provider) {
    case 'aws':
      validateAwsConfig(config, errors, warnings);
      break;
    case 'azure':
      validateAzureConfig(config, errors, warnings);
      break;
    case 'gcp':
      validateGcpConfig(config, errors, warnings);
      break;
    case 'custom':
      // Custom provider requires additional configuration
      if (!config.resourcePrefix) {
        warnings.push('Resource prefix is recommended for custom providers');
      }
      break;
    default:
      errors.push(`Unsupported cloud provider: ${config.provider}`);
  }
  
  // Environment-specific validations
  if (environment === 'production') {
    validateProductionConfig(config, errors, warnings);
  }
  
  // Log validation results
  if (errors.length > 0) {
    logger.error(`Configuration validation failed with ${errors.length} errors`, { errors });
  } else if (warnings.length > 0) {
    logger.warning(`Configuration validated with ${warnings.length} warnings`, { warnings });
  } else {
    logger.success('Configuration validation successful');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validates AWS-specific configuration
 */
const validateAwsConfig = (
  config: DeploymentConfig,
  errors: string[],
  warnings: string[]
): void => {
  // AWS-specific validations
  const awsRegions = [
    'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
    'ca-central-1', 'eu-west-1', 'eu-central-1', 'eu-west-2',
    'eu-west-3', 'eu-north-1', 'ap-northeast-1', 'ap-northeast-2',
    'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'sa-east-1'
  ];
  
  if (!awsRegions.includes(config.region)) {
    warnings.push(`Region '${config.region}' may not be a valid AWS region`);
  }
  
  // Validate naming conventions
  if (!config.clusterName.match(/^[a-z0-9-]+$/)) {
    errors.push('AWS cluster name must contain only lowercase letters, numbers, and hyphens');
  }
};

/**
 * Validates Azure-specific configuration
 */
const validateAzureConfig = (
  config: DeploymentConfig,
  errors: string[],
  warnings: string[]
): void => {
  // Azure-specific validations
  const azureRegions = [
    'eastus', 'eastus2', 'westus', 'westus2', 'centralus',
    'northeurope', 'westeurope', 'eastasia', 'southeastasia',
    'japaneast', 'japanwest', 'australiaeast', 'australiasoutheast',
    'southindia', 'centralindia', 'westindia', 'canadacentral',
    'canadaeast', 'uksouth', 'ukwest', 'koreacentral', 'koreasouth'
  ];
  
  if (!azureRegions.includes(config.region.toLowerCase())) {
    warnings.push(`Region '${config.region}' may not be a valid Azure region`);
  }
  
  // Validate resource naming conventions
  if (!config.resourcePrefix?.match(/^[a-z0-9]+$/)) {
    warnings.push('Azure resource prefix should contain only lowercase letters and numbers');
  }
};

/**
 * Validates GCP-specific configuration
 */
const validateGcpConfig = (
  config: DeploymentConfig,
  errors: string[],
  warnings: string[]
): void => {
  // GCP-specific validations
  const gcpRegions = [
    'us-central1', 'us-east1', 'us-east4', 'us-west1', 'us-west2',
    'northamerica-northeast1', 'southamerica-east1', 'europe-north1',
    'europe-west1', 'europe-west2', 'europe-west3', 'europe-west4',
    'asia-east1', 'asia-east2', 'asia-northeast1', 'asia-south1',
    'asia-southeast1', 'australia-southeast1'
  ];
  
  if (!gcpRegions.includes(config.region)) {
    warnings.push(`Region '${config.region}' may not be a valid GCP region`);
  }
};

/**
 * Validates production environment specific requirements
 */
const validateProductionConfig = (
  config: DeploymentConfig,
  errors: string[],
  warnings: string[]
): void => {
  // Production environment requires stricter validations
  if (!config.tags || Object.keys(config.tags).length === 0) {
    warnings.push('Tags are recommended for production environments');
  }
  
  if (config.clusterName.includes('dev') || config.clusterName.includes('test')) {
    warnings.push('Production cluster name should not contain "dev" or "test"');
  }
};

/**
 * Gets configuration requirements for a specific provider
 * @param provider Cloud provider
 * @returns List of required and recommended configuration fields
 */
export const getProviderConfigRequirements = (provider: CloudProvider): {
  required: string[];
  recommended: string[];
} => {
  // Common required fields for all providers
  const common = {
    required: ['provider', 'region', 'clusterName', 'namespace'],
    recommended: ['resourcePrefix', 'tags']
  };
  
  // Provider-specific requirements
  switch (provider) {
    case 'aws':
      return {
        required: [...common.required],
        recommended: [...common.recommended, 'vpcId', 'subnetIds']
      };
    case 'azure':
      return {
        required: [...common.required, 'resourceGroup'],
        recommended: [...common.recommended, 'subscriptionId']
      };
    case 'gcp':
      return {
        required: [...common.required, 'projectId'],
        recommended: [...common.recommended, 'network']
      };
    case 'custom':
    default:
      return common;
  }
};
