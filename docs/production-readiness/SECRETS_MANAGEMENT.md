# Production Secrets Management

To fully unblock the CI/CD pipeline and achieve a deployable SaaS state, the following secrets must be configured in **GitHub -> Settings -> Secrets and variables -> Actions**.

## Required Secrets

| Secret Name | Purpose | Required For | How to Obtain |
|---|---|---|---|
| `AWS_ROLE_ARN` | Authenticates GitHub Actions to AWS via OIDC | Terraform Plan/Deploy | Create an IAM Identity Provider in AWS for `token.actions.githubusercontent.com` |
| `CODECOV_TOKEN` | Uploads coverage reports to Codecov | CI Quality Gates | Sign in to codecov.io with GitHub, add repo, copy token |
| `SUPABASE_ACCESS_TOKEN` | Authenticates Deno CLI to Supabase | Edge Functions Typecheck | Generate at supabase.com/dashboard/account/tokens |
| `INFRACOST_API_KEY` | Generates cloud cost estimates on PRs | Terraform Cost Estimate | Run `infracost auth login` locally to get API key |

## Best Practices

1. **Never** hardcode these values in any script or configuration file.
2. Ensure the AWS Role uses the principle of least privilege, restricted specifically to the `wesship/supreme-ai-deployment-hub` repository and `main` branch.
3. Rotate the `SUPABASE_ACCESS_TOKEN` every 90 days.
