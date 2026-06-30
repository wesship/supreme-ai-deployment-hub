# ----------------------------------------------------
# Azure Container Apps Terraform Configuration
# ----------------------------------------------------

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }

  backend "azurerm" {
    # Backend configuration will be provided via CLI parameters
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

# ----------------------------------------------------
# Resource Group
# ----------------------------------------------------
resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    Environment = var.environment
    Terraform   = "true"
    Project     = "Devonn.AI"
  }
}

# ----------------------------------------------------
# Log Analytics Workspace
# ----------------------------------------------------
resource "azurerm_log_analytics_workspace" "workspace" {
  name                = "d3vonn-${var.environment}-logs"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = {
    Environment = var.environment
    Terraform   = "true"
  }
}

# ----------------------------------------------------
# Container Apps Environment
# ----------------------------------------------------
resource "azurerm_container_app_environment" "env" {
  name                       = var.container_app_environment_name
  resource_group_name        = azurerm_resource_group.rg.name
  location                   = azurerm_resource_group.rg.location
  log_analytics_workspace_id = azurerm_log_analytics_workspace.workspace.id

  tags = {
    Environment = var.environment
    Terraform   = "true"
  }
}

# ----------------------------------------------------
# Backend Container App (API)
# ----------------------------------------------------
resource "azurerm_container_app" "backend" {
  name                         = "${var.container_app_name}-backend"
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.env.id
  revision_mode                = "Single"

  template {
    container {
      name   = "backend"
      image  = var.backend_image
      cpu    = "0.5"
      memory = "1Gi"

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }

      env {
        name  = "LOG_LEVEL"
        value = var.environment == "prod" ? "INFO" : "DEBUG"
      }
    }

    min_replicas = 1
    max_replicas = 10
  }

  ingress {
    external_enabled = true
    target_port      = 8000
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = {
    Environment = var.environment
    Terraform   = "true"
  }
}

# ----------------------------------------------------
# Frontend Container App (UI)
# ----------------------------------------------------
resource "azurerm_container_app" "frontend" {
  name                         = "${var.container_app_name}-frontend"
  resource_group_name          = azurerm_resource_group.rg.name
  container_app_environment_id = azurerm_container_app_environment.env.id
  revision_mode                = "Single"

  template {
    container {
      name   = "frontend"
      image  = var.frontend_image
      cpu    = "0.25"
      memory = "0.5Gi"
    }

    min_replicas = 1
    max_replicas = 5
  }

  ingress {
    external_enabled = true
    target_port      = 80
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  tags = {
    Environment = var.environment
    Terraform   = "true"
  }
}

# ----------------------------------------------------
# Application Insights
# ----------------------------------------------------
resource "azurerm_application_insights" "insights" {
  name                = "d3vonn-${var.environment}-insights"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  application_type    = "web"
  workspace_id        = azurerm_log_analytics_workspace.workspace.id

  tags = {
    Environment = var.environment
    Terraform   = "true"
  }
}
