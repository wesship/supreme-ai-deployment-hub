variable "gcp_project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "GCP_CREDENTIALS_JSON" {
  description = "Base64-encoded GCP credentials JSON"
  type        = string
  sensitive   = true
}

variable "gcp_region" {
  description = "The GCP region"
  type        = string
  default     = "us-central1"
}

variable "gcp_zone" {
  description = "The GCP zone"
  type        = string
  default     = "us-central1-a"
}

variable "gcp_image" {
  description = "The image to use for the compute instances"
  type        = string
  default     = "projects/debian-cloud/global/images/family/debian-12"
}

variable "instance_type" {
  description = "The instance type for the compute instances"
  type        = string
  default     = "e2-micro"
}

variable "environment" {
  description = "The environment (e.g., production, staging)"
  type        = string
  default     = "development"
}

variable "gcp_access_log_bucket_name" {
  description = "Existing hardened Cloud Storage bucket that receives access logs"
  type        = string
}

variable "gcp_disk_kms_key_self_link" {
  description = "Cloud KMS key self-link used for Compute Engine boot disk encryption"
  type        = string
}

variable "gcp_network_self_link" {
  description = "VPC network self-link used by private Compute Engine instances"
  type        = string
}

variable "gcp_private_subnetwork_self_link" {
  description = "Private subnetwork self-link used by Compute Engine instances"
  type        = string
}

variable "gcp_service_account_email" {
  description = "Least-privilege service account email attached to Compute Engine instances"
  type        = string
}
