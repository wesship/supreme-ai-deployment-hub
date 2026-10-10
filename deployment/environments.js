
/**
 * Devonn.AI Environment Configuration
 * 
 * This file defines the configuration for different deployment environments:
 * - development: Local development environment
 * - staging: Testing environment for QA and pre-release testing
 * - production: Live environment for end users
 */

const environments = {
  // Development environment (local)
  development: {
    apiUrl: 'http://localhost:8000',
    logLevel: 'debug',
    features: {
      experimentalTools: true,
      betaAgents: true,
      debugMode: true
    }
  },
  
  // Staging environment (testing)
  staging: {
    apiUrl: 'https://staging-api.d3vonn.io',
    logLevel: 'info',
    features: {
      experimentalTools: true,
      betaAgents: true,
      debugMode: true
    }
  },
  
  // Production environment (public)
  production: {
    apiUrl: 'https://api.d3vonn.io',
    logLevel: 'error',
    features: {
      experimentalTools: false,
      betaAgents: false,
      debugMode: false
    }
  }
};

/**
 * Get configuration for the specified environment
 * @param {string} env - Environment name ('development', 'staging', or 'production')
 * @returns {object} Environment configuration
 */
function getEnvironmentConfig(env = 'development') {
  if (!environments[env]) {
    console.warn(`Unknown environment: ${env}, falling back to development`);
    return environments.development;
  }
  return environments[env];
}

module.exports = {
  environments,
  getEnvironmentConfig
};
