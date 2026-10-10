
// Enhanced intents our system can detect
export const INTENTS = [
  { name: 'greeting', keywords: ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'] },
  { name: 'help', keywords: ['help', 'assist', 'support', 'guide', 'how to', 'how do i'] },
  { name: 'pricing', keywords: ['price', 'cost', 'billing', 'subscription', 'pay', 'money', 'fee'] },
  { name: 'features', keywords: ['feature', 'capability', 'can do', 'functionality', 'what does', 'what can'] },
  { name: 'deployment', keywords: ['deploy', 'deployment', 'install', 'setup', 'configure', 'kubernetes', 'k8s'] },
  { name: 'technical', keywords: ['code', 'api', 'integration', 'architecture', 'infrastructure', 'microservice'] },
  { name: 'farewell', keywords: ['bye', 'goodbye', 'see you', 'farewell', 'exit', 'close'] },
  { name: 'api', keywords: ['api', 'endpoint', 'connect', 'integration', 'service', 'webhook'] },
  { name: 'status', keywords: ['status', 'health', 'monitor', 'metrics', 'how is', 'how are', 'what\'s happening'] },
];

// Entity types our system can recognize
export const ENTITY_TYPES = {
  SERVICE: 'service',
  PLATFORM: 'platform',
  TIME_PERIOD: 'time_period',
  NUMBER: 'number',
  ACTION: 'action',
};

// Service entities our system recognizes
export const SERVICE_ENTITIES = [
  'kubernetes', 'k8s', 'istio', 'prometheus', 'grafana', 'jaeger', 'kong', 'argo', 'helm',
];

// Platform entities
export const PLATFORM_ENTITIES = [
  'aws', 'gcp', 'azure', 'google cloud', 'amazon', 'microsoft', 'digital ocean', 'heroku', 'vercel',
];

// Action entities
export const ACTION_ENTITIES = [
  'create', 'update', 'delete', 'deploy', 'monitor', 'integrate', 'connect', 'install', 'configure',
];

// Time period entities
export const TIME_PERIOD_ENTITIES = [
  'today', 'yesterday', 'this week', 'last week', 'this month', 'last month',
];
