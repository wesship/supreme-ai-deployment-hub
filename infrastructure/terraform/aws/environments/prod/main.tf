terraform {
  required_version = ">= 1.5.0"
}

provider "aws" {
  region = var.region
}

module "network" {
  source = "../../modules/network"

  name_prefix = var.name_prefix
  cidr_block  = var.vpc_cidr
  az_count    = var.az_count
  tags        = var.tags
}

module "ecr" {
  source = "../../modules/ecr"

  name_prefix = var.name_prefix
  tags        = var.tags
}

module "eks" {
  source = "../../modules/eks"

  name_prefix      = var.name_prefix
  cluster_name     = var.cluster_name
  subnet_ids       = module.network.private_subnet_ids
  vpc_id           = module.network.vpc_id
  desired_capacity = var.node_desired
  max_capacity     = var.node_max
  min_capacity     = var.node_min
  instance_types   = var.node_instance_types
  tags             = var.tags
}

output "cluster_name" {
  value = module.eks.cluster_name
}

output "cluster_endpoint" {
  value = module.eks.cluster_endpoint
}

output "ecr_repositories" {
  value = module.ecr.repository_urls
}
