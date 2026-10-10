
# Common Issues Runbook

This runbook provides step-by-step instructions for resolving common issues in the Devonn.AI infrastructure.

## Database Connectivity Issues

### Symptom: Applications cannot connect to PostgreSQL database

#### Diagnostic Steps:

1. **Verify RDS instance status**
   ```bash
   aws rds describe-db-instances \
     --db-instance-identifier devonn-postgres-production \
     --query 'DBInstances[0].DBInstanceStatus'
   ```
   
   *Expected result*: "available"

2. **Check security group rules**
   ```bash
   # Get security group ID
   SG_ID=$(aws rds describe-db-instances \
     --db-instance-identifier devonn-postgres-production \
     --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
     --output text)
   
   # Check inbound rules
   aws ec2 describe-security-groups \
     --group-ids $SG_ID \
     --query 'SecurityGroups[0].IpPermissions'
   ```
   
   *Expected result*: Port 5432 should be open to the application subnet CIDR

3. **Test connectivity from an application pod**
   ```bash
   # Start a debug pod
   kubectl run postgres-debug --image=postgres:14 -it --rm -- bash
   
   # Inside the pod, test connection
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT 1;"
   ```

#### Resolution Steps:

1. **If RDS instance is not "available"**
   - Wait for status to change to "available"
   - If status is "failed", check CloudWatch logs and AWS RDS events
   - If needed, restore from latest snapshot:
     ```bash
     aws rds restore-db-instance-from-db-snapshot \
       --db-instance-identifier devonn-postgres-new \
       --db-snapshot-identifier $(aws rds describe-db-snapshots \
         --db-instance-identifier devonn-postgres-production \
         --query 'sort_by(DBSnapshots, &SnapshotCreateTime)[-1].DBSnapshotIdentifier' \
         --output text)
     ```

2. **If security group rules are incorrect**
   ```bash
   # Add missing rule
   aws ec2 authorize-security-group-ingress \
     --group-id $SG_ID \
     --protocol tcp \
     --port 5432 \
     --cidr $APP_SUBNET_CIDR
   ```

3. **If credentials are incorrect**
   - Verify secrets in AWS Secrets Manager
   - Reset password if needed:
     ```bash
     NEW_PASSWORD=$(openssl rand -base64 16)
     aws rds modify-db-instance \
       --db-instance-identifier devonn-postgres-production \
       --master-user-password $NEW_PASSWORD
     
     # Update secret in Secrets Manager
     aws secretsmanager update-secret \
       --secret-id devonn/db/credentials \
       --secret-string "{\"username\":\"admin\",\"password\":\"$NEW_PASSWORD\"}"
     
     # Update Kubernetes secret
     kubectl create secret generic db-credentials \
       --from-literal=username=admin \
       --from-literal=password=$NEW_PASSWORD \
       -n devonn \
       -o yaml --dry-run=client | kubectl apply -f -
     
     # Restart affected applications
     kubectl rollout restart deployment -n devonn
     ```

## Kubernetes Pod Crashlooping

### Symptom: Pods are in CrashLoopBackOff state

#### Diagnostic Steps:

1. **Identify affected pods**
   ```bash
   kubectl get pods -n devonn -o wide | grep CrashLoopBackOff
   ```

2. **Check pod logs**
   ```bash
   kubectl logs $POD_NAME -n devonn
   kubectl logs $POD_NAME -n devonn --previous
   ```

3. **Check pod events**
   ```bash
   kubectl describe pod $POD_NAME -n devonn
   ```

#### Resolution Steps:

1. **If OOMKilled (Out of Memory)**
   ```bash
   # Update deployment with higher memory limits
   kubectl set resources deployment $DEPLOYMENT_NAME \
     -n devonn \
     --limits=memory=1Gi \
     --requests=memory=512Mi
   ```

2. **If container can't start due to configuration**
   ```bash
   # Check ConfigMaps
   kubectl get configmap -n devonn
   kubectl describe configmap $CONFIGMAP_NAME -n devonn
   
   # Fix ConfigMap
   kubectl edit configmap $CONFIGMAP_NAME -n devonn
   
   # Restart affected pods
   kubectl rollout restart deployment $DEPLOYMENT_NAME -n devonn
   ```

3. **If image pull errors**
   ```bash
   # Check image repository access
   kubectl describe pod $POD_NAME -n devonn | grep "Failed to pull image"
   
   # Update image pull secrets if needed
   kubectl create secret docker-registry regcred \
     --docker-server=$DOCKER_REGISTRY \
     --docker-username=$DOCKER_USER \
     --docker-password=$DOCKER_PASSWORD \
     --docker-email=$EMAIL \
     -n devonn \
     -o yaml --dry-run=client | kubectl apply -f -
   
   # Update deployment to use correct image
   kubectl set image deployment/$DEPLOYMENT_NAME $CONTAINER_NAME=$CORRECT_IMAGE -n devonn
   ```

## High API Latency

### Symptom: API responses are slow, timeout alerts triggered

#### Diagnostic Steps:

