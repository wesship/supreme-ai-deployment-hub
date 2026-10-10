
/**
 * Devonn.AI Environment Configuration
 * 
 * Copy this file to env-config.ts and modify as needed for your local development.
 * Note: env-config.ts should be in .gitignore to avoid committing sensitive data.
 */

export const environmentConfig = {
  // API URLs
  apiUrl: process.env.API_URL || 'http://localhost:8000',
  
  // OpenAI Configuration
  openAI: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: 'gpt-4o-mini', // Default model
  },
  
  // Chrome Web Store
  chromeWebStore: {
    extensionId: process.env.CHROME_EXTENSION_ID || '',
    clientId: process.env.CHROME_CLIENT_ID || '',
    clientSecret: process.env.CHROME_CLIENT_SECRET || '',
    refreshToken: process.env.CHROME_REFRESH_TOKEN || '',
  },
  
  // Slack Configuration
  slack: {
    webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  },
  
  // Feature flags
  features: {
    // Enable experimental features in development
    experimentalTools: process.env.NODE_ENV === 'development',
    betaAgents: process.env.NODE_ENV === 'development',
    debugMode: process.env.NODE_ENV !== 'production',
  }
};

export default environmentConfig;
