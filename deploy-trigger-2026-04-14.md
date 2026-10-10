# Deployment Trigger

Triggered by ChatGPT on 2026-04-14 to start the existing GitHub Actions deployment workflow for Azure Container Apps.

Purpose:
- create a safe commit on `main`
- trigger CI/CD without changing application runtime code

Note:
Actual deployment success still depends on the configured Azure GitHub secrets, OIDC federated credential, subscription access, and Terraform backend settings.
