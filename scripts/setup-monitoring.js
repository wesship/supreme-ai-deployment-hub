
#!/usr/bin/env node

/**
 * AWS CloudWatch Monitoring Setup Script
 * 
 * This script sets up CloudWatch dashboards and alarms for monitoring
 * production infrastructure deployed via Terraform.
 * 
 * Requirements:
 * - AWS CLI configured with appropriate permissions
 * - Node.js 14+
 * - AWS SDK for JavaScript
 */

const { CloudWatch, CloudWatchLogs } = require('@aws-sdk/client-cloudwatch');
const { SNS } = require('@aws-sdk/client-sns');
const fs = require('fs');
const path = require('path');

// Get environment from command line or default to production
const env = process.argv[2] || 'production';
console.log(`Setting up monitoring for ${env} environment`);

// Configuration
const config = {
  region: process.env.AWS_REGION || 'us-west-2',
  clusterName: `devonn-eks-${env}`,
  dbInstanceId: `devonn-postgres-${env}`,
  alarmPrefix: `devonn-${env}`,
  snsTopicName: `devonn-${env}-alerts`,
  thresholds: {
    cpu: 80, // 80% CPU utilization
    memory: 80, // 80% Memory utilization
    disk: 80, // 80% Disk utilization
    connections: 80, // 80% of max connections
    errorRate: 1, // 1% error rate
    latency: 500 // 500ms latency
  },
  observability: {
    enableDistributedTracing: true,
    enableAnomalyDetection: env === 'production',
    enableLogInsights: true,
    retentionDays: env === 'production' ? 90 : 30
  }
};

