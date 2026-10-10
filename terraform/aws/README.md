# AWS Terraform Scaffold for Supreme AI Deployment Hub

This directory adds a clean AWS infrastructure layer alongside the existing Azure Terraform stack.

## Layout

- `bootstrap/backend/` — creates the S3 bucket and DynamoDB table for Terraform remote state
- `environments/prod/` — production AWS environment entrypoint
- `modules/network/` — VPC, subnets, NAT, and tagging
- `modules/ecr/` — ECR repositories for backend, frontend, workers, and optional vision services
- `modules/eks/` — EKS cluster, managed node groups, IRSA/OIDC enablement
- `modules/iam_github_oidc/` — GitHub Actions OIDC trust and deploy role

## Intended flow

1. Run `bootstrap/backend` once to create the remote state backend.
2. Configure the backend block in `environments/prod/providers.tf` with your bucket, table, region, and key.
3. Add GitHub repository secrets and variables used by `.github/workflows/terraform-aws.yml`.
4. Run the AWS workflow in plan mode.
5. Apply once the plan is correct.
6. Deploy workloads to the new EKS cluster using Helm, Kustomize, or Argo CD.

## Required GitHub Secrets

- `AWS_ROLE_ARN`

## Required GitHub Variables

- `AWS_REGION`
- `TF_STATE_BUCKET`
- `TF_LOCK_TABLE`
- `TF_STATE_KEY`

## Optional tfvars inputs

See `terraform/aws/environments/prod/variables.tf` for the full list.
