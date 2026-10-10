#!/bin/bash

# GitHub Secrets Upload Script for Supreme AI Deployment Hub
# Automatically uploads all required secrets to GitHub repository
# Usage: ./scripts/secrets-upload.sh

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}Error: GitHub CLI (gh) is not installed.${NC}"
    echo "Please install it from: https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo -e "${RED}Error: Not authenticated with GitHub CLI.${NC}"
    echo "Please run: gh auth login"
    exit 1
fi

echo -e "${BLUE}🔐 GitHub Secrets Upload Tool${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Function to upload secret
upload_secret() {
    local secret_name=$1
    local secret_description=$2
    
    echo -e "${YELLOW}📝 Setting up: ${secret_name}${NC}"
    echo -e "   Description: ${secret_description}"
    
    # Check if secret already exists
    if gh secret list | grep -q "^${secret_name}"; then
        echo -e "${YELLOW}   ⚠️  Secret already exists. Overwrite? (y/N):${NC}"
        read -r overwrite
        if [[ ! $overwrite =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}   ⏭️  Skipped${NC}"
            echo ""
            return
        fi
    fi
    
    echo -n "   Enter value (hidden): "
    read -rs secret_value
    echo ""
    
    if [ -z "$secret_value" ]; then
        echo -e "${RED}   ❌ Empty value, skipping${NC}"
        echo ""
        return
    fi
    
    # Upload the secret
    if echo "$secret_value" | gh secret set "$secret_name"; then
        echo -e "${GREEN}   ✅ Successfully uploaded${NC}"
    else
        echo -e "${RED}   ❌ Failed to upload${NC}"
    fi
    echo ""
}

# Function to upload file-based secret
upload_file_secret() {
    local secret_name=$1
    local secret_description=$2
    local file_path=$3
    
    echo -e "${YELLOW}📁 Setting up file-based secret: ${secret_name}${NC}"
    echo -e "   Description: ${secret_description}"
    echo -e "   Expected file: ${file_path}"
    
    if [ ! -f "$file_path" ]; then
        echo -e "${RED}   ❌ File not found, skipping${NC}"
        echo ""
        return
    fi
    
    # Check if secret already exists
    if gh secret list | grep -q "^${secret_name}"; then
        echo -e "${YELLOW}   ⚠️  Secret already exists. Overwrite? (y/N):${NC}"
        read -r overwrite
        if [[ ! $overwrite =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}   ⏭️  Skipped${NC}"
            echo ""
            return
        fi
    fi
    
    # Upload the file secret
    if gh secret set "$secret_name" < "$file_path"; then
        echo -e "${GREEN}   ✅ Successfully uploaded from file${NC}"
    else
        echo -e "${RED}   ❌ Failed to upload${NC}"
    fi
    echo ""
}

# AWS Secrets
echo -e "${BLUE}☁️  AWS Configuration${NC}"
upload_secret "AWS_ACCESS_KEY_ID" "AWS IAM access key ID"
upload_secret "AWS_SECRET_ACCESS_KEY" "AWS IAM secret access key"
upload_secret "AWS_DEFAULT_REGION" "Default AWS region (e.g., us-east-1)"

# Azure Secrets
echo -e "${BLUE}☁️  Azure Configuration${NC}"
upload_secret "AZURE_CLIENT_ID" "Azure service principal client ID"
upload_secret "AZURE_CLIENT_SECRET" "Azure service principal secret"
upload_secret "AZURE_TENANT_ID" "Azure directory (tenant) ID"
upload_secret "AZURE_SUBSCRIPTION_ID" "Azure subscription ID"

# GCP Secrets
echo -e "${BLUE}☁️  Google Cloud Configuration${NC}"
upload_file_secret "GCP_CREDENTIALS_JSON" "Base64-encoded GCP service account key" "./gcp-credentials.json"

# Notification Secrets
echo -e "${BLUE}🔔 Notification Configuration${NC}"
upload_secret "SLACK_WEBHOOK_URL" "Slack webhook URL for deployment notifications"
upload_secret "EMAIL_USERNAME" "SMTP username for email notifications"
upload_secret "EMAIL_PASSWORD" "SMTP password for email notifications"
upload_secret "NOTIFICATION_EMAIL" "Email address to receive notifications"

# Additional Application Secrets
echo -e "${BLUE}🔑 Application Secrets${NC}"
upload_secret "DATABASE_URL" "Production database connection string"
upload_secret "JWT_SECRET" "JWT signing secret"
upload_secret "API_KEY" "External API key"
upload_secret "ENCRYPTION_KEY" "Application encryption key"

echo -e "${GREEN}🎉 Secret upload process completed!${NC}"
echo ""
echo -e "${BLUE}📋 Next Steps:${NC}"
echo "1. Verify secrets in GitHub: Settings > Secrets and variables > Actions"
echo "2. Test the deployment workflow"
echo "3. Monitor the first deployment run"
echo ""
echo -e "${YELLOW}💡 Pro Tips:${NC}"
echo "• Rotate secrets regularly (monthly recommended)"
echo "• Use least privilege principle for all credentials"
echo "• Monitor secret usage in GitHub audit logs"
echo ""