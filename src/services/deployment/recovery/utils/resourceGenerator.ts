
import { RecoveryResource } from '../types';

export function generateMockResources(types: string[]): RecoveryResource[] {
  const resources: RecoveryResource[] = [];
  
  // Generate database resources
  if (types.includes('all') || types.includes('database')) {
    resources.push(
      {
        resourceId: 'production-postgres',
        resourceType: 'AWS::RDS::DBInstance',
        configuration: {
          engine: 'postgres',
          instanceType: 'db.t3.large',
          allocatedStorage: 100,
          encrypted: true
        }
      },
      {
        resourceId: 'users-dynamodb',
        resourceType: 'AWS::DynamoDB::Table',
        configuration: {
          keySchema: { hashKey: 'userId' },
          readCapacity: 5,
          writeCapacity: 5
        },
        dependencies: []
      }
    );
  }
  
  // Generate compute resources
  if (types.includes('all') || types.includes('compute')) {
    resources.push(
      {
        resourceId: 'api-cluster',
        resourceType: 'AWS::ECS::Cluster',
        configuration: {
          services: ['auth-service', 'api-gateway']
        }
      },
      {
        resourceId: 'event-processor',
        resourceType: 'AWS::Lambda::Function',
        configuration: {
          runtime: 'nodejs16.x',
          memory: 1024,
          timeout: 30
        },
        dependencies: ['events-queue']
      }
    );
  }
  
  // Generate storage resources
  if (types.includes('all') || types.includes('storage')) {
    resources.push(
      {
        resourceId: 'user-media-bucket',
        resourceType: 'AWS::S3::Bucket',
        configuration: {
          versioning: true,
          encryption: 'AES256'
        }
      },
      {
        resourceId: 'app-config-bucket',
        resourceType: 'AWS::S3::Bucket',
        configuration: {
          versioning: true,
          encryption: 'AES256'
        }
      }
    );
  }
  
  // Generate network resources
  if (types.includes('all') || types.includes('network')) {
    resources.push(
      {
        resourceId: 'main-vpc',
        resourceType: 'AWS::EC2::VPC',
        configuration: {
          cidrBlock: '10.0.0.0/16',
          subnets: ['public-a', 'public-b', 'private-a', 'private-b']
        }
      },
      {
        resourceId: 'app-loadbalancer',
        resourceType: 'AWS::ElasticLoadBalancing::LoadBalancer',
        configuration: {
          scheme: 'internet-facing',
          listeners: [{ protocol: 'HTTPS', port: 443 }]
        },
        dependencies: ['main-vpc']
      }
    );
  }
  
  // Generate queue resources
  if (types.includes('all') || types.includes('queue')) {
    resources.push(
      {
        resourceId: 'events-queue',
        resourceType: 'AWS::SQS::Queue',
        configuration: {
          delaySeconds: 0,
          messageRetentionPeriod: 1209600
        }
      },
      {
        resourceId: 'notifications-topic',
        resourceType: 'AWS::SNS::Topic',
        configuration: {
          displayName: 'System Notifications',
          subscribers: ['alerts@example.com']
        }
      }
    );
  }
  
  return resources;
}

