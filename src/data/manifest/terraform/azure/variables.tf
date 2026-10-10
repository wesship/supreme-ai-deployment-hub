# Variables for Azure Container Apps deployment

variable "resource_group_name" {
  description = "Name of the Azure Resource Group"
  type        = string
}

variable "location" {
  description = "Azure region to deploy resources"
  type        = string
  default     = "eastus"
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  default     = "development"
}

variable "container_app_environment_name" {
  description = "Name of the Container App Environment"
  type        = string
  default     = "devonn-development-env"
}

variable "container_app_name" {
  description = "Base name for Container Apps"
  type        = string
  default     = "devonn-app"
}

variable "backend_image" {
  description = "Backend container image name with tag"
  type        = string
}

variable "frontend_image" {
  description = "Frontend container image name with tag"
  type        = string
}
