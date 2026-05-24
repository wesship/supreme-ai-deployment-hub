variable "name_prefix" {
  description = "Name prefix used for EKS resources."
  type        = string
}

variable "cluster_name" {
  description = "EKS cluster name."
  type        = string
}

variable "subnet_ids" {
  description = "Subnet IDs used by the EKS control plane."
  type        = list(string)
}

variable "vpc_id" {
  description = "VPC ID for the EKS cluster."
  type        = string
}

variable "desired_capacity" {
  description = "Desired node capacity."
  type        = number
  default     = 1
}

variable "max_capacity" {
  description = "Maximum node capacity."
  type        = number
  default     = 2
}

variable "min_capacity" {
  description = "Minimum node capacity."
  type        = number
  default     = 1
}

variable "instance_types" {
  description = "EKS node instance types."
  type        = list(string)
  default     = ["t3.medium"]
}

variable "tags" {
  description = "Tags applied to EKS resources."
  type        = map(string)
  default     = {}
}

resource "aws_iam_role" "eks" {
  name = "${var.name_prefix}-eks-role"
  tags = var.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_eks_cluster" "this" {
  name     = var.cluster_name
  role_arn = aws_iam_role.eks.arn
  tags     = var.tags

  vpc_config {
    subnet_ids = var.subnet_ids
  }
}

output "cluster_name" {
  value = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.this.endpoint
}
