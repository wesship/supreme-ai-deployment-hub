// Agent Marketplace Types for D3VONN.IO

export type AgentCategory = 'security' | 'infrastructure' | 'automation' | 'analytics' | 'integration' | 'custom';
export type AgentPricingModel = 'free' | 'one-time' | 'subscription' | 'usage-based';
export type AgentStatus = 'draft' | 'pending-review' | 'published' | 'deprecated' | 'revoked';
export type AgentCapability = 'monitoring' | 'alerting' | 'remediation' | 'reporting' | 'integration' | 'scheduling' | 'ml-powered';
export type VerificationLevel = 'unverified' | 'reviewed' | 'verified' | 'production-ready';
export type PermissionRisk = 'low' | 'medium' | 'high' | 'critical';

export interface AgentPricing { model: AgentPricingModel; amount?: number; currency?: string; interval?: 'monthly' | 'yearly' | 'per-use'; }
export interface AgentAuthor { id: string; name: string; avatar?: string; verified: boolean; agentCount: number; }
export interface AgentReview { id: string; userId: string; userName: string; userAvatar?: string; rating: number; comment: string; createdAt: string; helpful: number; }
export interface AgentStats { downloads: number; activeInstalls: number; avgRating: number; reviewCount: number; lastUpdated: string; }

export interface AgentVerification {
  level: VerificationLevel;
  score: number;
  security: number;
  reliability: number;
  documentation: number;
  capabilityAccuracy: number;
  permissionsReviewed: boolean;
  dataHandlingReviewed: boolean;
  lastVerifiedAt?: string;
  verifier?: string;
}

export interface AgentPermission { key: string; label: string; description: string; risk: PermissionRisk; required: boolean; }
export interface AgentDependency { id: string; name: string; version?: string; required: boolean; healthy?: boolean; }
export interface AgentManifest {
  schemaVersion: '1.0';
  publisher: string;
  capabilities: AgentCapability[];
  permissions: AgentPermission[];
  dependencies: AgentDependency[];
  integrations: string[];
  dataRequirements: string[];
  updatePolicy: 'automatic' | 'approval-required' | 'manual';
  rollbackSupported: boolean;
}

export interface AgentTemplate {
  id: string; name: string; slug: string; description: string; longDescription?: string;
  category: AgentCategory; capabilities: AgentCapability[]; pricing: AgentPricing;
  author: AgentAuthor; status: AgentStatus; version: string; icon?: string; banner?: string; screenshots?: string[];
  tags: string[]; requirements?: string[]; integrations?: string[]; stats: AgentStats;
  createdAt: string; updatedAt: string; featured?: boolean;
  verification?: AgentVerification; manifest?: AgentManifest;
}

export interface MarketplaceFilters {
  category?: AgentCategory; pricing?: AgentPricingModel; capabilities?: AgentCapability[];
  minRating?: number; minVerificationScore?: number; search?: string;
  sortBy?: 'popular' | 'newest' | 'rating' | 'verification' | 'price-low' | 'price-high';
}

export interface AgentCompatibility { score: number; compatible: boolean; missing: string[]; warnings: string[]; satisfied: string[]; }
export interface DeployedAgent {
  id: string; templateId: string; userId: string; name: string; config: Record<string, any>;
  status: 'active' | 'paused' | 'error' | 'configuring'; deployedAt: string; lastActiveAt?: string;
  metrics?: { tasksCompleted: number; uptime: number; errorsCount: number; };
}

export interface AgentDeploymentConfig {
  name: string; environment: 'development' | 'staging' | 'production'; schedule?: string;
  triggers?: Array<{ type: 'webhook' | 'event' | 'schedule'; config: Record<string, any>; }>;
  notifications?: { email?: string[]; slack?: string; webhook?: string; };
  resources?: { memory?: string; timeout?: number; };
}
