package test

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/gruntwork-io/terratest/modules/terraform"
	"github.com/stretchr/testify/assert"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/rds"
	"github.com/aws/aws-sdk-go-v2/service/rds/types"
)

// Initialize AWS session using AWS SDK v2
func createAWSSession(region string) *rds.Client {
	cfg, err := config.LoadDefaultConfig(context.TODO(),
		config.WithRegion(region),
	)
	if err != nil {
		panic(fmt.Sprintf("unable to load AWS SDK config, %v", err))
	}
	return rds.NewFromConfig(cfg)
}

// Get RDS instance details
func getRdsInstanceDetails(client *rds.Client, dbInstanceId string) (*types.DBInstance, error) {
	input := &rds.DescribeDBInstancesInput{
		DBInstanceIdentifier: &dbInstanceId,
	}
	resp, err := client.DescribeDBInstances(context.Background(), input)
	if err != nil {
		return nil, fmt.Errorf("unable to describe DB instance, %v", err)
	}
	if len(resp.DBInstances) == 0 {
		return nil, fmt.Errorf("no RDS instance found with ID %s", dbInstanceId)
	}
	return &resp.DBInstances[0], nil
}

// Get RDS instance status
func getRdsInstanceStatus(client *rds.Client, dbInstanceId string) (string, error) {
	instance, err := getRdsInstanceDetails(client, dbInstanceId)
	if err != nil {
		return "", err
	}
	return *instance.DBInstanceStatus, nil
}

// Test the existing RDS module configuration without modifying infrastructure
func TestRDSModule(t *testing.T) {
	t.Parallel()

	workingDir := "../../src/data/manifest/terraform"

	terraformOptions := &terraform.Options{
		TerraformDir:    workingDir,
		TerraformBinary: "terraform",
		NoColor:         true,
		EnvVars: map[string]string{
			"AWS_DEFAULT_REGION": os.Getenv("AWS_DEFAULT_REGION"),
		},
	}

	// Use the RDS endpoint stored in GitHub's environment variables
	rdsEndpoint := os.Getenv("rds_endpoint")
	assert.NotEmpty(t, rdsEndpoint, "RDS endpoint must not be empty")

	// ✅ Try to get rds_endpoint_id, and handle gracefully if not found
	rdsId := os.Getenv("rds_endpoint_id")
	assert.NotEmpty(t, rdsId, "RDS endpoint ID must not be empty")

	// ✅ Try to get EKS cluster name
	eksClusterName := os.Getenv("eks_cluster_name")
	assert.NotEmpty(t, eksClusterName, "EKS cluster name must not be empty")

	client := createAWSSession(terraformOptions.EnvVars["AWS_DEFAULT_REGION"])

	instance, err := getRdsInstanceDetails(client, rdsId)
	if err != nil {
		t.Fatalf("Error retrieving RDS instance details: %v", err)
	}

	assert.Equal(t, "postgres", *instance.Engine)
	assert.Equal(t, "db.t3.micro", *instance.DBInstanceClass)
	assert.False(t, *instance.MultiAZ)

	// Wait until the instance becomes available
	maxRetries := 30
	for i := 0; i < maxRetries; i++ {
		status, err := getRdsInstanceStatus(client, rdsId)
		if err != nil {
			t.Fatalf("Error checking RDS status: %v", err)
		}
		if status == "available" {
			break
		}
		time.Sleep(30 * time.Second)
	}
}
