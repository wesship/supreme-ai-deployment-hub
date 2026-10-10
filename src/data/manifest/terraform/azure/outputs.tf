# Outputs for Azure Container Apps deployment

output "resource_group_name" {
  value       = azurerm_resource_group.rg.name
  description = "The name of the Resource Group"
}

output "backend_url" {
  value       = "https://${azurerm_container_app.backend.latest_revision_fqdn}"
  description = "The FQDN of the Backend API"
}

output "frontend_url" {
  value       = "https://${azurerm_container_app.frontend.latest_revision_fqdn}"
  description = "The FQDN of the Frontend App"
}

output "application_insights_instrumentation_key" {
  value       = azurerm_application_insights.insights.instrumentation_key
  description = "Application Insights instrumentation key"
  sensitive   = true
}

output "log_analytics_workspace_id" {
  value       = azurerm_log_analytics_workspace.workspace.id
  description = "Log Analytics Workspace ID"
}
