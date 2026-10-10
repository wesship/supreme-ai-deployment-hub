
import { RecoveryResource } from '../types';
import { CloudProvider } from '../../cloud/types';

export function buildRecoveryCommand(
  resource: RecoveryResource,
  target: { provider: CloudProvider; region: string; environment: string },
  override?: { provider?: CloudProvider; region?: string; environment?: string }
): string {
  const targetProvider = override?.provider || target.provider;
  const targetRegion = override?.region || target.region;
  const targetEnvironment = override?.environment || target.environment;
  
  switch (targetProvider) {
    case 'aws':
      if (resource.resourceType.includes('Lambda')) {
        return `aws lambda create-function --function-name ${resource.resourceId} --region ${targetRegion}`;
      } else if (resource.resourceType.includes('S3')) {
        return `aws s3 sync s3://recovery-${resource.resourceId} s3://${targetEnvironment}-${resource.resourceId} --region ${targetRegion}`;
      } else if (resource.resourceType.includes('DynamoDB')) {
        return `aws dynamodb restore-table-from-backup --target-table-name ${targetEnvironment}-${resource.resourceId} --backup-arn arn:aws:dynamodb:${targetRegion}:backup/${resource.resourceId}`;
      } else {
        return `aws cloudformation deploy --template recovery-templates/${resource.resourceType}.yaml --stack-name ${targetEnvironment}-${resource.resourceId} --region ${targetRegion}`;
      }
      
    case 'azure':
      return `az resource create --name ${targetEnvironment}-${resource.resourceId} --resource-type ${resource.resourceType} --location ${targetRegion}`;
      
    case 'gcp':
      return `gcloud ${resource.resourceType.toLowerCase()} create ${targetEnvironment}-${resource.resourceId} --source=recovery-${resource.resourceId} --region=${targetRegion}`;
      
    default:
      return `recovery-cli restore --resource=${resource.resourceId} --type=${resource.resourceType} --target-env=${targetEnvironment} --target-region=${targetRegion}`;
  }
}

