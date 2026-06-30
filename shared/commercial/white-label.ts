/**
 * D3VONN Commercial Readiness — White-Label & Multi-Region
 *
 * White-label customization engine and multi-region deployment
 * configuration for enterprise and OEM customers.
 */

// ─────────────────────────────────────────────────────────────────
// White-Label Types
// ─────────────────────────────────────────────────────────────────

export interface WhiteLabelConfig {
  id: string;
  tenantId: string;
  brandName: string;
  domain: string;
  theme: ThemeConfig;
  logo: LogoConfig;
  emails: EmailConfig;
  features: FeatureVisibility;
  legal: LegalConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  borderRadius: string;
  darkMode: boolean;
  customCss?: string;
}

export interface LogoConfig {
  primary: string; // URL
  icon: string; // URL
  favicon: string; // URL
  darkVariant?: string; // URL
}

export interface EmailConfig {
  fromName: string;
  fromEmail: string;
  replyTo: string;
  footerText: string;
  templateOverrides: Record<string, string>;
}

export interface FeatureVisibility {
  showPoweredBy: boolean;
  showDocumentation: boolean;
  showChangelog: boolean;
  showStatusPage: boolean;
  customNavItems: NavItem[];
  hiddenFeatures: string[];
}

export interface NavItem {
  label: string;
  url: string;
  icon?: string;
  external: boolean;
}

export interface LegalConfig {
  termsUrl: string;
  privacyUrl: string;
  companyName: string;
  supportEmail: string;
  supportUrl?: string;
}

// ─────────────────────────────────────────────────────────────────
// Multi-Region Types
// ─────────────────────────────────────────────────────────────────

export type RegionId = "us-east-1" | "us-west-2" | "eu-west-1" | "eu-central-1" | "ap-southeast-1" | "ap-northeast-1";
export type RegionStatus = "active" | "provisioning" | "maintenance" | "degraded" | "offline";

export interface Region {
  id: RegionId;
  name: string;
  location: string;
  status: RegionStatus;
  primary: boolean;
  services: RegionService[];
  latency: Record<RegionId, number>; // ms to other regions
  compliance: string[]; // GDPR, HIPAA, etc.
}

export interface RegionService {
  name: string;
  status: "healthy" | "degraded" | "down";
  endpoint: string;
  version: string;
}

export interface TenantRegionConfig {
  tenantId: string;
  primaryRegion: RegionId;
  replicaRegions: RegionId[];
  dataResidency: RegionId[];
  failoverPolicy: "automatic" | "manual";
  crossRegionReplication: boolean;
}

export interface RegionHealth {
  regionId: RegionId;
  uptime: number; // percentage
  avgLatency: number; // ms
  requestsPerSecond: number;
  errorRate: number;
  lastChecked: string;
}

// ─────────────────────────────────────────────────────────────────
// White-Label Engine
// ─────────────────────────────────────────────────────────────────

export class WhiteLabelEngine {
  private configs: Map<string, WhiteLabelConfig> = new Map();

