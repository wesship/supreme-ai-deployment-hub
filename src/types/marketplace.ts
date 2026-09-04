// Agent Marketplace Types for agents.d3vonn.io

export type AgentCategory = 
  | 'security'
  | 'infrastructure'
  | 'automation'
  | 'analytics'
  | 'integration'
  | 'custom';

export type AgentPricingModel = 
  | 'free'
  | 'one-time'
  | 'subscription'
  | 'usage-based'
  | 'contact-sales';

export type AgentStatus = 
  | 'draft'
  | 'pending-review'
  | 'published'
  | 'deprecated';

export type AgentCapability = 
  | 'monitoring'
  | 'alerting'
  | 'remediation'
  | 'reporting'
  | 'integration'
  | 'scheduling'
  | 'ml-powered'
  | (string & {});

export interface AgentPricing {
  model: AgentPricingModel;
  amount?: number;
  currency?: string;
  interval?: 'monthly' | 'yearly' | 'per-use';
}

export interface AgentAuthor {
  id: string;
  name: string;
  avatar?: string;
  verified: boolean;
  agentCount: number;
}

export interface AgentReview {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  comment: string;
  createdAt: string;
  helpful: number;
}

export interface AgentStats {
  downloads: number;
  activeInstalls: number;
  avgRating: number;
  reviewCount: number;
  lastUpdated: string;
}

export interface AgentTemplate {
  id: string;
  name: string;
  slug: string;
  description: string;
  longDescription?: string;
  category: AgentCategory;
  capabilities: AgentCapability[];
  pricing: AgentPricing;
  author: AgentAuthor;
  status: AgentStatus;
  version: string;
  icon?: string;
  banner?: string;
  screenshots?: string[];
  tags: string[];
  requirements?: string[];
  integrations?: string[];
  stats: AgentStats;
  createdAt: string;
  updatedAt: string;
  featured?: boolean;
}

export interface MarketplaceFilters {
  category?: AgentCategory;
  pricing?: AgentPricingModel;
  capabilities?: AgentCapability[];
  minRating?: number;
  search?: string;
  sortBy?: 'popular' | 'newest' | 'rating' | 'price-low' | 'price-high';
}

export interface DeployedAgent {
  id: string;
  templateId: string;
  userId: string;
  name: string;
  config: Record<string, any>;
  status: 'active' | 'paused' | 'error' | 'configuring';
  deployedAt: string;
  lastActiveAt?: string;
  metrics?: {
    tasksCompleted: number;
    uptime: number;
    errorsCount: number;
  };
}

export interface AgentDeploymentConfig {
  name: string;
  environment: 'development' | 'staging' | 'production';
  schedule?: string; // cron expression
  triggers?: Array<{
    type: 'webhook' | 'event' | 'schedule';
    config: Record<string, any>;
  }>;
  notifications?: {
    email?: string[];
    slack?: string;
    webhook?: string;
  };
  resources?: {
    memory?: string;
    timeout?: number;
  };
}
