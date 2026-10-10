
// VPC and networking configuration for Terraform

export const vpcConfigYaml = `# --- VPC Configuration ---

# 1. VPC Configuration
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.1.0"

  name = "devonn-vpc-\${var.environment}"
  cidr = var.vpc_cidr
  azs             = var.availability_zones
  private_subnets = var.private_subnet_cidrs
  public_subnets  = var.public_subnet_cidrs

  enable_nat_gateway = true
  single_nat_gateway = var.environment != "production"  # Use multiple NAT gateways in production
  enable_dns_hostnames = true
  
  # EKS requires specific tags on subnets for load balancer discovery
  private_subnet_tags = {
    "kubernetes.io/cluster/devonn-eks-\${var.environment}" = "shared"
    "kubernetes.io/role/internal-elb" = "1"
  }
  
  public_subnet_tags = {
    "kubernetes.io/cluster/devonn-eks-\${var.environment}" = "shared"
    "kubernetes.io/role/elb" = "1"
  }
}`;
