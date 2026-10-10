
// Variables definition for Terraform

export const variablesConfigYaml = `# --- Variables Configuration ---

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-west-2"
}

variable "aws_access_key" {
  description = "AWS access key"
  type        = string
  sensitive   = true
}

variable "aws_secret_key" {
  description = "AWS secret key"
  type        = string
  sensitive   = true
}

variable "dr_region" {
  description = "Disaster recovery region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, production)"
  type        = string
  default     = "prod"
}

variable "admin_cidr" {
  description = "CIDR block for admin access to EKS API (e.g., CI/CD pipeline or admin IPs)"
  type        = string
  default     = "0.0.0.0/0"  
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones to use"
  type        = list(string)
  default     = ["us-west-2a", "us-west-2b", "us-west-2c", "us-west-2d"]
}

variable "private_subnet_cidrs" {
  description = "List of private subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "public_subnet_cidrs" {
  description = "List of public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24"]
}

variable "node_desired_capacity" {
  description = "Desired number of worker nodes"
  type        = number
  default     = 2
}

variable "node_max_capacity" {
  description = "Maximum number of worker nodes"
  type        = number
  default     = 4
}

variable "node_min_capacity" {
  description = "Minimum number of worker nodes"
  type        = number
  default     = 1
}

variable "node_instance_types" {
  description = "EC2 instance types for worker nodes"
  type        = list(string)
  default     = ["t3.small"]
}

variable "node_disk_size" {
  description = "Disk size for worker nodes in GB"
  type        = number
  default     = 50
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS instance in GB"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Maximum allocated storage for RDS instance in GB"
  type        = number
  default     = 50
}

variable "db_password" {
  description = "Password for the RDS database"
  type        = string
  sensitive   = true
}

# Declare use_snapshot variable
variable "use_snapshot" {
  description = "Flag to indicate whether to use a snapshot."
  type        = bool
  default     = false  
}

# Declare snapshot_identifier variable
variable "snapshot_identifier" {
  description = "The snapshot identifier to use if use_snapshot is true."
  type        = string
  default     = ""  
}

variable "db_replica_instance_class" {
  description = "RDS instance class for read replicas"
  type        = string
  default     = "db.t3.micro"
}

variable "enable_cross_region_replica" {
  description = "Enable cross-region RDS read replica"
  type        = bool
  default     = false
}

variable "db_dr_instance_class" {
  description = "RDS instance class for cross-region disaster recovery replicas"
  type        = string
  default     = "db.t3.micro"
}

variable "family" {
  description = "The engine family for the DB parameter group (e.g., postgres14, mysql8.0)"
  type        = string
  default     = "postgres14"
}

variable "create" {
  type    = bool
  default = true 
}

variable "kubernetes_version" {
  type    = string
  default = null
}

variable "enable_guardduty" {
  type    = bool
  default = false
}

variable "enable_securityhub" {
  type    = bool
  default = false
}

// variable "AWS_ENVOY_CRT" {
//   description = "The certificate for Envoy"
//   type        = string
// }

// variable "AWS_ENVOY_KEY" {
//   description = "The key for Envoy"
//   type        = string
// }

`;


