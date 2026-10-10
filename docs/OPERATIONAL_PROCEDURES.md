
# Devonn.AI Operational Procedures

This document outlines standard operational procedures for managing the Devonn.AI infrastructure.

## Table of Contents

- [General Procedures](#general-procedures)
- [Database Operations](#database-operations)
- [Kubernetes Operations](#kubernetes-operations)
- [Monitoring and Alerting](#monitoring-and-alerting)
- [Incident Response](#incident-response)
- [Maintenance Procedures](#maintenance-procedures)
- [Service Mesh Operations](#service-mesh-operations)

## General Procedures

### Access Control

1. **AWS Console Access**
   - All access requires MFA
   - Use role-based access through AWS SSO
   - Access review conducted quarterly

2. **Infrastructure Access**
   - Use bastion host for SSH access to instances
   - Use AWS Systems Manager Session Manager as preferred access method
   - Rotate SSH keys every 90 days

3. **Secrets Management**
   - Store all secrets in AWS Secrets Manager
   - Use dynamic secrets for database credentials where possible
   - Rotate credentials regularly based on sensitivity

### Deployment Procedures

1. **Terraform Workflow**
   ```bash
   # 1. Review changes
   terraform plan -var-file=environments/[environment].tfvars
   
   # 2. Get approval (via PR or manual process)
   
   # 3. Apply changes
   terraform apply -var-file=environments/[environment].tfvars
   ```

2. **Canary Deployment Process**
   ```bash
   # 1. Deploy to canary environment
   terraform apply -var-file=environments/canary.tfvars -target=module.api_canary
   
   # 2. Monitor performance and errors for 30 minutes
   
   # 3. Gradually shift traffic via App Mesh routing
   aws appmesh update-route --mesh-name devonn-mesh --route-name api-route \
     --virtual-router-name api-router \
     --spec "{\"httpRoute\":{\"weightedTargets\":[{\"virtualNode\":\"api-node\",\"weight\":80},{\"virtualNode\":\"api-canary-node\",\"weight\":20}]}}"
   
   # 4. Continue increasing traffic to 100% if no issues observed
   ```

3. **Rollback Procedure**
   ```bash
   # Restore previous state
   terraform apply -var-file=environments/[environment].tfvars -target=[affected_resource] -replace=[affected_resource]
   
   # For emergency rollbacks, use previous state file
   terraform apply previous-state.tfplan
   ```

## Database Operations

### Backup and Restore

1. **Manual Backup**
   ```bash
   # Create manual RDS snapshot
   aws rds create-db-snapshot \
     --db-instance-identifier devonn-postgres-production \
     --db-snapshot-identifier manual-backup-$(date +%Y-%m-%d)
   ```

2. **Restore from Snapshot**
   ```bash
   # Restore database from snapshot
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier devonn-postgres-restored \
     --db-snapshot-identifier snapshot-name \
     --db-instance-class db.t3.large
   ```

3. **Point-in-Time Recovery**
   ```bash
   # Restore to specific timestamp
   aws rds restore-db-instance-to-point-in-time \
     --source-db-instance-identifier devonn-postgres-production \
     --target-db-instance-identifier devonn-postgres-recovery \
     --restore-time "2025-03-15T08:00:00Z"
   ```

### Failover Testing

1. **Test Automatic Failover**
   ```bash
   # Force failover to test Multi-AZ
   aws rds reboot-db-instance \
     --db-instance-identifier devonn-postgres-production \
     --force-failover
   ```

2. **Monitor Failover Metrics**
   ```bash
   # Check failover time
   aws cloudwatch get-metric-statistics \
     --namespace AWS/RDS \
     --metric-name FailoverTime \
     --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%SZ) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
     --period 60 \
     --statistics Average
   ```

### Performance Monitoring

1. **Performance Insights**
   ```bash
   # View top queries by load
   aws pi get-resource-metrics \
     --service-type RDS \
     --identifier db-ABCDEFGHIJKLMNOP \
     --metric-queries '[{"Metric":"db.load.avg"}]' \
     --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%SZ) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
     --period-in-seconds 60
   ```

2. **Identify Slow Queries**
   ```bash
   # Connect to database and analyze slow queries
   psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -c "SELECT * FROM pg_stat_activity WHERE state = 'active' ORDER BY query_start ASC;"
   ```

## Kubernetes Operations

### Cluster Management

1. **Update Kubernetes Version**
   ```bash
   # Update EKS control plane
   aws eks update-cluster-version \
     --name devonn-eks-production \
     --kubernetes-version X.XX
   
   # Update node groups after control plane is updated
   aws eks update-nodegroup-version \
     --cluster-name devonn-eks-production \
     --nodegroup-name dev_nodes
   ```

2. **Handle Node Draining**
   ```bash
   # Safely drain nodes for maintenance
   kubectl drain ${NODE_NAME} --ignore-daemonsets --delete-local-data
   
   # Return node to service
   kubectl uncordon ${NODE_NAME}
   ```

3. **Log Collection**
   ```bash
   # Get logs from specific pod
   kubectl logs ${POD_NAME} -n ${NAMESPACE} --tail=1000
   
   # Stream logs from all pods with a specific label
   kubectl logs -l app=api -n devonn -f
   ```

### Deployment Management

1. **Blue-Green Deployment**
   ```bash
   # Deploy new "green" version alongside "blue"
   kubectl apply -f kubernetes/green-deployment.yaml
   
   # Test green deployment internally
   kubectl port-forward svc/green-service 8080:80
   
   # Switch traffic from blue to green
   kubectl apply -f kubernetes/service-cutover.yaml
   ```

2. **Rollback Deployment**
   ```bash
   # Rollback to previous revision
   kubectl rollout undo deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE}
   
   # Rollback to specific revision
   kubectl rollout undo deployment/${DEPLOYMENT_NAME} -n ${NAMESPACE} --to-revision=${REVISION_NUMBER}
   ```

## Monitoring and Alerting

### Alert Response

1. **High CPU Alert**
   - Check system processes: `kubectl top pods -n ${NAMESPACE}`
   - Analyze CPU usage patterns in CloudWatch
   - Add capacity if consistently high: `kubectl scale deployment ${DEPLOYMENT_NAME} --replicas=5`

2. **Database Connection Alert**
   - Check connection count: `psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -c "SELECT count(*) FROM pg_stat_activity;"`
   - Investigate connection leaks in application code
   - Consider increasing `max_connections` parameter

3. **High Error Rate Alert**
   - Check application logs: `kubectl logs -l app=api -n devonn --tail=500 | grep ERROR`
   - Analyze error patterns in CloudWatch Logs Insights
   - Rollback recent deployments if errors correlate with changes

### Dashboard Management

1. **Create Custom Dashboard**
   ```bash
   # Create CloudWatch dashboard from template
   aws cloudwatch put-dashboard \
     --dashboard-name Devonn-Overview \
     --dashboard-body file://monitoring/dashboards/overview.json
   ```

2. **Add Metrics to Dashboard**
   ```bash
   # Add custom metrics to CloudWatch
   aws cloudwatch put-metric-data \
     --namespace "Devonn/CustomMetrics" \
     --metric-name "BusinessTransactions" \
     --value 42
   ```

## Incident Response

### Incident Classification

| Severity | Description | Initial Response Time | Examples |
|----------|-------------|------------------------|---------|
| P1       | Complete service outage | 15 minutes | Database down, API unavailable |
| P2       | Partial service outage | 30 minutes | Specific feature unavailable, high error rate |
| P3       | Service degradation | 2 hours | Slow response times, minor feature issues |
| P4       | Non-critical issue | 24 hours | UI glitches, non-critical bugs |

### Incident Response Steps

1. **Identification**
   - Acknowledge alert
   - Determine incident severity
   - Notify appropriate team members

2. **Containment**
   - Isolate affected systems
   - Apply temporary fixes if available
   - Consider failover to standby systems

3. **Resolution**
   - Implement permanent fix
   - Verify service restoration
   - Update status page

4. **Post-Incident**
   - Conduct post-mortem
   - Document root cause
   - Implement preventative measures

### Communication Templates

**Internal Status Update**
```
Incident #[number] - [severity] - [brief description]
Status: [investigating|identified|resolving|resolved]
Affected systems: [list of systems]
Impact: [description of user impact]
Current actions: [what's being done now]
Next update: [time]
```

**Customer Communication**
```
We are currently experiencing [brief non-technical description] with our [affected service].
Our team is [current action] and we expect to have this resolved by [ETA].
We apologize for any inconvenience and will update this status when the issue is resolved.
```

## Maintenance Procedures

### Scheduled Maintenance Windows

| Environment | Day | Time (UTC) | Duration |
|-------------|-----|------------|----------|
| Production  | Saturday | 02:00-06:00 | 4 hours |
| Staging     | Wednesday | 22:00-02:00 | 4 hours |
| Development | Any day | Any time | As needed |

### Pre-Maintenance Checklist

- [ ] Create maintenance plan with detailed steps
- [ ] Schedule maintenance in calendar and alert system
- [ ] Notify stakeholders 7 days in advance
- [ ] Prepare rollback plan
- [ ] Verify backup completion before starting

### Database Maintenance

1. **Version Upgrade Process**
   ```bash
   # Create pre-upgrade snapshot
   aws rds create-db-snapshot \
     --db-instance-identifier devonn-postgres-production \
     --db-snapshot-identifier pre-upgrade-$(date +%Y-%m-%d)
   
   # Modify DB instance to upgrade version (during maintenance window)
   aws rds modify-db-instance \
     --db-instance-identifier devonn-postgres-production \
     --engine-version 15.4 \
     --apply-immediately false
   ```

2. **Parameter Group Updates**
   ```bash
   # Create new parameter group
   aws rds create-db-parameter-group \
     --db-parameter-group-name devonn-postgres-params-new \
     --db-parameter-group-family postgres14 \
     --description "Updated parameters for performance"
   
   # Update parameters
   aws rds modify-db-parameter-group \
     --db-parameter-group-name devonn-postgres-params-new \
     --parameters "ParameterName=work_mem,ParameterValue=16MB,ApplyMethod=pending-reboot"
   
   # Apply parameter group
   aws rds modify-db-instance \
     --db-instance-identifier devonn-postgres-production \
     --db-parameter-group-name devonn-postgres-params-new
   ```

## Service Mesh Operations

### App Mesh Management

1. **Visualize Service Mesh**
   ```bash
   # Get mesh overview
   aws appmesh describe-mesh --mesh-name devonn-mesh-production
   
   # List virtual services
   aws appmesh list-virtual-services --mesh-name devonn-mesh-production
   ```

2. **Circuit Breaker Configuration**
   ```bash
   # Update route with circuit breaker
   aws appmesh update-route \
     --mesh-name devonn-mesh-production \
     --virtual-router-name api-router \
     --route-name api-route \
     --spec file://mesh-configs/circuit-breaker.json
   ```

3. **Traffic Splitting for Canary**
   ```bash
   # Gradually adjust traffic weights
   aws appmesh update-route \
     --mesh-name devonn-mesh-production \
     --virtual-router-name api-router \
     --route-name api-route \
     --spec file://mesh-configs/traffic-split-80-20.json
   
   # After validation, adjust to 50/50
   aws appmesh update-route \
     --mesh-name devonn-mesh-production \
     --virtual-router-name api-router \
     --route-name api-route \
     --spec file://mesh-configs/traffic-split-50-50.json
   ```

### mTLS Certificate Management

1. **Generate Certificates**
   ```bash
   # Create CA certificate
   openssl genrsa -out ca.key 2048
   openssl req -new -x509 -days 365 -key ca.key -out ca.crt
   
   # Create service certificates
   openssl genrsa -out service.key 2048
   openssl req -new -key service.key -out service.csr
   openssl x509 -req -days 365 -in service.csr -CA ca.crt -CAkey ca.key -out service.crt
   ```

2. **Deploy Certificates to Kubernetes**
   ```bash
   # Create secret with certificates
   kubectl create secret tls envoy-certs \
     --cert=service.crt \
     --key=service.key \
     -n devonn
   
   # Create configmap with CA cert
   kubectl create configmap ca-cert \
     --from-file=ca.crt \
     -n devonn
   ```

3. **Certificate Rotation**
   ```bash
   # Generate new certificates
   ./scripts/generate-certs.sh
   
   # Update Kubernetes secrets
   kubectl create secret tls envoy-certs-new \
     --cert=new-service.crt \
     --key=new-service.key \
     -n devonn
   
   # Update app mesh to use new certificates
   aws appmesh update-virtual-node \
     --mesh-name devonn-mesh-production \
     --virtual-node-name api-node \
     --spec file://mesh-configs/virtual-node-new-certs.json
   
   # Restart pods to pick up new certificates
   kubectl rollout restart deployment -n devonn
   ```

### Observability

1. **Envoy Stats**
   ```bash
   # Port forward to Envoy admin interface
   kubectl port-forward ${POD_NAME} 9901:9901
   
   # Access stats
   curl localhost:9901/stats
   
   # Access clusters info
   curl localhost:9901/clusters
   ```

2. **X-Ray Trace Analysis**
   ```bash
   # Get recent traces for a service
   aws xray get-service-graph \
     --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%SZ) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
   
   # Get trace details
   aws xray batch-get-traces \
     --trace-ids ${TRACE_ID}
   ```
