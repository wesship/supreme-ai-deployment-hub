
# Deployment Testing Plan

This document outlines the step-by-step process for testing the Devonn.AI infrastructure deployment in a staging environment before promoting to production.

## Pre-Deployment Setup

1. **Create Staging Environment**
   ```bash
   # Create staging tfvars file
   cp environments/example.tfvars environments/staging.tfvars
   
   # Edit staging configuration
   vim environments/staging.tfvars
   
   # Initialize Terraform with staging workspace
   terraform init
   terraform workspace new staging
   terraform workspace select staging
   ```

2. **Validate Terraform Configuration**
   ```bash
   terraform validate
   terraform plan -var-file=environments/staging.tfvars
   ```

## Deployment Testing Process

### Phase 1: Initial Deployment

1. **Deploy Core Infrastructure**
   ```bash
   terraform apply -var-file=environments/staging.tfvars -target=module.vpc
   ```
   - [ ] Validate VPC creation
   - [ ] Confirm subnets are properly configured
   - [ ] Verify route tables and Internet Gateway

2. **Deploy EKS Cluster**
   ```bash
   terraform apply -var-file=environments/staging.tfvars -target=module.eks
   ```
   - [ ] Verify EKS cluster creation
   - [ ] Confirm node groups are running
   - [ ] Test kubectl connectivity

3. **Deploy Database**
   ```bash
   terraform apply -var-file=environments/staging.tfvars -target=module.rds
   ```
   - [ ] Confirm RDS instance is available
   - [ ] Test database connectivity from within the VPC
   - [ ] Verify appropriate security group rules

4. **Deploy Remaining Infrastructure**
   ```bash
   terraform apply -var-file=environments/staging.tfvars
   ```
   - [ ] Ensure all resources are created successfully
   - [ ] Verify outputs match expected values

### Phase 2: Functional Testing

1. **Deploy Sample Application**
   ```bash
   # Configure kubectl
   aws eks update-kubeconfig --name devonn-eks-staging --region <YOUR_REGION>
   
   # Deploy test application
   kubectl apply -f kubernetes/test-app.yaml
   ```
   - [ ] Verify pods are running
   - [ ] Confirm services are accessible
   - [ ] Test basic functionality

2. **Database Integration Testing**
   - [ ] Test database connections from application
   - [ ] Verify data persistence
   - [ ] Test database failover (if Multi-AZ is enabled)

3. **Network Policy Testing**
   - [ ] Verify pod-to-pod communication
   - [ ] Test service discovery
   - [ ] Confirm external-to-internal traffic routing

### Phase 3: Performance Testing

1. **Load Testing**
   ```bash
   # Install k6 (https://k6.io/)
   npm install -g k6
   
   # Run load test
   k6 run load-tests/basic-load.js
   ```
   - [ ] Monitor cluster performance under load
   - [ ] Verify autoscaling triggers correctly
   - [ ] Check database performance metrics

2. **Resiliency Testing**
   - [ ] Simulate node failure
   ```bash
   # Get node name
   NODE_NAME=$(kubectl get nodes --no-headers | head -1 | awk '{print $1}')
   
   # Cordon and drain node
   kubectl cordon $NODE_NAME
   kubectl drain $NODE_NAME --ignore-daemonsets --delete-emptydir-data
   ```
   - [ ] Verify automatic recovery
   - [ ] Test manual database failover (if applicable)

### Phase 4: Security Testing

1. **Network Security Validation**
   - [ ] Perform port scanning to verify only necessary ports are open
   - [ ] Validate security group configurations
   - [ ] Confirm no public access to private resources

2. **Access Control Testing**
   - [ ] Verify IAM roles and policies
   - [ ] Test Kubernetes RBAC configurations
   - [ ] Confirm proper resource isolation

3. **Data Security Testing**
   - [ ] Verify encryption at rest
   - [ ] Test encryption in transit
   - [ ] Validate secrets management

### Phase 5: Monitoring and Alerting

1. **Monitoring Setup Verification**
   - [ ] Confirm CloudWatch dashboards are created
   - [ ] Verify metrics are being collected
   - [ ] Test log aggregation

2. **Alert Testing**
   - [ ] Trigger test alerts
   - [ ] Verify notification delivery
   - [ ] Confirm alert escalation process

3. **Backup Testing**
   - [ ] Verify automated backups
   - [ ] Test manual snapshot creation
   - [ ] Perform test restore

## Rollback Plan

In case of deployment issues, follow this rollback procedure:

1. **Immediate Rollback**
   ```bash
   # Revert to last known good state
   terraform apply -var-file=environments/staging.tfvars -refresh-only
   ```

2. **Component-specific Rollback**
   ```bash
   # Rollback specific component (example: RDS)
   terraform destroy -var-file=environments/staging.tfvars -target=module.rds
   terraform apply -var-file=environments/staging.tfvars -target=module.rds
   ```

3. **Complete Rollback**
   ```bash
   # If necessary, destroy entire environment
   terraform destroy -var-file=environments/staging.tfvars
   ```

## Production Deployment Approval

Once all tests pass in the staging environment, complete this checklist:

- [ ] All functional tests passed
- [ ] Performance metrics meet requirements
- [ ] Security tests passed
- [ ] Monitoring and alerting confirmed working
- [ ] Backup and restore procedures validated
- [ ] No critical or high-severity issues identified

## Production Deployment Procedure

After approval, follow this procedure to deploy to production:

1. **Prepare Production Variables**
   ```bash
   # Review and update production tfvars
   vim environments/production.tfvars
   ```

2. **Switch to Production Workspace**
   ```bash
   terraform workspace select production
   ```

3. **Plan Production Deployment**
   ```bash
   terraform plan -var-file=environments/production.tfvars -out=production.tfplan
   ```
   - Review plan for any unexpected changes

4. **Apply Production Deployment**
   ```bash
   terraform apply production.tfplan
   ```

5. **Verify Production Deployment**
   - Repeat critical tests from the test plan in production
   - Verify all monitoring and alerting is active
   - Confirm backup schedules are enabled
