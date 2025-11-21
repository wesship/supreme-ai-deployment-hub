# Comprehensive Deployment Guide

This guide covers deployment procedures for the Devonn.AI platform across different environments and cloud providers.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [CI/CD Workflows](#cicd-workflows)
- [Cloud Deployments](#cloud-deployments)
- [Rollback Procedures](#rollback-procedures)
- [Monitoring](#monitoring)

## Prerequisites

### Required Tools

- **Node.js** 22.x or higher
- **Python** 3.11 or higher
- **Docker** 20.x or higher
- **GitHub CLI** (for manual deployments)
- **Cloud CLI** (AWS CLI, Azure CLI, or GCP SDK)

### Required Secrets

Configure these secrets in GitHub repository settings (Settings → Secrets and variables → Actions):

#### Core Secrets
```
GITHUB_TOKEN          # Automatically provided
JWT_SECRET            # Generate with: openssl rand -hex 32
ENCRYPTION_KEY        # Generate with: openssl rand -hex 32
```

#### Cloud Provider Secrets

**AWS:**
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_ROLE_ARN
```

**Azure:**
```
AZURE_CLIENT_ID
AZURE_CLIENT_SECRET
AZURE_TENANT_ID
AZURE_SUBSCRIPTION_ID
```

**GCP:**
```
GCP_CREDENTIALS_JSON
```

#### Optional Secrets
```
SLACK_WEBHOOK_URL     # For deployment notifications
OPENAI_API_KEY        # For AI features
VERCEL_TOKEN          # For Vercel deployments
```

## Environment Setup

### Local Development

```bash
# Clone repository
git clone https://github.com/wesship/supreme-ai-deployment-hub.git
cd supreme-ai-deployment-hub

# Install dependencies
npm ci --legacy-peer-deps
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Run development servers
npm run dev              # Frontend
uvicorn src.main:app --reload  # Backend
```

### Environment Variables

Create a `.env` file with:

```bash
# API Configuration
API_URL=http://localhost:8000
ENVIRONMENT=development

# Authentication
JWT_SECRET=your-jwt-secret
ENCRYPTION_KEY=your-encryption-key

# API Keys
OPENAI_API_KEY=your-openai-key
HUGGINGFACE_API_KEY=your-hf-key
ELEVENLABS_API_KEY=your-elevenlabs-key

# Database (if using)
DB_USERNAME=postgres
DB_PASSWORD=your-password
DB_NAME=devonn_ai
```

## CI/CD Workflows

### Continuous Integration (ci.yml)

Runs on every push and PR:

1. **Frontend CI** - Lints, tests, builds React app
2. **Backend CI** - Lints, tests Python FastAPI
3. **Docker Build** - Builds container images
4. **Security Scan** - Vulnerability scanning

**Trigger manually:**
```bash
gh workflow run ci.yml
```

### Continuous Deployment (cd.yml)

Handles multi-environment deployments:

**Automatic triggers:**
- Push to `main` → Deploy to Development
- Tag `v*` → Deploy to Production

**Manual trigger:**
```bash
# Deploy to specific environment
gh workflow run cd.yml -f environment=staging
gh workflow run cd.yml -f environment=production
```

### Dependency Management (dependencies.yml)

Automated weekly dependency updates:

- Runs every Monday at 9 AM UTC
- Creates PR with updates
- Includes security fixes

**Trigger manually:**
```bash
gh workflow run dependencies.yml
```

## Cloud Deployments

### Docker Deployment

**Build images:**

```bash
# Frontend
docker build -f Dockerfile.frontend -t devonn-ai-frontend:latest .

# Backend
docker build -f Dockerfile -t devonn-ai-backend:latest .
```

**Run with Docker Compose:**

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Vercel Deployment

**Install Vercel CLI:**
```bash
npm i -g vercel
```

**Deploy:**
```bash
# Development
vercel

# Production
vercel --prod
```

**Configure environment variables in Vercel dashboard:**
- Go to Project Settings → Environment Variables
- Add all required secrets

### AWS Deployment

**Using AWS ECS:**

```bash
# Configure AWS CLI
aws configure

# Create ECR repository
aws ecr create-repository --repository-name devonn-ai-backend

# Login to ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Tag and push image
docker tag devonn-ai-backend:latest \
  <account-id>.dkr.ecr.us-east-1.amazonaws.com/devonn-ai-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/devonn-ai-backend:latest

# Create ECS task definition and service
aws ecs create-service \
  --cluster devonn-ai-cluster \
  --service-name backend \
  --task-definition devonn-ai-backend \
  --desired-count 2
```

### Azure Deployment

**Using Azure Container Apps:**

```bash
# Login to Azure
az login

# Create resource group
az group create --name devonn-ai-rg --location eastus

# Create container registry
az acr create --resource-group devonn-ai-rg \
  --name devonnairegistry --sku Basic

# Login to ACR
az acr login --name devonnairegistry

# Tag and push image
docker tag devonn-ai-backend:latest \
  devonnairegistry.azurecr.io/devonn-ai-backend:latest
docker push devonnairegistry.azurecr.io/devonn-ai-backend:latest

# Create container app
az containerapp create \
  --name devonn-ai-backend \
  --resource-group devonn-ai-rg \
  --image devonnairegistry.azurecr.io/devonn-ai-backend:latest \
  --target-port 8000 \
  --ingress external
```

### GCP Deployment

**Using Google Cloud Run:**

```bash
# Authenticate
gcloud auth login

# Set project
gcloud config set project your-project-id

# Build and push to Container Registry
gcloud builds submit --tag gcr.io/your-project-id/devonn-ai-backend

# Deploy to Cloud Run
gcloud run deploy devonn-ai-backend \
  --image gcr.io/your-project-id/devonn-ai-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Rollback Procedures

### Via GitHub Actions

**Redeploy previous version:**

```bash
# Find previous successful tag
git tag -l "v*" | tail -5

# Trigger deployment with previous version
git checkout v1.0.0
gh workflow run cd.yml -f environment=production
```

### Via Docker

```bash
# Pull previous version
docker pull devonn-ai-backend:v1.0.0

# Stop current container
docker stop devonn-ai-backend
docker rm devonn-ai-backend

# Start previous version
docker run -d --name devonn-ai-backend \
  -p 8000:8000 \
  devonn-ai-backend:v1.0.0
```

### Via Cloud Providers

**AWS ECS:**
```bash
aws ecs update-service \
  --cluster devonn-ai-cluster \
  --service backend \
  --task-definition backend:previous-revision
```

**Azure Container Apps:**
```bash
az containerapp revision activate \
  --name devonn-ai-backend \
  --resource-group devonn-ai-rg \
  --revision previous-revision-name
```

**GCP Cloud Run:**
```bash
gcloud run services update-traffic devonn-ai-backend \
  --to-revisions=previous-revision=100
```

## Monitoring

### Health Checks

**Backend API:**
```bash
curl https://api.devonn.ai/health
curl https://api.devonn.ai/docs  # API documentation
```

**Frontend:**
```bash
curl https://devonn.ai
```

### Logs

**Docker:**
```bash
docker logs -f devonn-ai-backend
docker logs -f devonn-ai-frontend
```

**AWS CloudWatch:**
```bash
aws logs tail /ecs/devonn-ai-backend --follow
```

**Azure:**
```bash
az containerapp logs show \
  --name devonn-ai-backend \
  --resource-group devonn-ai-rg \
  --follow
```

**GCP:**
```bash
gcloud logging read "resource.type=cloud_run_revision" --limit 50
```

### Key Metrics

Monitor these metrics:

- **Response Time** - API latency (target: <200ms)
- **Error Rate** - 4xx/5xx responses (target: <1%)
- **CPU Usage** - Container utilization (target: <70%)
- **Memory Usage** - Container memory (target: <80%)
- **Request Rate** - Requests per second

## Troubleshooting

### Build Failures

```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps

# Clear Python cache
find . -type d -name __pycache__ -exec rm -r {} +
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

### Deployment Failures

1. **Check secrets** - Verify all required secrets are configured
2. **Check logs** - Review GitHub Actions workflow logs
3. **Check permissions** - Verify cloud provider credentials
4. **Check quotas** - Ensure cloud resource limits aren't exceeded

### Runtime Errors

1. **Check environment variables** - Verify all required vars are set
2. **Check database connections** - Test DB connectivity
3. **Check API keys** - Verify external service keys are valid
4. **Review logs** - Check application logs for stack traces

## Best Practices

### Version Tagging

```bash
# Semantic versioning: MAJOR.MINOR.PATCH
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### Environment Promotion

1. **Development** → Test locally
2. **Staging** → QA testing
3. **Production** → Release to users

### Security

- Rotate secrets regularly (every 90 days)
- Use least-privilege IAM roles
- Enable audit logging
- Implement rate limiting
- Use HTTPS everywhere

### Performance

- Enable CDN for static assets
- Use container image caching
- Implement database connection pooling
- Enable compression
- Monitor and optimize slow queries

## Support

- **Documentation**: See [README.md](../README.md)
- **Contributing**: See [CONTRIBUTING.md](../CONTRIBUTING.md)
- **Security**: See [SECURITY.md](../SECURITY.md)
- **Issues**: https://github.com/wesship/supreme-ai-deployment-hub/issues
