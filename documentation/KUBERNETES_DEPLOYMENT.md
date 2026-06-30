
# D3VONN Kubernetes Deployment Guide

This comprehensive guide details how to deploy the D3VONN Chrome Extension backend infrastructure on Kubernetes, including advanced configurations and service mesh integration.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Architecture Overview](#architecture-overview)
- [Basic Deployment](#basic-deployment)
- [Advanced Configuration](#advanced-configuration)
- [Service Mesh Integration](#service-mesh-integration)
- [Performance Optimization](#performance-optimization)
- [Monitoring & Observability](#monitoring--observability)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Kubernetes cluster (v1.22+)
- `kubectl` CLI tool configured to access your cluster
- Helm v3.8+
- Access to container registry
- Domain name configured for ingress

## Architecture Overview

The D3VONN backend consists of several microservices deployed in Kubernetes:

```
┌───────────────┐     ┌────────────────┐     ┌───────────────┐
│ API Gateway   │────▶│ Auth Service   │     │ Redis Cache   │
│ (Kong/Istio)  │     └────────────────┘     └───────────────┘
└───────┬───────┘              │                     ▲
        │                      │                     │
        ▼                      ▼                     │
┌───────────────┐     ┌────────────────┐     ┌───────────────┐
│ Core API      │────▶│ Agent Service  │────▶│ Database      │
└───────────────┘     └────────────────┘     └───────────────┘
        │                      │                     ▲
        │                      │                     │
        ▼                      ▼                     │
┌───────────────┐     ┌────────────────┐            │
│ ML Inference  │────▶│ Analytics      │────────────┘
└───────────────┘     └────────────────┘
```

## Basic Deployment

### 1. Namespace Creation

```bash
kubectl create namespace d3vonn
kubectl config set-context --current --namespace=d3vonn
```

### 2. Secrets Management

Create secrets for database credentials, API keys and connection strings:

```bash
kubectl create secret generic d3vonn-db-credentials \
  --from-literal=username=d3vonn_user \
  --from-literal=password=YOUR_SECURE_PASSWORD

kubectl create secret generic d3vonn-api-keys \
  --from-literal=openai-key=YOUR_OPENAI_KEY \
  --from-literal=gcp-key=YOUR_GCP_KEY
```

### 3. ConfigMaps for Environment Configuration

```bash
kubectl create configmap d3vonn-config \
  --from-file=deployment/environments.js \
  --from-literal=environment=production
```

### 4. Database Deployment

```yaml
# postgres-deployment.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:14
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: d3vonn-db-credentials
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: d3vonn-db-credentials
              key: password
        volumeMounts:
        - name: postgres-data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
```

### 5. Core API Deployment

```yaml
# core-api-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: d3vonn-core-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: d3vonn-core-api
  template:
    metadata:
      labels:
        app: d3vonn-core-api
    spec:
      containers:
      - name: api
        image: your-registry/d3vonn-core-api:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
        env:
        - name: DB_CONNECTION
          valueFrom:
            secretKeyRef:
              name: d3vonn-db-credentials
              key: connection-string
```

### 6. Service Definitions

```yaml
# services.yaml
apiVersion: v1
kind: Service
metadata:
  name: d3vonn-core-api
spec:
  selector:
    app: d3vonn-core-api
  ports:
  - port: 80
    targetPort: 8000
  type: ClusterIP
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  clusterIP: None  # Headless service for StatefulSet
```

### 7. Ingress Configuration

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: d3vonn-api-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  rules:
  - host: api.d3vonn.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: d3vonn-core-api
            port:
              number: 80
  tls:
  - hosts:
    - api.d3vonn.io
    secretName: d3vonn-tls-cert
```

## Advanced Configuration

### Horizontal Pod Autoscaling

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: d3vonn-core-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: d3vonn-core-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
    scaleUp:
      stabilizationWindowSeconds: 60
```

### Pod Disruption Budget

```yaml
# pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: d3vonn-api-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: d3vonn-core-api
```

### Network Policies

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: d3vonn-api-network-policy
spec:
  podSelector:
    matchLabels:
      app: d3vonn-core-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: ingress-nginx
    ports:
    - protocol: TCP
      port: 8000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
```

## Service Mesh Integration

### Istio Installation

```bash
# Install Istio with demo profile
istioctl install --set profile=demo -y

# Enable automatic sidecar injection
kubectl label namespace d3vonn istio.io/inject=enabled
```

### Service-to-Service Authentication

```yaml
# authentication.yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: d3vonn-api-peer-auth
  namespace: d3vonn
spec:
  selector:
    matchLabels:
      app: d3vonn-core-api
  mtls:
    mode: STRICT
```

### Authorization Policies

```yaml
# authorization.yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: d3vonn-api-auth-policy
  namespace: d3vonn
spec:
  selector:
    matchLabels:
      app: d3vonn-core-api
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/d3vonn/sa/agent-service"]
    to:
    - operation:
        methods: ["GET", "POST"]
        paths: ["/api/v1/agent/*"]
```

### Traffic Management

```yaml
# virtual-service.yaml
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: d3vonn-core-api
spec:
  hosts:
  - d3vonn-core-api
  http:
  - match:
    - headers:
        end-user:
          exact: premium-user
    route:
    - destination:
        host: d3vonn-core-api
        subset: premium
  - route:
    - destination:
        host: d3vonn-core-api
        subset: standard
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: d3vonn-core-api
spec:
  host: d3vonn-core-api
  subsets:
  - name: premium
    labels:
      version: v1
      tier: premium
  - name: standard
    labels:
      version: v1
      tier: standard
```

## Performance Optimization

### Resource Optimization

1. **Request and Limit Setting**

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

2. **Persistent Volume Performance**

For production environments, consider using:
- GCP: SSD Persistent Disks
- AWS: gp3 or io2 volumes
- Azure: Premium SSD

Example for GCP:

```yaml
kind: StorageClass
apiVersion: storage.k8s.io/v1
metadata:
  name: d3vonn-ssd
provisioner: kubernetes.io/gce-pd
parameters:
  type: pd-ssd
  replication-type: none
```

3. **Node Affinity**

```yaml
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
      - matchExpressions:
        - key: cloud.google.com/gke-nodepool
          operator: In
          values:
          - high-performance-pool
```

### Caching Strategy

1. **Redis Deployment**

```yaml
# redis-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
spec:
  replicas: 3
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:6
        ports:
        - containerPort: 6379
        resources:
          requests:
            cpu: "100m"
            memory: "256Mi"
          limits:
            cpu: "200m"
            memory: "512Mi"
        volumeMounts:
        - name: redis-data
          mountPath: /data
      volumes:
      - name: redis-data
        persistentVolumeClaim:
          claimName: redis-pvc
```

2. **CDN Configuration**

```yaml
# For static assets
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: d3vonn-assets
  annotations:
    nginx.ingress.kubernetes.io/proxy-buffering: "on"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_cache static-cache;
      proxy_cache_valid 200 302 30d;
      proxy_cache_valid 404 1m;
      add_header X-Cache-Status $upstream_cache_status;
    external-dns.alpha.kubernetes.io/hostname: assets.d3vonn.io
spec:
  rules:
  - host: assets.d3vonn.io
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: d3vonn-assets
            port:
              number: 80
```

## Monitoring & Observability

### Prometheus & Grafana Setup

```bash
# Using Helm
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.enabled=true
```

Custom Service Monitor for Devonn API:

```yaml
# service-monitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: d3vonn-api-monitor
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: d3vonn-core-api
  endpoints:
  - port: http
    path: /metrics
    interval: 15s
  namespaceSelector:
    matchNames:
    - d3vonn
```

### Distributed Tracing with Jaeger

```bash
kubectl apply -f https://raw.githubusercontent.com/jaegertracing/jaeger-operator/master/deploy/crds/jaegertracing.io_jaegers_crd.yaml
kubectl apply -f https://raw.githubusercontent.com/jaegertracing/jaeger-operator/master/deploy/service_account.yaml
kubectl apply -f https://raw.githubusercontent.com/jaegertracing/jaeger-operator/master/deploy/role.yaml
kubectl apply -f https://raw.githubusercontent.com/jaegertracing/jaeger-operator/master/deploy/role_binding.yaml
kubectl apply -f https://raw.githubusercontent.com/jaegertracing/jaeger-operator/master/deploy/operator.yaml

# Create a Jaeger instance
cat <<EOF | kubectl apply -f -
apiVersion: jaegertracing.io/v1
kind: Jaeger
metadata:
  name: d3vonn-jaeger
spec:
  strategy: production
  storage:
    type: elasticsearch
    options:
      es:
        server-urls: https://elasticsearch:9200
EOF
```

## Troubleshooting

### Common Issues and Solutions

1. **Pod Startup Failures**
   - Check events: `kubectl describe pod <pod-name>`
   - Check logs: `kubectl logs <pod-name>`
   - Verify resource constraints

2. **Database Connection Issues**
   - Ensure services are running: `kubectl get svc`
   - Check network policies
   - Verify secrets are properly mounted

3. **Service Mesh Connectivity**
   - Check Istio proxy status: `istioctl proxy-status`
   - Verify mTLS certificates: `istioctl authn tls-check <pod-name>`

4. **Performance Degradation**
   - Check resource utilization: `kubectl top pods`
   - Analyze Prometheus metrics
   - Examine Jaeger traces for bottlenecks

### Diagnostic Commands

```bash
# Check pod status
kubectl get pods -n d3vonn

# Get detailed pod information
kubectl describe pod <pod-name> -n d3vonn

# Check logs
kubectl logs <pod-name> -n d3vonn

# Check resource usage
kubectl top pods -n d3vonn

# Port forward to access services locally
kubectl port-forward svc/d3vonn-core-api 8000:80 -n d3vonn
```

## Upgrade Strategy

For zero-downtime upgrades:

```yaml
# In deployment spec
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1
    maxUnavailable: 0
```

Implementation steps:

1. Update the image tag:
   ```bash
   kubectl set image deployment/d3vonn-core-api api=your-registry/d3vonn-core-api:v2
   ```

2. Monitor the rollout:
   ```bash
   kubectl rollout status deployment/d3vonn-core-api
   ```

3. Rollback if needed:
   ```bash
   kubectl rollout undo deployment/d3vonn-core-api
   ```