  createConfig(config: Omit<WhiteLabelConfig, "id" | "createdAt" | "updatedAt">): WhiteLabelConfig {
    const full: WhiteLabelConfig = {
      ...config,
      id: `wl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.configs.set(config.tenantId, full);
    return full;
  }

  getConfig(tenantId: string): WhiteLabelConfig | undefined {
    return this.configs.get(tenantId);
  }

  updateConfig(tenantId: string, updates: Partial<WhiteLabelConfig>): WhiteLabelConfig | null {
    const config = this.configs.get(tenantId);
    if (!config) return null;
    Object.assign(config, updates, { updatedAt: new Date().toISOString() });
    return config;
  }

  updateTheme(tenantId: string, theme: Partial<ThemeConfig>): boolean {
    const config = this.configs.get(tenantId);
    if (!config) return false;
    Object.assign(config.theme, theme);
    config.updatedAt = new Date().toISOString();
    return true;
  }

  generateCssVariables(tenantId: string): string {
    const config = this.configs.get(tenantId);
    if (!config) return "";

    return `:root {
  --d3v-primary: ${config.theme.primaryColor};
  --d3v-secondary: ${config.theme.secondaryColor};
  --d3v-accent: ${config.theme.accentColor};
  --d3v-background: ${config.theme.backgroundColor};
  --d3v-text: ${config.theme.textColor};
  --d3v-font-family: ${config.theme.fontFamily};
  --d3v-border-radius: ${config.theme.borderRadius};
}`;
  }

  listConfigs(): WhiteLabelConfig[] {
    return [...this.configs.values()];
  }
}

// ─────────────────────────────────────────────────────────────────
// Multi-Region Manager
// ─────────────────────────────────────────────────────────────────

export class MultiRegionManager {
  private regions: Map<RegionId, Region> = new Map();
  private tenantConfigs: Map<string, TenantRegionConfig> = new Map();
  private healthHistory: RegionHealth[] = [];

  constructor() {
    this.initializeRegions();
  }

  private initializeRegions(): void {
    const defaultRegions: Region[] = [
      { id: "us-east-1", name: "US East (Virginia)", location: "Ashburn, VA", status: "active", primary: true, services: [], latency: { "us-east-1": 0, "us-west-2": 65, "eu-west-1": 85, "eu-central-1": 95, "ap-southeast-1": 230, "ap-northeast-1": 170 }, compliance: ["SOC2", "HIPAA"] },
      { id: "us-west-2", name: "US West (Oregon)", location: "Portland, OR", status: "active", primary: false, services: [], latency: { "us-east-1": 65, "us-west-2": 0, "eu-west-1": 140, "eu-central-1": 150, "ap-southeast-1": 175, "ap-northeast-1": 110 }, compliance: ["SOC2", "HIPAA"] },
      { id: "eu-west-1", name: "EU West (Ireland)", location: "Dublin, IE", status: "active", primary: false, services: [], latency: { "us-east-1": 85, "us-west-2": 140, "eu-west-1": 0, "eu-central-1": 25, "ap-southeast-1": 180, "ap-northeast-1": 220 }, compliance: ["SOC2", "GDPR"] },
      { id: "eu-central-1", name: "EU Central (Frankfurt)", location: "Frankfurt, DE", status: "active", primary: false, services: [], latency: { "us-east-1": 95, "us-west-2": 150, "eu-west-1": 25, "eu-central-1": 0, "ap-southeast-1": 170, "ap-northeast-1": 210 }, compliance: ["SOC2", "GDPR"] },
      { id: "ap-southeast-1", name: "Asia Pacific (Singapore)", location: "Singapore", status: "active", primary: false, services: [], latency: { "us-east-1": 230, "us-west-2": 175, "eu-west-1": 180, "eu-central-1": 170, "ap-southeast-1": 0, "ap-northeast-1": 70 }, compliance: ["SOC2"] },
      { id: "ap-northeast-1", name: "Asia Pacific (Tokyo)", location: "Tokyo, JP", status: "active", primary: false, services: [], latency: { "us-east-1": 170, "us-west-2": 110, "eu-west-1": 220, "eu-central-1": 210, "ap-southeast-1": 70, "ap-northeast-1": 0 }, compliance: ["SOC2"] },
    ];

    for (const region of defaultRegions) {
      this.regions.set(region.id, region);
    }
  }

  // ─── Region Management ──────────────────────────────────────

  getRegion(regionId: RegionId): Region | undefined {
    return this.regions.get(regionId);
  }

  listRegions(status?: RegionStatus): Region[] {
    let regions = [...this.regions.values()];
    if (status) regions = regions.filter((r) => r.status === status);
    return regions;
  }

  getRegionsForCompliance(framework: string): Region[] {
    return [...this.regions.values()].filter((r) => r.compliance.includes(framework));
  }

  // ─── Tenant Region Config ──────────────────────────────────

  configureTenant(config: TenantRegionConfig): void {
    this.tenantConfigs.set(config.tenantId, config);
  }

  getTenantConfig(tenantId: string): TenantRegionConfig | undefined {
    return this.tenantConfigs.get(tenantId);
  }

  selectOptimalRegion(tenantId: string, userRegion?: RegionId): RegionId {
    const config = this.tenantConfigs.get(tenantId);
    if (!config) return "us-east-1";

    if (userRegion && config.dataResidency.includes(userRegion)) {
      return userRegion;
    }

    // Return primary region
    return config.primaryRegion;
  }

  // ─── Health Monitoring ──────────────────────────────────────

  recordHealth(health: RegionHealth): void {
    this.healthHistory.push(health);
  }

  getRegionHealth(regionId: RegionId): RegionHealth | undefined {
    return [...this.healthHistory].reverse().find((h) => h.regionId === regionId);
  }

  shouldFailover(regionId: RegionId): { failover: boolean; targetRegion?: RegionId } {
    const health = this.getRegionHealth(regionId);
    if (!health) return { failover: false };

    if (health.uptime < 95 || health.errorRate > 5) {
      const region = this.regions.get(regionId);
      if (!region) return { failover: true };

      // Find nearest healthy region
      const candidates = [...this.regions.values()]
        .filter((r) => r.id !== regionId && r.status === "active")
        .sort((a, b) => (region.latency[a.id] ?? 999) - (region.latency[b.id] ?? 999));

      return { failover: true, targetRegion: candidates[0]?.id };
    }

    return { failover: false };
  }
}

export function createWhiteLabelEngine(): WhiteLabelEngine {
  return new WhiteLabelEngine();
}

export function createMultiRegionManager(): MultiRegionManager {
  return new MultiRegionManager();
}
