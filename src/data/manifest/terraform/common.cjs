
// Common configuration elements for Terraform AWS deployment

export const commonConfigYaml = `# --- Common Terraform Configuration ---

# Terraform configuration for setting up AWS infrastructure
# To use this file:
# 1. Install Terraform CLI (https://learn.hashicorp.com/tutorials/terraform/install-cli)
# 2. Configure AWS credentials using AWS CLI, environment variables, or GitHub OIDC.
#    Do not hard-code AWS credentials in Terraform provider blocks.
# 3. Run the following commands in the directory containing these Terraform files:
#    $ terraform init
#    $ terraform plan -out=tfplan -var-file="environments/\${ENV:-prod}.tfvars"
#    $ terraform apply tfplan

# --------------------------------------------
# IMPORTANT DEPLOYMENT CONSIDERATIONS
# --------------------------------------------
#
# REGIONS AND MULTI-REGION STRATEGY:
# - Primary deployment region: us-west-2 (Oregon)
# - For production, consider additional regions for high availability:
#   - us-east-1 (N. Virginia) - for US East coverage
#   - eu-west-1 (Ireland) - for European coverage
#   - ap-southeast-1 (Singapore) - for APAC coverage
# - Use Route53 for global DNS routing and failover between regions
# - Enable cross-region replication for S3 buckets containing static assets
#
# DATABASE BACKUP STRATEGY:
# - RDS automated backups: Enabled with 7-day retention (configurable)
# - Additional recommendations:
#   - Set up AWS Backup to create cross-region backups
#   - Configure point-in-time recovery (PITR)
#   - For critical data, consider read replicas in secondary regions
#   - Export regular snapshots to S3 with lifecycle policies for long-term retention
#
# MONITORING AND ALERTING:
# - Leverage CloudWatch for basic metrics and alerting
# - Consider enhanced monitoring with:
#   - CloudWatch Container Insights for Kubernetes metrics
#   - AWS X-Ray for distributed tracing
#   - Third-party options: Datadog, New Relic, or Prometheus/Grafana stack
# - Set up alerts for:
#   - CPU/Memory thresholds (>80%)
#   - Error rate increases
#   - Latency spikes
#   - Database connection issues
#
# CERTIFICATE MANAGEMENT:
# - For production environments:
#   - Provision certificates through AWS Certificate Manager (ACM)
#   - Set up automatic renewal
#   - For multi-region, create certificates in each region
#   - Use cert-manager in Kubernetes for service mesh certificates
#
# COST OPTIMIZATION:
# - Review and adjust instance sizes based on actual usage patterns
# - Implement auto-scaling for variable workloads
# - Consider Spot Instances for non-critical workloads
# - Enable AWS Cost Explorer and set up budget alerts
# - Regular review of unused/underutilized resources
#
# --------------------------------------------

# Recommended: Use S3 backend for team collaboration
terraform {
  backend "s3" {
    bucket         = "d3vonn-terraform-statefile"
    key            = "terraform.tfstate"
    region         = "us-west-2"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}

# Define the AWS provider and region.
# Credentials are intentionally omitted so Terraform uses the standard AWS
# provider credential chain: GitHub OIDC, environment variables, shared config,
# or instance profile. This prevents static secrets from being embedded in the
# generated Terraform configuration.
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "DevonnAI"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "DevOps"
    }
  }
}
   
provider "aws" {
  alias  = "dr_region"
  region = var.dr_region

  default_tags {
    tags = {
      Project     = "DevonnAI"
      Environment = var.environment
      ManagedBy   = "Terraform"
      Owner       = "DevOps"
    }
  }
}

# Add this after your AWS providers
provider "kubernetes" {
  host                   = data.aws_eks_cluster.cluster.endpoint
  cluster_ca_certificate = base64decode(data.aws_eks_cluster.cluster.certificate_authority[0].data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args = [
      "eks",
      "get-token",
      "--cluster-name",
      data.aws_eks_cluster.cluster.name
    ]
  }
}

data "aws_eks_cluster" "cluster" {
  region = "us-west-2"
  name   = module.eks.cluster_name
}
data "aws_eks_cluster_auth" "cluster" {
  region = "us-west-2"
  name   = module.eks.cluster_name
}

`;