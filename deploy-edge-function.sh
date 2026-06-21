#!/bin/bash

# Devonn.AI AWS EKS Edge Function Deployment Script
# This script deploys the aws-eks-deploy-v2 edge function to Supabase

set -e

echo "🚀 Devonn.AI Edge Function Deployment"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_REF="uludrxjjmbgcowmvrixe"
FUNCTION_NAME="aws-eks-deploy-v2"

echo -e "${YELLOW}📋 Configuration:${NC}"
echo "   Project: $PROJECT_REF"
echo "   Function: $FUNCTION_NAME"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase CLI not found. Installing...${NC}"
    npm install -g supabase
    echo -e "${GREEN}✅ Supabase CLI installed${NC}"
else
    echo -e "${GREEN}✅ Supabase CLI found${NC}"
fi

# Check if logged in
echo ""
echo -e "${YELLOW}🔐 Checking Supabase authentication...${NC}"
if ! supabase projects list &> /dev/null; then
    echo -e "${YELLOW}⚠️  Not logged in to Supabase. Please log in:${NC}"
    supabase login
fi

echo -e "${GREEN}✅ Authenticated${NC}"

# Deploy the function
echo ""
echo -e "${YELLOW}📦 Deploying edge function...${NC}"
echo ""

cd "$(dirname "$0")"

supabase functions deploy $FUNCTION_NAME --project-ref $PROJECT_REF

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Edge function deployed successfully!${NC}"
    echo ""
    echo -e "${GREEN}🎉 Your Devonn.AI platform now has real AWS EKS deployment capabilities!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Go to https://d3vonn.io/deployment"
    echo "  2. Click 'Start Deployment'"
    echo "  3. Watch your real AWS infrastructure deploy!"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Deployment failed. Please check the error messages above.${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Ensure you're logged in: supabase login"
    echo "  2. Check project access: supabase projects list"
    echo "  3. Verify function exists: ls -la supabase/functions/$FUNCTION_NAME/"
    echo ""
    exit 1
fi
