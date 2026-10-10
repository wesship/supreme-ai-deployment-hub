
// Kubernetes configurations and CI/CD for Terraform

export const kubernetesConfigYaml = `# --- Kubernetes Configuration ---

# 6. Kubernetes Secrets and ConfigMaps
# Apply these after the cluster is provisioned
# apiVersion: v1
# kind: ConfigMap
# metadata:
#   name: flask-config
#   namespace: devonn
#   labels:
#     app: flask-backend
# data:
#   FLASK_ENV: production
#   DATABASE_HOST: external-postgres

# 7. Cert-Manager for SSL
# Install cert-manager using Helm after cluster setup
# helm repo add jetstack https://charts.jetstack.io
# helm repo update
# helm install cert-manager jetstack/cert-manager --namespace cert-manager --create-namespace --set installCRDs=true

# 8. GitHub Actions CI/CD Pipeline
# Store this in .github/workflows/deploy.yml
# name: Deploy Devonn.AI to EKS
# on:
#   push:
#     branches:
#       - main
# jobs:
#   deploy:
#     runs-on: ubuntu-latest
#     steps:
#       - name: Checkout Code
#         uses: actions/checkout@v3
#       - name: Configure AWS Credentials
#         uses: aws-actions/configure-aws-credentials@v2
#         with:
#           aws-access-key-id: \${{ secrets.AWS_ACCESS_KEY_ID }}
#           aws-secret-access-key: \${{ secrets.AWS_SECRET_ACCESS_KEY }}
#           aws-region: \${{ secrets.AWS_REGION }}
#       - name: Build and Push Docker Images
#         run: |
#           aws ecr get-login-password --region \${{ secrets.AWS_REGION }} | docker login --username AWS --password-stdin \${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.\${{ secrets.AWS_REGION }}.amazonaws.com
#           docker build -t \${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.\${{ secrets.AWS_REGION }}.amazonaws.com/devonn-backend:latest -f Dockerfile.backend .
#           docker build -t \${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.\${{ secrets.AWS_REGION }}.amazonaws.com/devonn-frontend:latest -f Dockerfile.frontend .
#           docker push \${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.\${{ secrets.AWS_REGION }}.amazonaws.com/devonn-backend:latest
#           docker push \${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.\${{ secrets.AWS_REGION }}.amazonaws.com/devonn-frontend:latest
#       - name: Deploy to EKS
#         run: |
#           aws eks update-kubeconfig --name devonn-eks-\${{ secrets.ENVIRONMENT }} --region \${{ secrets.AWS_REGION }}
#           kubectl apply -f k8s/`;
