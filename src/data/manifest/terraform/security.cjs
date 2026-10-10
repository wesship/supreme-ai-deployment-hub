
// Security configuration for Terraform

export const securityConfigYaml = `# --- Security Configuration ---

variable "create_cloudtrail" {
  type    = bool
  default = true
}

# AWS CloudTrail for AWS API auditing
resource "aws_cloudtrail" "devonn_cloudtrail" {
  count                      = var.environment == "prod" && var.create_cloudtrail ? 1 : 0
  name                          = "devonn-cloudtrail-\${var.environment}"
  s3_bucket_name                = aws_s3_bucket.cloudtrail_bucket[0].id
  include_global_service_events = true
  is_multi_region_trail         = true
  enable_log_file_validation    = true
  
  event_selector {
    read_write_type           = "All"
    include_management_events = true
    
    data_resource {
      type   = "AWS::S3::Object"
      values = ["arn:aws:s3:::"]
    }
  }
}

# S3 bucket for CloudTrail logs
resource "aws_s3_bucket" "cloudtrail_bucket" {
  count                      = var.environment == "prod" && var.create_cloudtrail ? 1 : 0
  bucket = "devonn-cloudtrail-\${var.environment}-\${random_id.bucket_suffix[0].hex}"
}

# CloudTrail bucket random suffix
resource "random_id" "bucket_suffix" {
  count                      = var.environment == "prod" && var.create_cloudtrail ? 1 : 0
  byte_length = 8
}

# S3 bucket policy for CloudTrail
resource "aws_s3_bucket_policy" "cloudtrail_bucket_policy" {
  count                      = var.environment == "prod" && var.create_cloudtrail ? 1 : 0
  bucket = aws_s3_bucket.cloudtrail_bucket[0].id
  
  policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AWSCloudTrailAclCheck",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudtrail.amazonaws.com"
      },
      "Action": "s3:GetBucketAcl",
      "Resource": "\${aws_s3_bucket.cloudtrail_bucket[0].arn}"
    },
    {
      "Sid": "AWSCloudTrailWrite",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudtrail.amazonaws.com"
      },
      "Action": "s3:PutObject",
      "Resource": "\${aws_s3_bucket.cloudtrail_bucket[0].arn}/*",
      "Condition": {
        "StringEquals": {
          "s3:x-amz-acl": "bucket-owner-full-control"
        }
      }
    }
  ]
}
POLICY
}

# Security best practices for S3 buckets
resource "aws_s3_bucket_public_access_block" "cloudtrail_bucket_access" {
  count                      = var.environment == "prod" && var.create_cloudtrail ? 1 : 0
  bucket                  = aws_s3_bucket.cloudtrail_bucket[0].id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Enable S3 bucket server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "cloudtrail_bucket_encryption" {
  count  = var.environment == "prod" && var.create_cloudtrail ? 1 : 0
  bucket = aws_s3_bucket.cloudtrail_bucket[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# VPC Flow Logs for network monitoring
resource "aws_flow_log" "vpc_flow_logs" {
  count                = var.environment == "prod" ? 1 : 0
  log_destination      = aws_cloudwatch_log_group.flow_log_group[0].arn
  log_destination_type = "cloud-watch-logs"
  traffic_type         = "ALL"
  vpc_id               = module.vpc.vpc_id
  iam_role_arn         = var.create_vpc_flow_log_role ? aws_iam_role.vpc_flow_log_role[0].arn : ""
}

# Log group for VPC Flow Logs
resource "aws_cloudwatch_log_group" "flow_log_group" {
  count             = var.environment == "prod" ? 1 : 0
  name              = "/aws/vpc-flow-logs/devonn-vpc-\${var.environment}"
  retention_in_days = 30
}

variable "create_vpc_flow_log_role" {
  type    = bool
  default = true 
}

# IAM role for VPC Flow Logs
resource "aws_iam_role" "vpc_flow_log_role" {
  count = var.environment == "prod" && var.create_vpc_flow_log_role ? 1 : 0
  name  = "devonn-vpc-flow-log-role-\${var.environment}"
  
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "vpc-flow-logs.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

   lifecycle {
     ignore_changes    = [name]
   }
}

# IAM policy for VPC Flow Logs
resource "aws_iam_role_policy" "vpc_flow_log_policy" {
  count = var.environment == "prod" && var.create_vpc_flow_log_role ? 1 : 0
  name  = "devonn-vpc-flow-log-policy-\${var.environment}"
  role  = aws_iam_role.vpc_flow_log_role[0].id
  
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Effect": "Allow",
      "Resource": "*"
    }
  ]
}
EOF

  lifecycle {
    ignore_changes = [name, policy]
  }
}

# AWS Config for compliance monitoring (production only)
resource "aws_config_configuration_recorder" "devonn_config" {
  count    = var.environment == "prod" ? 1 : 0
  name     = "devonn-config-recorder-\${var.environment}"
  role_arn = aws_iam_role.config_role[0].arn
  
  recording_group {
    all_supported                 = true
    include_global_resource_types = true
  }
}

# IAM role for AWS Config
resource "aws_iam_role" "config_role" {
  count = var.environment == "prod" ? 1 : 0
  name  = "devonn-config-role-\${var.environment}"
  
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "config.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

   lifecycle {
     ignore_changes    = [name]
   }
}

# Attach AWS managed policy for Config
resource "aws_iam_role_policy_attachment" "config_policy_attachment" {
  count      = var.environment == "prod" ? 1 : 0
  role       = aws_iam_role.config_role[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSConfigRoleForOrganizations"
}

# --- NEW SECURITY ENHANCEMENTS ---

# 1. AWS GuardDuty for threat detection (production only)
# AWS GuardDuty Detector (enables GuardDuty)
resource "aws_guardduty_detector" "devonn_guardduty" {
  count                    = var.enable_guardduty && var.environment == "prod" ? 1 : 0
  enable                   = var.enable_guardduty
  finding_publishing_frequency = "ONE_HOUR"
}

resource "aws_guardduty_detector_feature" "s3_data_events" {
    count      = var.environment == "prod" && length(aws_guardduty_detector.devonn_guardduty) > 0 ? 1 : 0
  detector_id = aws_guardduty_detector.devonn_guardduty[0].id
  name        = "S3_DATA_EVENTS"
  status      = "DISABLED"
}

resource "aws_guardduty_detector_feature" "eks_audit_logs" {
  count      = var.environment == "prod" && length(aws_guardduty_detector.devonn_guardduty) > 0 ? 1 : 0
  detector_id = aws_guardduty_detector.devonn_guardduty[0].id
  name        = "EKS_AUDIT_LOGS"
  status      = "DISABLED"
}

resource "aws_guardduty_detector_feature" "ebs_malware_protection" {
  count      = var.environment == "prod" && length(aws_guardduty_detector.devonn_guardduty) > 0 ? 1 : 0
  detector_id = aws_guardduty_detector.devonn_guardduty[0].id
  name        = "EBS_MALWARE_PROTECTION"
  status      = "DISABLED"
}

# 2. AWS Security Hub to manage security posture
resource "aws_securityhub_account" "devonn_securityhub" {
  count = var.enable_securityhub && var.environment == "prod" ? 1 : 0
}

# Enable Security Hub standards
resource "aws_securityhub_standards_subscription" "cis_aws_foundations" {
  count          = var.enable_securityhub && var.environment == "prod" ? 1 : 0
  standards_arn  = "arn:aws:securityhub:\${var.aws_region}::standards/cis-aws-foundations-benchmark/v/1.2.0"
  depends_on     = [aws_securityhub_account.devonn_securityhub]
}

resource "aws_securityhub_standards_subscription" "aws_foundational" {
  count          = var.enable_securityhub && var.environment == "prod" ? 1 : 0
  standards_arn  = "arn:aws:securityhub:\${var.aws_region}::standards/aws-foundational-security-best-practices/v/1.0.0"
  depends_on     = [aws_securityhub_account.devonn_securityhub]
}

# 3. Network ACLs for additional network security
resource "aws_network_acl" "private_nacl" {
  count      = var.environment == "prod" ? 1 : 0
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
  
  # Allow all outbound traffic
  egress {
    protocol   = "-1"
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }
  
  # Allow inbound traffic from VPC CIDR
  ingress {
    protocol   = "-1"
    rule_no    = 100
    action     = "allow"
    cidr_block = var.vpc_cidr
    from_port  = 0
    to_port    = 0
  }
  
  # Allow established connections
  ingress {
    protocol   = "tcp"
    rule_no    = 110
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
  }
  
  tags = {
    Name        = "devonn-private-nacl-\${var.environment}"
    Environment = var.environment
  }
}

resource "aws_network_acl" "public_nacl" {
  count      = var.environment == "prod" ? 1 : 0
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnets
  
  # Allow all outbound traffic
  egress {
    protocol   = "-1"
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 0
    to_port    = 0
  }
  
  # Allow inbound HTTP
  ingress {
    protocol   = "tcp"
    rule_no    = 100
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 80
    to_port    = 80
  }
  
  # Allow inbound HTTPS
  ingress {
    protocol   = "tcp"
    rule_no    = 110
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 443
    to_port    = 443
  }
  
  # Allow ephemeral ports for established connections
  ingress {
    protocol   = "tcp"
    rule_no    = 120
    action     = "allow"
    cidr_block = "0.0.0.0/0"
    from_port  = 1024
    to_port    = 65535
  }
  
  tags = {
    Name        = "devonn-public-nacl-\${var.environment}"
    Environment = var.environment
  }
}

# 4. Enhanced monitoring with custom CloudWatch dashboards and SNS
resource "aws_cloudwatch_dashboard" "devonn_dashboard" {
  count          = var.environment == "prod" ? 1 : 0
  dashboard_name = "devonn-\${var.environment}-monitoring"
  
  dashboard_body = <<EOF
{
  "widgets": [
    {
      "type": "metric",
      "x": 0,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["AWS/EKS", "cluster_failed_node_count", "ClusterName", "devonn-eks-\${var.environment}"],
          ["AWS/EKS", "node_cpu_utilization", "ClusterName", "devonn-eks-\${var.environment}"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "\${var.aws_region}",
        "title": "EKS Cluster Health"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 0,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["AWS/RDS", "CPUUtilization", "DBInstanceIdentifier", "devonn-postgres-\${var.environment}"],
          ["AWS/RDS", "FreeStorageSpace", "DBInstanceIdentifier", "devonn-postgres-\${var.environment}"],
          ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", "devonn-postgres-\${var.environment}"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "\${var.aws_region}",
        "title": "RDS Database Metrics"
      }
    },
    {
      "type": "metric",
      "x": 0,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["AWS/Lambda", "Invocations", "FunctionName", "devonn-api-handler"],
          ["AWS/Lambda", "Errors", "FunctionName", "devonn-api-handler"],
          ["AWS/Lambda", "Duration", "FunctionName", "devonn-api-handler"]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "\${var.aws_region}",
        "title": "API Lambda Function"
      }
    },
    {
      "type": "metric",
      "x": 12,
      "y": 6,
      "width": 12,
      "height": 6,
      "properties": {
        "metrics": [
          ["AWS/NetworkELB", "HealthyHostCount", "LoadBalancer", "app/devonn-nlb/\${var.environment}"],
          ["AWS/NetworkELB", "UnHealthyHostCount", "LoadBalancer", "app/devonn-nlb/\${var.environment}"],
          ["AWS/NetworkELB", "RequestCount", "LoadBalancer", "app/devonn-nlb/\${var.environment}"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "\${var.aws_region}",
        "title": "Load Balancer Health"
      }
    }
  ]
}
EOF
}

# 5. Create SNS Topic for Alerts
resource "aws_sns_topic" "alerts_topic" {
  count  = var.environment == "prod" ? 1 : 0
  name   = "devonn-alerts-\${var.environment}"
}

# 6. Add CloudWatch Alarms with SNS Integration
resource "aws_cloudwatch_metric_alarm" "rds_cpu_alarm" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "devonn-rds-cpu-high-\${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS CPU utilization is too high"
  alarm_actions       = [aws_sns_topic.alerts_topic[0].arn]
  ok_actions          = [aws_sns_topic.alerts_topic[0].arn]
  
  dimensions = {
    DBInstanceIdentifier = "devonn-postgres-\${var.environment}"
  }
}

resource "aws_cloudwatch_metric_alarm" "rds_storage_alarm" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "devonn-rds-storage-low-\${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 10737418240  # 10GB in bytes
  alarm_description   = "RDS free storage space is critically low"
  alarm_actions       = [aws_sns_topic.alerts_topic[0].arn]
  ok_actions          = [aws_sns_topic.alerts_topic[0].arn]
  
  dimensions = {
    DBInstanceIdentifier = "devonn-postgres-\${var.environment}"
  }
}

resource "aws_cloudwatch_metric_alarm" "eks_node_failure_alarm" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "devonn-eks-node-failure-\${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "cluster_failed_node_count"
  namespace           = "AWS/EKS"
  period              = 300
  statistic           = "Maximum"
  threshold           = 0
  alarm_description   = "EKS cluster has failed nodes"
  alarm_actions       = [aws_sns_topic.alerts_topic[0].arn]
  ok_actions          = [aws_sns_topic.alerts_topic[0].arn]
  
  dimensions = {
    ClusterName = "devonn-eks-\${var.environment}"
  }
}

# 7. Cross-region replication for RDS instance
resource "aws_db_instance_automated_backups_replication" "rds_backup_replication" {
  count                      = var.aws_region != "us-west-2" ? 1 : 0
  source_db_instance_arn     = module.rds.db_instance_arn
  retention_period           = 7
  kms_key_id                 = aws_kms_key.rds_backup_key[0].arn
}

# 8. KMS Key for RDS backup encryption
resource "aws_kms_key" "rds_backup_key" {
  count                   = var.environment == "prod" ? 1 : 0
  description             = "KMS key for RDS backup encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
}

# 9. Implement auto-scaling for EKS node groups with cost optimization
resource "aws_autoscaling_policy" "scale_down_policy" {
  count                  = var.environment == "prod" ? 1 : 0
  name                   = "devonn-eks-scale-down-\${var.environment}"
  autoscaling_group_name = module.eks.eks_managed_node_groups["dev_nodes"].node_group_autoscaling_group_names[0]
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = -1
  cooldown               = 300
}

resource "aws_autoscaling_policy" "scale_up_policy" {
  count                  = var.environment == "prod" ? 1 : 0
  name                   = "devonn-eks-scale-up-\${var.environment}"
  autoscaling_group_name = module.eks.eks_managed_node_groups["dev_nodes"].node_group_autoscaling_group_names[0]
  adjustment_type        = "ChangeInCapacity"
  scaling_adjustment     = 1
  cooldown               = 300
}

# 10. CloudWatch Alarm for Scale Down
resource "aws_cloudwatch_metric_alarm" "cpu_low_alarm" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "devonn-eks-cpu-low-\${var.environment}"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 3
  metric_name         = "node_cpu_utilization"
  namespace           = "AWS/EKS"
  period              = 300
  statistic           = "Average"
  threshold           = 30
  alarm_description   = "Average CPU utilization is lower than 30%"
  alarm_actions       = [aws_autoscaling_policy.scale_down_policy[0].arn]
  
  dimensions = {
    ClusterName = "devonn-eks-\${var.environment}"
  }
}

# 11. CloudWatch Alarm for Scale Up
resource "aws_cloudwatch_metric_alarm" "cpu_high_alarm" {
  count               = var.environment == "prod" ? 1 : 0
  alarm_name          = "devonn-eks-cpu-high-\${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "node_cpu_utilization"
  namespace           = "AWS/EKS"
  period              = 300
  statistic           = "Average"
  threshold           = 70
  alarm_description   = "Average CPU utilization is higher than 70%"
  alarm_actions       = [aws_autoscaling_policy.scale_up_policy[0].arn]
  
  dimensions = {
    ClusterName = "devonn-eks-\${var.environment}"
  }
}

# 12. Resource Tagging Strategy for Cost Allocation
provider "aws" {
  alias  = "security_region"
  region = var.aws_region
  access_key = var.aws_access_key
  secret_key = var.aws_secret_key
  default_tags {
    tags = {
    Project     = "devonn-ai"
    Environment = var.environment
    ManagedBy   = "terraform"
    CostCenter  = "engineering"
    Application = "devonn-\${var.environment}"
    Owner       = "devops-team"
    }
  }
}
  
`;

