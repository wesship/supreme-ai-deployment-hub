
// File list for the deployment manifest
export const deploymentFilesText = `
# DEVONN.AI Framework - Deployment File Manifest

## Frontend Assets
- /dist/index.html
- /dist/assets/**/*

## Kubernetes Configuration Files
- /k8s/backend-deployment.yaml
- /k8s/frontend-deployment.yaml
- /k8s/database-statefulset.yaml
- /k8s/redis-statefulset.yaml
- /k8s/ingress.yaml
- /k8s/services.yaml
- /k8s/configmaps.yaml
- /k8s/secrets.yaml

## Istio Service Mesh
- /istio/virtual-service.yaml
- /istio/destination-rule.yaml
- /istio/authorization-policy.yaml
- /istio/gateway.yaml

## Kong API Gateway
- /kong/ingress.yaml
- /kong/rate-limiting.yaml
- /kong/authentication-plugin.yaml
- /kong/cors-plugin.yaml

## Monitoring & Observability
- /prometheus/prometheus.yaml
- /prometheus/alerting-rules.yaml
- /grafana/dashboards/devonn-ai-dashboard.json
- /grafana/datasources/prometheus-datasource.yaml
- /jaeger/jaeger.yaml
- /loki/loki.yaml
- /loki/promtail.yaml

## Argo Rollouts (Canary Deployments)
- /argo/rollout.yaml
- /argo/analysis-template.yaml

## Elasticsearch, Fluentd, Kibana (Logging)
- /efk/elasticsearch.yaml
- /efk/fluentd-configmap.yaml
- /efk/fluentd-daemonset.yaml
- /efk/kibana.yaml

## CI/CD Pipeline
- /.github/workflows/build-and-deploy.yaml
- /.gitlab-ci.yml
- /Jenkinsfile

## Documentation
- /docs/**/*
- /README.md
- /DEPLOYMENT.md
- /TROUBLESHOOTING.md

## Docker Files
- /Dockerfile.backend
- /Dockerfile.frontend
- /docker-compose.yaml
- /.dockerignore

## Miscellaneous
- /.gitignore
- /package.json
- /tsconfig.json
- /vite.config.ts

## Terraform AWS Infrastructure
- /terraform/main.tf
- /terraform/variables.tf
- /terraform/outputs.tf
- /terraform/providers.tf
- /terraform/vpc.tf
- /terraform/eks.tf
- /terraform/rds.tf
- /terraform/iam.tf`;
