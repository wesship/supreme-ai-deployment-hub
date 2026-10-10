
# Disaster Recovery Plan

This document outlines the disaster recovery (DR) procedures for Devonn.AI's production environment.

## 1. Recovery Objectives

### Recovery Time Objective (RTO)
- **Critical Services**: < 1 hour
- **Secondary Services**: < 4 hours
- **Tertiary Services**: < 24 hours

### Recovery Point Objective (RPO)
- **Database**: < 5 minutes data loss
- **File Storage**: < 15 minutes data loss
- **Configuration**: < 1 hour

## 2. Disaster Scenarios

### Infrastructure Failures
- **AWS Region Failure**: Complete loss of primary AWS region
- **Availability Zone Failure**: Loss of one or more AZs
- **RDS Database Failure**: Primary database instance unavailability
- **EKS Cluster Failure**: Kubernetes control plane or worker nodes unavailability

### Application Failures
- **Deployment Failures**: Failed deployments leading to application unavailability
- **Configuration Errors**: Misconfigurations causing service disruptions
- **Data Corruption**: Application database corruption

### Security Incidents
- **Account Compromise**: AWS account or IAM role compromise
- **Data Breach**: Unauthorized access to sensitive data
- **DDoS Attack**: Distributed denial-of-service attack

## 3. Recovery Procedures

### Database Recovery

#### RDS Multi-AZ Failover
1. **Automatic Failover**: AWS RDS will automatically fail over to the standby instance
2. **Verification**: Verify database connectivity from the application
3. **Monitoring**: Check CloudWatch metrics for abnormalities

```bash
# Check RDS failover status
aws rds describe-db-instances --db-instance-identifier devonn-postgres-production \
  --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceStatus,SecondaryAvailabilityZone]'
```

#### Cross-Region Recovery
1. **Promote Read Replica**:
```bash
aws rds promote-read-replica \
  --db-instance-identifier devonn-postgres-replica-production
```

2. **Update Database Connection**:
```bash
kubectl set env deployment/devonn-api \
  DATABASE_URL=postgresql://admin:password@[new-endpoint]:5432/devonndb
```

3. **Verify Application Connectivity**:
```bash
kubectl exec -it [pod-name] -- curl localhost:8000/health
```

### EKS Cluster Recovery

1. **Assess Cluster State**:
```bash
aws eks describe-cluster --name devonn-eks-production
kubectl get nodes
kubectl get pods --all-namespaces
```

2. **Node Group Recovery**:
```bash
# Scale up a new node group if needed
aws eks update-nodegroup-config \
  --cluster-name devonn-eks-production \
  --nodegroup-name dev_nodes \
  --scaling-config desiredSize=3,minSize=2,maxSize=5
```

3. **Application Recovery**:
```bash
# Deploy applications from backup manifests
kubectl apply -f kubernetes/manifests/
```

4. **Verify Cluster Health**:
```bash
kubectl get deployments
kubectl top nodes
```

### Full Region Recovery

1. **Activate DR Region**:
```bash
# Update DNS to point to DR region
aws route53 change-resource-record-sets \
  --hosted-zone-id [zone-id] \
  --change-batch file://dr-dns-changes.json
```

2. **Verify Database Replication**:
```bash
aws rds describe-db-instances --db-instance-identifier devonn-postgres-dr-production
```

3. **Deploy Core Services**:
```bash
# Deploy to DR region EKS cluster
kubectl config use-context dr-region-context
kubectl apply -f kubernetes/manifests/core-services/
```

4. **Scale Up Capacity**:
```bash
kubectl scale deployment devonn-api --replicas=3
kubectl scale deployment devonn-worker --replicas=5
```

### Data Restore Procedures

#### Database Point-in-Time Recovery
1. **Initiate Recovery**:
```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier devonn-postgres-production \
  --target-db-instance-identifier devonn-postgres-recovery \
  --restore-time [timestamp] \
  --db-instance-class db.t3.large
```

2. **Verify Data Integrity**:
```bash
psql -h [endpoint] -U admin -d devonndb -c "SELECT COUNT(*) FROM users;"
```

3. **Promote to Primary** (if needed):
```bash
# Update application to use the recovered instance
kubectl set env deployment/devonn-api \
  DATABASE_URL=postgresql://admin:password@[recovered-endpoint]:5432/devonndb
```

#### S3 Data Recovery
1. **Verify Backup Integrity**:
```bash
aws s3 ls s3://devonn-backup-production/
```

2. **Restore Data**:
```bash
aws s3 sync s3://devonn-backup-production/[backup-date]/ s3://devonn-data-production/
```

## 4. Testing Procedures

### Regular DR Testing
Perform quarterly disaster recovery tests:

1. **RDS Failover Testing**: Test automatic and manual failover
2. **Cross-Region Recovery**: Test recovery in a secondary AWS region
3. **Backup Restoration**: Test restoring from backups
4. **Application Deployment**: Test deploying the application from scratch

### Documentation and Reporting
- Document all test procedures, results, and learnings
- Update the DR plan based on test findings
- Report test results to management and stakeholders

## 5. Recovery Team and Communication

### Team Structure
- **DR Coordinator**: Overall coordination of the recovery effort
- **Database Team**: Responsible for database recovery
- **Infrastructure Team**: Responsible for AWS and Kubernetes recovery
- **Application Team**: Responsible for application recovery
- **Security Team**: Responsible for security-related incidents

### Communication Plan
- **Primary Communication**: Slack channel #dr-response
- **Secondary Communication**: SMS and email distribution list
- **External Communication**: Customer support portal and status page
- **Escalation Path**: Team Lead → Engineering Manager → CTO → CEO

### Contact Information
- **On-call Rotation**: https://devonn.pagerduty.com/on-call
- **AWS Support**: https://console.aws.amazon.com/support/home
- **Infrastructure Provider Contacts**: [List of contacts]

## 6. Recovery Resources

### Documentation
- AWS EKS Documentation: https://docs.aws.amazon.com/eks/
- AWS RDS Documentation: https://docs.aws.amazon.com/rds/
- Kubernetes Documentation: https://kubernetes.io/docs/

### Recovery Tools
- AWS CLI: Used for AWS resource management
- kubectl: Used for Kubernetes cluster management
- psql: Used for PostgreSQL database management
- Terraform: Used for infrastructure recovery

### Recovery Runbooks
- [Database Recovery Runbook](./runbooks/database_recovery.md)
- [EKS Recovery Runbook](./runbooks/eks_recovery.md)
- [Application Recovery Runbook](./runbooks/application_recovery.md)
- [Security Incident Response Runbook](./runbooks/security_incident.md)

## 7. Recovery Validation

### Success Criteria
- All critical services are operational
- Data integrity is maintained
- Security posture is restored
- Performance meets baseline requirements

### Validation Tests
- Health check endpoints return 200 OK
- Database queries execute successfully
- User authentication and authorization work correctly
- API endpoints return expected responses
- Monitoring systems show normal metrics

## 8. Continuous Improvement

### Post-Incident Analysis
- Conduct a post-mortem meeting
- Document root cause analysis
- Identify improvement areas
- Update the DR plan based on findings

### Regular Updates
- Review and update this plan quarterly
- Update after significant infrastructure or application changes
- Test updated procedures after each major revision

---

Last Updated: [Current Date]
Approved By: [Approver Name]
