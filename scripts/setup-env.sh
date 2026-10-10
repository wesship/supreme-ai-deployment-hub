
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}       Devonn.AI Environment Setup Script          ${NC}"
echo -e "${BLUE}===================================================${NC}"

# Check if .env exists and create it if not
if [ ! -f .env ]; then
  echo -e "${YELLOW}Creating .env file...${NC}"
  touch .env
else
  echo -e "${YELLOW}Found existing .env file.${NC}"
  read -p "Do you want to overwrite it? (y/n) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Operation cancelled. Exiting...${NC}"
    exit 1
  fi
  > .env
fi

echo -e "\n${BLUE}Setting up API URLs...${NC}"
echo "# API URLs for different environments" >> .env
echo "DEV_API_URL=http://localhost:8000" >> .env
echo "STAGING_API_URL=https://staging-api.d3vonn.io" >> .env
echo "PRODUCTION_API_URL=https://api.d3vonn.io" >> .env

# OpenAI API Key
echo -e "\n${BLUE}Setting up OpenAI API...${NC}"
read -p "Enter your OpenAI API Key (press enter to skip): " OPENAI_API_KEY
if [ -n "$OPENAI_API_KEY" ]; then
  echo -e "\n# OpenAI Configuration" >> .env
  echo "OPENAI_API_KEY=$OPENAI_API_KEY" >> .env
  echo -e "${GREEN}OpenAI API Key configured.${NC}"
  
  # Test the API key
  echo -e "${YELLOW}Testing OpenAI API Key...${NC}"
  export OPENAI_API_KEY=$OPENAI_API_KEY
  if node scripts/validate-openai-key.js; then
    echo -e "${GREEN}OpenAI API Key verified successfully!${NC}"
  else
    echo -e "${RED}OpenAI API Key validation failed. Please check your key and try again.${NC}"
  fi
else
  echo -e "${YELLOW}Skipping OpenAI API configuration.${NC}"
fi

# Chrome Web Store details
echo -e "\n${BLUE}Setting up Chrome Web Store API...${NC}"
read -p "Enter your Chrome Extension ID (press enter to skip): " CHROME_EXTENSION_ID
if [ -n "$CHROME_EXTENSION_ID" ]; then
  echo -e "\n# Chrome Web Store Configuration" >> .env
  echo "CHROME_EXTENSION_ID=$CHROME_EXTENSION_ID" >> .env
  
  read -p "Enter your Chrome Client ID: " CHROME_CLIENT_ID
  echo "CHROME_CLIENT_ID=$CHROME_CLIENT_ID" >> .env
  
  read -p "Enter your Chrome Client Secret: " CHROME_CLIENT_SECRET
  echo "CHROME_CLIENT_SECRET=$CHROME_CLIENT_SECRET" >> .env
  
  read -p "Enter your Chrome Refresh Token (or press enter to generate one): " CHROME_REFRESH_TOKEN
  if [ -z "$CHROME_REFRESH_TOKEN" ]; then
    echo -e "${YELLOW}Attempting to generate a new refresh token...${NC}"
    export CHROME_CLIENT_ID=$CHROME_CLIENT_ID
    export CHROME_CLIENT_SECRET=$CHROME_CLIENT_SECRET
    if command -v node &> /dev/null; then
      TOKEN=$(node scripts/get-chrome-refresh-token.js)
      CHROME_REFRESH_TOKEN=$TOKEN
    else
      echo -e "${RED}Node.js is not installed. Cannot generate refresh token automatically.${NC}"
      read -p "Please enter your refresh token manually: " CHROME_REFRESH_TOKEN
    fi
  fi
  echo "CHROME_REFRESH_TOKEN=$CHROME_REFRESH_TOKEN" >> .env
  echo -e "${GREEN}Chrome Web Store API configured.${NC}"
else
  echo -e "${YELLOW}Skipping Chrome Web Store API configuration.${NC}"
fi

# Slack Webhook
echo -e "\n${BLUE}Setting up Slack notifications...${NC}"
read -p "Enter your Slack Webhook URL (press enter to skip): " SLACK_WEBHOOK_URL
if [ -n "$SLACK_WEBHOOK_URL" ]; then
  echo -e "\n# Slack Configuration" >> .env
  echo "SLACK_WEBHOOK_URL=$SLACK_WEBHOOK_URL" >> .env
  echo -e "${GREEN}Slack notifications configured.${NC}"
else
  echo -e "${YELLOW}Skipping Slack notifications configuration.${NC}"
fi

echo -e "\n${GREEN}Environment setup complete!${NC}"
echo -e "${YELLOW}NOTE: Your secrets are stored in .env - make sure this file is added to .gitignore${NC}"

# Check if .env is in .gitignore
if grep -q "\.env" .gitignore; then
  echo -e "${GREEN}.env is already in .gitignore.${NC}"
else
  echo -e "${YELLOW}Adding .env to .gitignore...${NC}"
  echo ".env" >> .gitignore
  echo -e "${GREEN}Added .env to .gitignore.${NC}"
fi

# Add to deployment/.gitignore if it exists
if [ -f deployment/.gitignore ]; then
  if ! grep -q "env-config.ts" deployment/.gitignore; then
    echo -e "${YELLOW}Adding env-config.ts to deployment/.gitignore...${NC}"
    echo "env-config.ts" >> deployment/.gitignore
    echo -e "${GREEN}Added env-config.ts to deployment/.gitignore.${NC}"
  fi
fi

echo -e "\n${BLUE}===================================================${NC}"
echo -e "${BLUE}       Environment Setup Completed Successfully     ${NC}"
echo -e "${BLUE}===================================================${NC}"