1. **Monitor latency metrics in CloudWatch**
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/ApiGateway \
     --metric-name Latency \
     --dimensions Name=ApiName,Value=devonn-api \
     --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%SZ) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
     --period 300 \
     --statistics Average
   ```

2. **Check database performance**
   ```bash
   # View slow query logs
   aws rds download-db-log-file-portion \
     --db-instance-identifier devonn-postgres-production \
     --log-file-name postgresql.log.$(date +%Y-%m-%d) \
     --output text
   ```

3. **Check EKS cluster resource utilization**
   ```bash
   kubectl top nodes
   kubectl top pods -n devonn
   ```

#### Resolution Steps:

1. **If database queries are slow**
   ```bash
   # Connect to database and analyze
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
   
   # Add missing indexes
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "CREATE INDEX idx_table_column ON table(column);"
   ```

2. **If application pods need scaling**
   ```bash
   # Scale up deployment
   kubectl scale deployment $DEPLOYMENT_NAME --replicas=5 -n devonn
   
   # Verify HPA (Horizontal Pod Autoscaler) settings
   kubectl get hpa -n devonn
   
   # Update HPA if needed
   kubectl edit hpa $HPA_NAME -n devonn
   ```

3. **If network bottlenecks**
   ```bash
   # Check network policies
   kubectl get networkpolicies -n devonn
   
   # Check service mesh configuration
   aws appmesh describe-virtual-service \
     --mesh-name devonn-mesh-production \
     --virtual-service-name api.devonn.local
   
   # Update App Mesh timeout settings
   aws appmesh update-route \
     --mesh-name devonn-mesh-production \
     --virtual-router-name api-router \
     --route-name api-route \
     --spec file://mesh-configs/increased-timeout.json
   ```

## Service Mesh Connectivity Issues

### Symptom: Services can't communicate through App Mesh

#### Diagnostic Steps:

1. **Check App Mesh resources**
   ```bash
   aws appmesh list-virtual-services --mesh-name devonn-mesh-production
   aws appmesh list-virtual-nodes --mesh-name devonn-mesh-production
   aws appmesh list-routes --mesh-name devonn-mesh-production
   ```

2. **Check Envoy sidecar logs**
   ```bash
   # Get pod name
   POD=$(kubectl get pods -n devonn -l app=api -o jsonpath='{.items[0].metadata.name}')
   
   # Check Envoy logs (assuming Envoy container is named 'envoy')
   kubectl logs $POD -c envoy -n devonn
   ```

3. **Check Envoy configuration**
   ```bash
   kubectl exec -it $POD -c envoy -n devonn -- curl localhost:9901/config_dump
   ```

#### Resolution Steps:

1. **If virtual service or node is misconfigured**
   ```bash
   # Update virtual node
   aws appmesh update-virtual-node \
     --mesh-name devonn-mesh-production \
     --virtual-node-name api-node \
     --spec file://mesh-configs/fixed-virtual-node.json
   ```

2. **If mTLS certificates are expired or invalid**
   ```bash
   # Generate new certificates
   ./scripts/generate-certs.sh
   
   # Update Kubernetes secret
   kubectl create secret tls envoy-certs \
     --cert=service.crt \
     --key=service.key \
     -n devonn \
     --dry-run=client -o yaml | kubectl apply -f -
   
   # Restart pods to pick up new certificates
   kubectl rollout restart deployment -n devonn
   ```

3. **If Envoy proxy needs reconfiguration**
   ```bash
   # Restart Envoy proxy
   kubectl patch deployment $DEPLOYMENT_NAME \
     -p "{\"spec\":{\"template\":{\"metadata\":{\"annotations\":{\"date\":\"`date +'%s'`\"}}}}}" \
     -n devonn
   ```

## Failed Infrastructure Deployment

### Symptom: Terraform apply fails with errors

#### Diagnostic Steps:

1. **Check Terraform error logs**
   ```bash
   # Review last apply log
   cat terraform.err
   ```

2. **Verify AWS resource quotas**
   ```bash
   aws service-quotas list-service-quotas --service-code ec2
   aws service-quotas list-service-quotas --service-code rds
   ```

3. **Check CloudTrail for API errors**
   ```bash
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=EventName,AttributeValue=CreateDBInstance
   ```

#### Resolution Steps:

1. **If resource already exists error**
   ```bash
   # Import existing resource into Terraform state
   terraform import aws_db_instance.postgres_read_replica devonn-postgres-replica-production
   ```

2. **If permission issues**
   ```bash
   # Verify IAM role permissions
   aws iam get-role-policy \
     --role-name TerraformExecutionRole \
     --policy-name TerraformPolicy
   
   # Update IAM permissions
   aws iam put-role-policy \
     --role-name TerraformExecutionRole \
     --policy-name TerraformPolicy \
     --policy-document file://iam/terraform_policy.json
   ```

3. **If quota exceeded**
   ```bash
   # Request quota increase via AWS console
   # In the meantime, adjust resource configuration
   
   # Modify resource configuration to stay within limits
   vim environments/production.tfvars
   
   # Retry with updated configuration
   terraform apply -var-file=environments/production.tfvars
   ```

4. **If resources are in inconsistent state**
   ```bash
   # Refresh Terraform state
   terraform refresh -var-file=environments/production.tfvars
   
   # Apply specific resource
   terraform apply -var-file=environments/production.tfvars -target=aws_db_instance.postgres_read_replica
   ```

## Canary Deployment Issues

### Symptom: Canary deployment is receiving errors

#### Diagnostic Steps:

1. **Compare metrics between production and canary**
   ```bash
   # Get canary service metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/AppMesh \
     --metric-name HTTPCode_Target_5XX_Count \
     --dimensions Name=VirtualNodeName,Value=api-canary-node \
     --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%SZ) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
     --period 300 \
     --statistics Sum
   
   # Compare with production
   aws cloudwatch get-metric-statistics \
     --namespace AWS/AppMesh \
     --metric-name HTTPCode_Target_5XX_Count \
     --dimensions Name=VirtualNodeName,Value=api-node \
     --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%SZ) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
     --period 300 \
     --statistics Sum
   ```

2. **Check canary logs**
   ```bash
   kubectl logs -l version=canary -n devonn
   ```

3. **Verify canary environment configuration**
   ```bash
   kubectl get configmap -l version=canary -n devonn
   ```

#### Resolution Steps:

1. **If errors are persistent and critical**
   ```bash
   # Rollback traffic routing to 100% production
   aws appmesh update-route \
     --mesh-name devonn-mesh-production \
     --virtual-router-name api-router \
     --route-name api-route \
     --spec file://mesh-configs/traffic-100-0.json
   ```

2. **If configuration issues**
   ```bash
   # Update canary ConfigMap
   kubectl edit configmap canary-config -n devonn
   
   # Restart canary pods
   kubectl rollout restart deployment -l version=canary -n devonn
   ```

3. **If successful after bug fix**
   ```bash
   # Apply fix to canary
   kubectl apply -f kubernetes/fixed-canary-deployment.yaml
   
   # Incrementally increase traffic to canary
   aws appmesh update-route \
     --mesh-name devonn-mesh-production \
     --virtual-router-name api-router \
     --route-name api-route \
     --spec file://mesh-configs/traffic-80-20.json
   
   # Verify metrics and complete cutover
   aws appmesh update-route \
     --mesh-name devonn-mesh-production \
     --virtual-router-name api-router \
     --route-name api-route \
     --spec file://mesh-configs/traffic-0-100.json
   ```

## Compliance Scanning Issues

### Symptom: Compliance scan reports failures

#### Diagnostic Steps:

1. **Review compliance report**
   ```bash
   cat compliance-report.json
   ```

2. **Check specific resource configuration**
   ```bash
   # For RDS encryption issues
   aws rds describe-db-instances \
     --db-instance-identifier devonn-postgres-production \
     --query 'DBInstances[0].StorageEncrypted'
   
   # For S3 bucket issues
   aws s3api get-bucket-encryption --bucket devonn-data-production
   aws s3api get-public-access-block --bucket devonn-data-production
   ```

3. **Analyze AWS Config rules**
   ```bash
   aws configservice describe-compliance-by-resource \
     --resource-type AWS::RDS::DBInstance
   ```

#### Resolution Steps:

1. **If encryption is missing**
   ```bash
   # Enable encryption for RDS snapshot, then restore
   aws rds create-db-snapshot \
     --db-instance-identifier devonn-postgres-production \
     --db-snapshot-identifier pre-encryption-$(date +%Y-%m-%d)
   
   # Create encrypted instance from snapshot
   aws rds restore-db-snapshot \
     --db-instance-identifier devonn-postgres-encrypted \
     --db-snapshot-identifier pre-encryption-$(date +%Y-%m-%d) \
     --storage-encrypted \
     --kms-key-id alias/aws/rds
   ```

2. **If public access controls are insufficient**
   ```bash
   # Update S3 bucket public access block
   aws s3api put-public-access-block \
     --bucket devonn-data-production \
     --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
   ```

3. **If security group rules are too permissive**
   ```bash
   # Get security group ID
   SG_ID=$(aws rds describe-db-instances \
     --db-instance-identifier devonn-postgres-production \
     --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
     --output text)
   
   # Remove overly permissive rule
   aws ec2 revoke-security-group-ingress \
     --group-id $SG_ID \
     --protocol tcp \
     --port 5432 \
     --cidr 0.0.0.0/0
   
   # Add more restrictive rule
   aws ec2 authorize-security-group-ingress \
     --group-id $SG_ID \
     --protocol tcp \
     --port 5432 \
     --cidr $APP_SUBNET_CIDR
   ```

4. **Update Terraform configuration to prevent future issues**
   ```bash
   # Update security configurations in Terraform
   vim terraform/modules/rds/main.tf
   
   # Update state to match
   terraform apply -var-file=environments/production.tfvars
   ```
