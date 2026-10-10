
#!/usr/bin/env node

/**
 * Build script for Devonn.AI Chrome Extension
 * 
 * This script builds the extension for a specific environment by:
 * 1. Setting environment-specific configuration
 * 2. Running the build process
 * 3. Creating a ZIP package ready for deployment
 * 
 * Usage: node scripts/build-env.js [environment]
 * Where [environment] is one of: development, staging, production
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { getEnvironmentConfig } = require('../deployment/environments');

// Get environment from command line or default to development
const env = process.argv[2] || 'development';
const config = getEnvironmentConfig(env);

console.log(`Building Devonn.AI extension for ${env} environment`);

// Create a temporary config file with environment settings
const tempConfigPath = path.join(__dirname, '../src/api/env-config.ts');
const configContent = `
// THIS FILE IS AUTO-GENERATED - DO NOT EDIT DIRECTLY
// Generated for the ${env} environment

export const ENV_CONFIG = {
  environment: '${env}',
  apiUrl: '${config.apiUrl}',
  logLevel: '${config.logLevel}',
  features: ${JSON.stringify(config.features, null, 2)}
};
`;

fs.writeFileSync(tempConfigPath, configContent);
console.log(`✅ Environment config written to ${tempConfigPath}`);

try {
  // Run build process
  console.log('Building extension...');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Create ZIP package
  console.log('Creating distribution package...');
  const distDir = path.join(__dirname, '../dist');
  const outputZip = path.join(__dirname, `../devonn-ai-${env}.zip`);
  
  // Change to dist directory and zip contents
  process.chdir(distDir);
  execSync(`zip -r ${outputZip} ./*`, { stdio: 'inherit' });
  
  console.log(`✅ Build complete! Package created at ${outputZip}`);
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
} finally {
  // Clean up the temporary config file
  if (env !== 'development') {
    fs.unlinkSync(tempConfigPath);
    console.log(`✅ Temporary config file removed`);
  }
}
