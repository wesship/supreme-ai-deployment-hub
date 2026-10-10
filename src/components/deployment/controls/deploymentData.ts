
import { CloudProvider } from '@/types/deployment';

interface DeploymentCommand {
  id: string;
  title: string;
  description: string;
  command: string;
  provider?: CloudProvider;
}

export const deploymentCommandsData: DeploymentCommand[] = [
  // AWS Commands
  {
    id: 'aws-configure',
    title: 'Configure AWS CLI',
    description: 'Set up your AWS credentials for Terraform',
    command: 'aws configure',
    provider: 'aws'
  },
  {
    id: 'aws-terraform-init',
    title: 'Initialize Terraform (AWS)',
    description: 'Set up Terraform in your project directory for AWS',
    command: 'terraform init -backend-config="bucket=devonn-terraform-statefile" -backend-config="region=us-west-2"',
    provider: 'aws'
  },
  {
    id: 'aws-terraform-plan',
    title: 'Plan Terraform Deployment',
    description: 'Create an execution plan for your AWS infrastructure',
    command: 'terraform plan -out=tfplan -var-file="environments/aws-prod.tfvars"',
    provider: 'aws'
  },
  {
    id: 'aws-terraform-apply',
    title: 'Apply Terraform Plan',
    description: 'Deploy your infrastructure to AWS',
    command: 'terraform apply tfplan',
    provider: 'aws'
  },
  {
    id: 'aws-kubeconfig',
    title: 'Get AWS Kubeconfig',
    description: 'Configure kubectl to connect to your EKS cluster',
    command: 'aws eks update-kubeconfig --name devonn-eks-prod --region us-west-2',
    provider: 'aws'
  },

  // Azure Commands
  {
    id: 'azure-login',
    title: 'Login to Azure',
    description: 'Authenticate with Azure CLI',
    command: 'az login',
    provider: 'azure'
  },
  {
    id: 'azure-terraform-init',
    title: 'Initialize Terraform (Azure)',
    description: 'Set up Terraform in your project directory for Azure',
    command: 'terraform init -backend-config="storage_account_name=devonnterraformstate" -backend-config="container_name=tfstate"',
    provider: 'azure'
  },
  {
    id: 'azure-terraform-plan',
    title: 'Plan Terraform Deployment',
    description: 'Create an execution plan for your Azure infrastructure',
    command: 'terraform plan -out=tfplan -var-file="environments/azure-prod.tfvars"',
    provider: 'azure'
  },
  {
    id: 'azure-terraform-apply',
    title: 'Apply Terraform Plan',
    description: 'Deploy your infrastructure to Azure',
    command: 'terraform apply tfplan',
    provider: 'azure'
  },
  {
    id: 'azure-kubeconfig',
    title: 'Get Azure Kubeconfig',
    description: 'Configure kubectl to connect to your AKS cluster',
    command: 'az aks get-credentials --resource-group devonn-prod-rg --name devonn-aks-prod',
    provider: 'azure'
  },

  // GCP Commands
  {
    id: 'gcp-login',
    title: 'Login to GCP',
    description: 'Authenticate with Google Cloud',
    command: 'gcloud auth login',
    provider: 'gcp'
  },
  {
    id: 'gcp-terraform-init',
    title: 'Initialize Terraform (GCP)',
    description: 'Set up Terraform in your project directory for GCP',
    command: 'terraform init -backend-config="bucket=devonn-terraform-statefile" -backend-config="prefix=terraform/state"',
    provider: 'gcp'
  },
  {
    id: 'gcp-terraform-plan',
    title: 'Plan Terraform Deployment',
    description: 'Create an execution plan for your GCP infrastructure',
    command: 'terraform plan -out=tfplan -var-file="environments/gcp-prod.tfvars"',
    provider: 'gcp'
  },
  {
    id: 'gcp-terraform-apply',
    title: 'Apply Terraform Plan',
    description: 'Deploy your infrastructure to GCP',
    command: 'terraform apply tfplan',
    provider: 'gcp'
  },
  {
    id: 'gcp-kubeconfig',
    title: 'Get GCP Kubeconfig',
    description: 'Configure kubectl to connect to your GKE cluster',
    command: 'gcloud container clusters get-credentials devonn-gke-prod --region us-central1',
    provider: 'gcp'
  },

  // Generic Kubernetes Commands (provider-agnostic)
  {
    id: 'kubectl-get-nodes',
    title: 'List Nodes',
    description: 'View all nodes in your Kubernetes cluster',
    command: 'kubectl get nodes -o wide'
  },
  {
    id: 'kubectl-get-pods',
    title: 'List Pods',
    description: 'View all pods across all namespaces',
    command: 'kubectl get pods --all-namespaces'
  },
  {
    id: 'kubectl-apply',
    title: 'Apply Manifests',
    description: 'Apply Kubernetes manifests to your cluster',
    command: 'kubectl apply -f ./kubernetes/'
  },
  {
    id: 'helm-install',
    title: 'Install Helm Chart',
    description: 'Install the D3VONN.IO Helm chart',
    command: 'helm install d3vonn-io ./charts/d3vonn-io --namespace devonn --create-namespace'
  }
];
