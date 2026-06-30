# Terraform Infrastructure Documentation

## 🏗️ Overview

This document provides comprehensive guidance for managing the Supreme AI Deployment Hub infrastructure using Terraform. Our infrastructure supports multi-cloud deployments across AWS, Azure, and Google Cloud Platform.

## 📋 Prerequisites

### Required Tools
- [Terraform](https://www.terraform.io/downloads.html) v1.5.0+
- [GitHub CLI](https://cli.github.com/) for secrets management
- Cloud CLI tools:
  - [AWS CLI](https://aws.amazon.com/cli/) v2.0+
  - [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/) v2.0+
  - [Google Cloud SDK](https://cloud.google.com/sdk) v400.0+

### Authentication Setup

#### AWS
```bash
# Configure AWS credentials
aws configure
# Or use environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"
```

#### Azure
```bash
# Login to Azure
az login
# Set subscription
az account set --subscription "your-subscription-id"
```

#### Google Cloud
```bash
# Authenticate with GCP
gcloud auth login
gcloud config set project your-project-id
# Create service account key
gcloud iam service-accounts keys create terraform-key.json \
  --iam-account terraform@your-project.iam.gserviceaccount.com
```

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone https://github.com/your-org/supreme-ai-deployment-hub.git
cd supreme-ai-deployment-hub
chmod +x scripts/secrets-upload.sh
```

### 2. Configure Secrets
```bash
# Upload all required secrets to GitHub
./scripts/secrets-upload.sh

# Or manually set individual secrets
gh secret set AWS_ACCESS_KEY_ID --body "your-key"
gh secret set AZURE_CLIENT_ID --body "your-client-id"
gh secret set GCP_CREDENTIALS_JSON < gcp-credentials.json
```

### 3. Initialize Terraform
```bash
cd terraform/
terraform init
terraform validate
terraform plan
```

### 4. Deploy Infrastructure
```bash
# For staging
terraform workspace select staging
terraform apply -var="environment=staging"

# For production (requires approval in GitHub Actions)
git push origin main  # Triggers automated deployment
```

## 📁 Directory Structure

```
terraform/
├── main.tf                 # Main Terraform configuration
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── providers.tf            # Provider configurations
├── versions.tf             # Version constraints
├── modules/
│   ├── aws/
│   │   ├── eks/            # AWS EKS cluster
│   │   ├── rds/            # AWS RDS database
│   │   └── vpc/            # AWS networking
│   ├── azure/
│   │   ├── aks/            # Azure Kubernetes Service
│   │   ├── database/       # Azure Database
│   │   └── network/        # Azure networking
│   └── gcp/
│       ├── gke/            # Google Kubernetes Engine
│       ├── sql/            # Cloud SQL
│       └── network/        # GCP networking
├── environments/
│   ├── staging.tfvars      # Staging configuration
│   ├── production.tfvars   # Production configuration
│   └── development.tfvars  # Development configuration
└── scripts/
    ├── verify-completion.sh    # Post-deployment verification
    └── cleanup.sh             # Resource cleanup
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `environment` | Deployment environment | Yes | - |
| `region` | Primary deployment region | Yes | us-east-1 |
| `node_desired_capacity` | Desired number of K8s nodes | No | 2 |
| `node_max_capacity` | Maximum number of K8s nodes | No | 4 |
| `db_instance_class` | RDS instance class | No | db.t3.micro |
| `enable_monitoring` | Enable enhanced monitoring | No | true |
| `backup_retention_days` | Database backup retention | No | 7 |

### Production Configuration Example

```hcl
# environments/production.tfvars
environment = "production"
region = "us-east-1"

# EKS Configuration
node_desired_capacity = 3
node_max_capacity = 10
node_min_capacity = 3
node_instance_types = ["t3.large"]

# RDS Configuration
db_instance_class = "db.t3.medium"
db_allocated_storage = 100
db_max_allocated_storage = 500
backup_retention_period = 30

# Security Configuration
enable_encryption = true
enable_monitoring = true
enable_logging = true

# High Availability
single_nat_gateway = false
enable_multi_az = true
```

## 🔧 Common Operations

### Viewing Current State
```bash
# List all resources
terraform state list

# Show specific resource
terraform state show aws_eks_cluster.main

# View outputs
terraform output
```

### Making Changes
```bash
# Plan changes
terraform plan -var-file="environments/production.tfvars"

# Apply changes
terraform apply -var-file="environments/production.tfvars"

# Target specific resource
terraform apply -target=aws_eks_cluster.main
```

### Managing Workspaces
```bash
# List workspaces
terraform workspace list

# Create new workspace
terraform workspace new staging

# Switch workspace
terraform workspace select production
```

### Remote State Management
```bash
# Configure S3 backend
terraform {
  backend "s3" {
    bucket         = "your-terraform-state-bucket"
    key            = "supreme-ai/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}
```

## 🔒 Security Best Practices

### IAM and Permissions
- Use least privilege principle for all service accounts
- Enable MFA for admin access
- Regularly rotate access keys and secrets
- Use IAM roles instead of access keys where possible

### Network Security
```hcl
# Security group example
resource "aws_security_group" "web" {
  name_prefix = "${var.environment}-web-"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${var.environment}-web-sg"
    Environment = var.environment
  }
}
```

### Encryption
```hcl
# RDS encryption
resource "aws_db_instance" "main" {
  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds.arn
  # ... other configuration
}

# EKS secrets encryption
resource "aws_eks_cluster" "main" {
  encryption_config {
    resources = ["secrets"]
    provider {
      key_arn = aws_kms_key.eks.arn
    }
  }
  # ... other configuration
}
```

## 📊 Monitoring and Alerting

### CloudWatch Configuration
```hcl
# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "eks" {
  name              = "/aws/eks/${var.environment}/cluster"
  retention_in_days = 30
  
  tags = {
    Environment = var.environment
  }
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "${var.environment}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EKS"
  period              = "120"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors eks cpu utilization"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

### Setting Up Alerts
```hcl
# SNS Topic for alerts
resource "aws_sns_topic" "alerts" {
  name = "${var.environment}-infrastructure-alerts"
}

# Email subscription
resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}
```

## 🔄 CI/CD Integration

### GitHub Actions Workflow
The `.github/workflows/terraform.yml` file provides:
- Automated planning on PRs
- Deployment approvals for production
- Slack and email notifications
- Rollback capabilities

### Manual Deployment
```bash
# Trigger manual deployment
gh workflow run terraform.yml \
  -f environment=production \
  -f destroy=false
```

## 🆘 Troubleshooting

### Common Issues

#### State Lock Issues
```bash
# Force unlock (use with caution)
terraform force-unlock <lock-id>
```

#### Resource Import
```bash
# Import existing resource
terraform import aws_instance.example i-1234567890abcdef0
```

#### Debug Mode
```bash
# Enable debug logging
export TF_LOG=DEBUG
terraform apply
```

### Disaster Recovery

#### Backup State Files
```bash
# Download current state
terraform state pull > backup-$(date +%Y%m%d).tfstate

# Upload state backup
aws s3 cp backup-$(date +%Y%m%d).tfstate s3://your-backup-bucket/
```

#### Complete Recovery
```bash
# 1. Restore from backup
terraform state push backup-20240115.tfstate

# 2. Verify infrastructure
terraform plan

# 3. Apply if needed
terraform apply
```

## 📚 Additional Resources

- [Terraform Documentation](https://www.terraform.io/docs)
- [AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Azure Provider Documentation](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Google Cloud Provider Documentation](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [Terraform Best Practices](https://www.terraform.io/docs/cloud/guides/recommended-practices)

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/infrastructure-update`
2. Make changes and test locally
3. Run `terraform plan` to verify changes
4. Create pull request with detailed description
5. Wait for automated tests and peer review
6. Merge after approval

## 📞 Support

For infrastructure support:
- 📧 Email: devops@d3vonn.io
- 💬 Slack: #infrastructure
- 🎫 GitHub Issues: Create with `infrastructure` label

---

*Last updated: January 15, 2024*
*Version: 1.0.0*