variable "aws_region" {
  description = "The AWS region to deploy to"
  type        = string
  default     = "us-east-1"
}

variable "aws_ami_id" {
  description = "AMI ID to use for EC2 instances"
  type        = string
}

variable "instance_type" {
  description = "The instance type for EC2"
  type        = string
  default     = "t3.micro"
}

variable "environment" {
  description = "The environment (e.g., production, staging)"
  type        = string
  default     = "development"
}

variable "aws_s3_kms_key_arn" {
  description = "KMS key ARN used for primary S3 bucket encryption"
  type        = string
}

variable "aws_access_log_bucket_name" {
  description = "Existing hardened S3 bucket that receives access logs"
  type        = string
}

variable "aws_s3_replication_role_arn" {
  description = "IAM role ARN used by S3 cross-region replication"
  type        = string
}

variable "aws_s3_replica_bucket_arn" {
  description = "Destination bucket ARN for cross-region replication"
  type        = string
}

variable "aws_s3_replica_kms_key_arn" {
  description = "KMS key ARN used to encrypt replicated S3 objects"
  type        = string
}

variable "aws_instance_profile_name" {
  description = "Least-privilege IAM instance profile attached to EC2 instances"
  type        = string
}

variable "aws_security_group_ids" {
  description = "Security group IDs assigned to the private EC2 instances"
  type        = list(string)
}

variable "aws_private_subnet_id" {
  description = "Private subnet ID used by the EC2 instances"
  type        = string
}

variable "aws_ebs_kms_key_arn" {
  description = "KMS key ARN used for EC2 root volume encryption"
  type        = string
}