async function main() {
  try {
    // Initialize AWS clients
    const cloudwatch = new CloudWatch({ region: config.region });
    const cloudwatchLogs = new CloudWatchLogs({ region: config.region });
    const sns = new SNS({ region: config.region });
    
    // Create SNS topic for alerts if it doesn't exist
    console.log('Creating SNS topic for alerts...');
    const topicResponse = await sns.createTopic({ Name: config.snsTopicName });
    const topicArn = topicResponse.TopicArn;
    console.log(`SNS Topic ARN: ${topicArn}`);
    
    // Create CloudWatch Dashboard
    console.log('Creating CloudWatch dashboard...');
    const dashboardName = `Devonn-${env}-Dashboard`;
    const dashboardBody = JSON.stringify({
      widgets: [
        // Node group CPU utilization
        {
          type: 'metric',
          x: 0,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              ['AWS/EKS', 'pod_cpu_utilization', 'ClusterName', config.clusterName]
            ],
            period: 300,
            stat: 'Average',
            region: config.region,
            title: 'EKS CPU Utilization'
          }
        },
        // Node group Memory utilization
        {
          type: 'metric',
          x: 12,
          y: 0,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              ['AWS/EKS', 'pod_memory_utilization', 'ClusterName', config.clusterName]
            ],
            period: 300,
            stat: 'Average',
            region: config.region,
            title: 'EKS Memory Utilization'
          }
        },
        // RDS CPU utilization
        {
          type: 'metric',
          x: 0,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              ['AWS/RDS', 'CPUUtilization', 'DBInstanceIdentifier', config.dbInstanceId]
            ],
            period: 300,
            stat: 'Average',
            region: config.region,
            title: 'RDS CPU Utilization'
          }
        },
        // RDS Free Storage Space
        {
          type: 'metric',
          x: 12,
          y: 6,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              ['AWS/RDS', 'FreeStorageSpace', 'DBInstanceIdentifier', config.dbInstanceId]
            ],
            period: 300,
            stat: 'Average',
            region: config.region,
            title: 'RDS Free Storage Space'
          }
        },
        // API Gateway Latency
        {
          type: 'metric',
          x: 0,
          y: 12,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              ['AWS/ApiGateway', 'Latency', 'ApiName', `devonn-api-${env}`]
            ],
            period: 300,
            stat: 'Average',
            region: config.region,
            title: 'API Gateway Latency'
          }
        },
        // API Gateway 4XX/5XX Errors
        {
          type: 'metric',
          x: 12,
          y: 12,
          width: 12,
          height: 6,
          properties: {
            metrics: [
              ['AWS/ApiGateway', '4XXError', 'ApiName', `devonn-api-${env}`],
              ['AWS/ApiGateway', '5XXError', 'ApiName', `devonn-api-${env}`]
            ],
            period: 300,
            stat: 'Sum',
            region: config.region,
            title: 'API Gateway Errors'
          }
        }
      ]
    });
    
    await cloudwatch.putDashboard({
      DashboardName: dashboardName,
      DashboardBody: dashboardBody
    });
    
    console.log(`Dashboard created: ${dashboardName}`);
    
    // Create CloudWatch Log Groups with appropriate retention
    console.log('Setting up CloudWatch Log Groups...');
    
    const logGroups = [
      `/aws/eks/${config.clusterName}/cluster`,
      `/aws/rds/instance/${config.dbInstanceId}/postgresql`,
      `/aws/lambda/devonn-${env}-api`
    ];
    
    for (const logGroup of logGroups) {
      try {
        // Create log group if it doesn't exist
        try {
          await cloudwatchLogs.createLogGroup({
            logGroupName: logGroup
          });
          console.log(`Created log group: ${logGroup}`);
        } catch (error) {
          if (error.name !== 'ResourceAlreadyExistsException') {
            throw error;
          }
          console.log(`Log group already exists: ${logGroup}`);
        }
        
        // Set retention policy
        await cloudwatchLogs.putRetentionPolicy({
          logGroupName: logGroup,
          retentionInDays: config.observability.retentionDays
        });
        console.log(`Set retention policy for ${logGroup}: ${config.observability.retentionDays} days`);
        
        // Create log metric filters for error tracking
        if (config.observability.enableLogInsights) {
          await cloudwatchLogs.putMetricFilter({
            logGroupName: logGroup,
            filterName: `${logGroup.replace(/\//g, '-')}-errors`,
            filterPattern: 'ERROR',
            metricTransformations: [
              {
                metricName: `ErrorCount-${logGroup.replace(/\//g, '-')}`,
                metricNamespace: 'Devonn/Logs',
                metricValue: '1'
              }
            ]
          });
          console.log(`Created error metric filter for ${logGroup}`);
        }
      } catch (error) {
        console.error(`Error setting up log group ${logGroup}:`, error);
      }
    }
    
    // Create CloudWatch Alarms
    console.log('Creating CloudWatch alarms...');
    
    // EKS CPU Alarm
    await cloudwatch.putMetricAlarm({
      AlarmName: `${config.alarmPrefix}-eks-cpu-high`,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 2,
      MetricName: 'pod_cpu_utilization',
      Namespace: 'AWS/EKS',
      Period: 300,
      Statistic: 'Average',
      Threshold: config.thresholds.cpu,
      ActionsEnabled: true,
      AlarmActions: [topicArn],
      AlarmDescription: `EKS CPU utilization exceeds ${config.thresholds.cpu}%`,
      Dimensions: [
        {
          Name: 'ClusterName',
          Value: config.clusterName
        }
      ]
    });
    
    // RDS CPU Alarm
    await cloudwatch.putMetricAlarm({
      AlarmName: `${config.alarmPrefix}-rds-cpu-high`,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 2,
      MetricName: 'CPUUtilization',
      Namespace: 'AWS/RDS',
      Period: 300,
      Statistic: 'Average',
      Threshold: config.thresholds.cpu,
      ActionsEnabled: true,
      AlarmActions: [topicArn],
      AlarmDescription: `RDS CPU utilization exceeds ${config.thresholds.cpu}%`,
      Dimensions: [
        {
          Name: 'DBInstanceIdentifier',
          Value: config.dbInstanceId
        }
      ]
    });
    
    // RDS Free Storage Space Alarm
    await cloudwatch.putMetricAlarm({
      AlarmName: `${config.alarmPrefix}-rds-storage-low`,
      ComparisonOperator: 'LessThanThreshold',
      EvaluationPeriods: 1,
      MetricName: 'FreeStorageSpace',
      Namespace: 'AWS/RDS',
      Period: 300,
      Statistic: 'Average',
      Threshold: 20 * 1024 * 1024 * 1024, // 20 GB in bytes
      ActionsEnabled: true,
      AlarmActions: [topicArn],
      AlarmDescription: 'RDS free storage space is running low',
      Dimensions: [
        {
          Name: 'DBInstanceIdentifier',
          Value: config.dbInstanceId
        }
      ]
    });
    
    // API Gateway Latency Alarm
    await cloudwatch.putMetricAlarm({
      AlarmName: `${config.alarmPrefix}-api-latency-high`,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 3,
      MetricName: 'Latency',
      Namespace: 'AWS/ApiGateway',
      Period: 300,
      Statistic: 'Average',
      Threshold: config.thresholds.latency,
      ActionsEnabled: true,
      AlarmActions: [topicArn],
      AlarmDescription: `API Gateway latency exceeds ${config.thresholds.latency}ms`,
      Dimensions: [
        {
          Name: 'ApiName',
          Value: `devonn-api-${env}`
        }
      ]
    });
    
    // API Gateway 5XX Error Alarm
    await cloudwatch.putMetricAlarm({
      AlarmName: `${config.alarmPrefix}-api-5xx-errors`,
      ComparisonOperator: 'GreaterThanThreshold',
      EvaluationPeriods: 1,
      MetricName: '5XXError',
      Namespace: 'AWS/ApiGateway',
      Period: 60,
      Statistic: 'Sum',
      Threshold: 5, // More than 5 errors per minute
      ActionsEnabled: true,
      AlarmActions: [topicArn],
      AlarmDescription: 'API Gateway is returning 5XX errors',
      Dimensions: [
        {
          Name: 'ApiName',
          Value: `devonn-api-${env}`
        }
      ]
    });
    
    // Set up anomaly detection if enabled
    if (config.observability.enableAnomalyDetection) {
      console.log('Setting up anomaly detection...');
      
      await cloudwatch.putAnomalyDetector({
        Namespace: 'AWS/ApiGateway',
        MetricName: 'Latency',
        Stat: 'Average',
        Dimensions: [
          {
            Name: 'ApiName',
            Value: `devonn-api-${env}`
          }
        ]
      });
      
      console.log('Created anomaly detector for API Gateway latency');
      
      // Create alarm based on anomaly detection
      await cloudwatch.putMetricAlarm({
        AlarmName: `${config.alarmPrefix}-api-latency-anomaly`,
        ComparisonOperator: 'GreaterThanUpperThreshold',
        EvaluationPeriods: 3,
        ThresholdMetricId: 'ad1',
        Metrics: [
          {
            Id: 'm1',
            MetricStat: {
              Metric: {
                Namespace: 'AWS/ApiGateway',
                MetricName: 'Latency',
                Dimensions: [
                  {
                    Name: 'ApiName',
                    Value: `devonn-api-${env}`
                  }
                ]
              },
              Period: 300,
              Stat: 'Average'
            },
            ReturnData: true
          },
          {
            Id: 'ad1',
            Expression: 'ANOMALY_DETECTION_BAND(m1, 2)',
            ReturnData: true
          }
        ],
        ActionsEnabled: true,
        AlarmActions: [topicArn],
        AlarmDescription: 'API Gateway latency is abnormally high'
      });
      
      console.log('Created anomaly detection alarm for API Gateway latency');
    }
    
    // Create composite alarm for critical issues (if in production)
    if (env === 'production') {
      await cloudwatch.putCompositeAlarm({
        AlarmName: `${config.alarmPrefix}-critical-issues`,
        AlarmRule: `ALARM("${config.alarmPrefix}-api-5xx-errors") OR ALARM("${config.alarmPrefix}-rds-cpu-high")`,
        ActionsEnabled: true,
        AlarmActions: [topicArn],
        AlarmDescription: 'Critical system issues detected - immediate action required'
      });
      
      console.log('Created composite alarm for critical issues');
    }
    
    console.log('Monitoring setup complete!');
    console.log(`NOTE: Subscribe to SNS topic ${topicArn} to receive alerts`);
    
    console.log('\nNext steps:');
    console.log('1. Add email subscribers to the SNS topic');
    console.log('2. Verify the created dashboard in CloudWatch');
    console.log('3. Test the alarms by simulating threshold breaches');
    console.log('4. Set up on-call rotations in PagerDuty or similar service');
    
    if (config.observability.enableDistributedTracing) {
      console.log('5. Set up AWS X-Ray for distributed tracing');
    }
    
  } catch (error) {
    console.error('Error setting up monitoring:', error);
    process.exit(1);
  }
}

main();
