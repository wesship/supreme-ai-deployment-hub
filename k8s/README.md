# Devonn Enterprise Stack — k8s/

Production-grade EKS baseline.

## Layout

```
k8s/
  base/                  # Authoritative manifests (PSA, IRSA, HPA, PDB, NetworkPolicy)
    namespace.yaml
    serviceaccount.yaml
    deployment.yaml
    service.yaml
    ingress.yaml
    hpa.yaml
    pdb.yaml
    networkpolicy.yaml
  backend-deployment.yaml  # legacy — superseded by base/deployment.yaml
  ...
helm-values/
  kube-prometheus-stack.yaml
  loki.yaml
  falco.yaml
scripts/
  bootstrap.sh
```

## Required GitHub repo variables

Set under **Settings → Secrets and variables → Actions → Variables**:

- `AWS_ACCOUNT_ID`
- `AWS_REGION`
- `EKS_CLUSTER_NAME`
- `ECR_REPOSITORY`

## Required AWS IAM (one-time)

1. **OIDC provider** for GitHub Actions in your AWS account.
2. IAM role **`github-oidc-deployer`** with trust policy scoped to your repo:
   `repo:OWNER/REPO:ref:refs/heads/main`
   Permissions: ECR push, EKS describe, sts:AssumeRoleWithWebIdentity.
3. IAM role **`devonn-backend-irsa`** for the pod ServiceAccount (IRSA).

## Placeholders to replace

- `REPLACE_ACM_CERT_ARN` in `k8s/base/ingress.yaml`
- `${AWS_ACCOUNT_ID}` is substituted automatically by the deploy workflow via `envsubst`.

## Local apply

```bash
bash scripts/bootstrap.sh
export AWS_ACCOUNT_ID=123456789012
find k8s/base -type f -name '*.yaml' | while read f; do
  envsubst < "$f" | kubectl apply -f -
done
```

## Observability + runtime security

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo add grafana https://grafana.github.io/helm-charts
helm repo add falcosecurity https://falcosecurity.github.io/charts
helm repo update

helm upgrade --install kube-prom-stack prometheus-community/kube-prometheus-stack \
  -n observability --create-namespace -f helm-values/kube-prometheus-stack.yaml

helm upgrade --install loki grafana/loki \
  -n observability -f helm-values/loki.yaml

helm upgrade --install falco falcosecurity/falco \
  -n security --create-namespace -f helm-values/falco.yaml
```
