variable "region" {
  description = "AWS region for production resources."
  type        = string
  default     = "us-west-2"
}

variable "name_prefix" {
  description = "Name prefix for production resources."
  type        = string
  default     = "devonn-prod"
}

variable "cluster_name" {
  description = "Production EKS cluster name."
  type        = string
  default     = "devonn-eks-prod"
}

variable "vpc_cidr" {
  description = "Production VPC CIDR block."
  type        = string
  default     = "10.20.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones for production network planning."
  type        = number
  default     = 2
}

variable "node_desired" {
  description = "Desired EKS node count."
  type        = number
  default     = 1
}

variable "node_min" {
  description = "Minimum EKS node count."
  type        = number
  default     = 1
}

variable "node_max" {
  description = "Maximum EKS node count."
  type        = number
  default     = 2
}

variable "node_instance_types" {
  description = "EKS worker node instance types."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "tags" {
  description = "Common tags applied to production resources."
  type        = map(string)
  default = {
    Project     = "DevonnAI"
    Environment = "prod"
    ManagedBy   = "terraform"
  }
}
