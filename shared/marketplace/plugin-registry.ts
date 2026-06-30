/**
 * D3VONN AI Marketplace — Plugin Registry
 *
 * Central registry for discovering, installing, updating,
 * and managing AI plugins and extensions.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type PluginStatus = "available" | "installed" | "active" | "disabled" | "deprecated" | "blocked";
export type PluginCategory = "agent" | "tool" | "integration" | "workflow" | "model" | "ui" | "security" | "analytics";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  category: PluginCategory;
  tags: string[];
  homepage?: string;
  repository?: string;
  license: string;
  minPlatformVersion: string;
  maxPlatformVersion?: string;
  dependencies: PluginDependency[];
  permissions: PluginPermission[];
  entrypoint: string;
  config?: Record<string, PluginConfigField>;
  pricing: PluginPricing;
}

export interface PluginDependency {
  pluginId: string;
  versionRange: string;
  optional: boolean;
}

export interface PluginPermission {
  resource: string;
  actions: string[];
  reason: string;
}

export interface PluginConfigField {
  type: "string" | "number" | "boolean" | "select";
  label: string;
  description: string;
  required: boolean;
  default?: unknown;
  options?: string[];
}

export interface PluginPricing {
  model: "free" | "one-time" | "subscription" | "usage-based";
  price?: number;
  currency?: string;
  interval?: "monthly" | "yearly";
}

export interface InstalledPlugin {
  manifest: PluginManifest;
  status: PluginStatus;
  installedAt: string;
  updatedAt: string;
  installedBy: string;
  config: Record<string, unknown>;
  tenantId: string;
}

export interface PluginSearchResult {
  plugins: PluginManifest[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PluginReview {
  pluginId: string;
  userId: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────
// Plugin Registry
// ─────────────────────────────────────────────────────────────────

export class PluginRegistry {
  private catalog: Map<string, PluginManifest> = new Map();
  private installed: Map<string, InstalledPlugin> = new Map();
  private reviews: PluginReview[] = [];

  // ─── Catalog Management ─────────────────────────────────────

  publish(manifest: PluginManifest): { success: boolean; error?: string } {
    if (this.catalog.has(manifest.id)) {
      const existing = this.catalog.get(manifest.id)!;
      if (!this.isNewerVersion(manifest.version, existing.version)) {
        return { success: false, error: "Version must be newer than existing" };
      }
    }
    this.catalog.set(manifest.id, manifest);
    return { success: true };
  }

  unpublish(pluginId: string): boolean {
    return this.catalog.delete(pluginId);
  }

  getPlugin(pluginId: string): PluginManifest | undefined {
    return this.catalog.get(pluginId);
  }

  search(query: string, category?: PluginCategory, page = 1, pageSize = 20): PluginSearchResult {
    let results = [...this.catalog.values()];

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (category) {
      results = results.filter((p) => p.category === category);
    }

    const start = (page - 1) * pageSize;
    return {
      plugins: results.slice(start, start + pageSize),
      total: results.length,
      page,
      pageSize,
    };
  }

  getByCategory(category: PluginCategory): PluginManifest[] {
    return [...this.catalog.values()].filter((p) => p.category === category);
  }

  // ─── Installation Management ────────────────────────────────

  install(pluginId: string, tenantId: string, installedBy: string, config: Record<string, unknown> = {}): { success: boolean; error?: string } {
    const manifest = this.catalog.get(pluginId);
    if (!manifest) return { success: false, error: "Plugin not found" };

    const key = `${tenantId}:${pluginId}`;
    if (this.installed.has(key)) return { success: false, error: "Already installed" };

    // Check dependencies
    for (const dep of manifest.dependencies) {
      if (!dep.optional) {
        const depKey = `${tenantId}:${dep.pluginId}`;
        if (!this.installed.has(depKey)) {
          return { success: false, error: `Missing dependency: ${dep.pluginId}` };
        }
      }
    }

    this.installed.set(key, {
      manifest,
      status: "active",
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      installedBy,
      config,
      tenantId,
    });

    return { success: true };
  }

  uninstall(pluginId: string, tenantId: string): boolean {
    const key = `${tenantId}:${pluginId}`;
    return this.installed.delete(key);
  }

  update(pluginId: string, tenantId: string): { success: boolean; error?: string } {
    const key = `${tenantId}:${pluginId}`;
    const existing = this.installed.get(key);
    if (!existing) return { success: false, error: "Not installed" };

    const latest = this.catalog.get(pluginId);
    if (!latest) return { success: false, error: "Plugin no longer available" };

    if (latest.version === existing.manifest.version) {
      return { success: false, error: "Already on latest version" };
    }

    existing.manifest = latest;
    existing.updatedAt = new Date().toISOString();
    return { success: true };
  }

  enable(pluginId: string, tenantId: string): boolean {
    const key = `${tenantId}:${pluginId}`;
    const plugin = this.installed.get(key);
    if (!plugin) return false;
    plugin.status = "active";
    return true;
  }

  disable(pluginId: string, tenantId: string): boolean {
    const key = `${tenantId}:${pluginId}`;
    const plugin = this.installed.get(key);
    if (!plugin) return false;
    plugin.status = "disabled";
    return true;
  }

  getInstalled(tenantId: string): InstalledPlugin[] {
    return [...this.installed.values()].filter((p) => p.tenantId === tenantId);
  }

  getInstalledPlugin(pluginId: string, tenantId: string): InstalledPlugin | undefined {
    return this.installed.get(`${tenantId}:${pluginId}`);
  }

  // ─── Reviews ────────────────────────────────────────────────

  addReview(review: PluginReview): void {
    this.reviews.push(review);
  }

  getReviews(pluginId: string): PluginReview[] {
    return this.reviews.filter((r) => r.pluginId === pluginId);
  }

  getAverageRating(pluginId: string): number {
    const reviews = this.getReviews(pluginId);
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  }

  // ─── Stats ──────────────────────────────────────────────────

  getStats(): { totalPlugins: number; totalInstalled: number; byCategory: Record<string, number>; avgRating: number } {
    const byCategory: Record<string, number> = {};
    for (const plugin of this.catalog.values()) {
      byCategory[plugin.category] = (byCategory[plugin.category] || 0) + 1;
    }

    let totalRating = 0;
    let ratingCount = 0;
    for (const pluginId of this.catalog.keys()) {
      const avg = this.getAverageRating(pluginId);
      if (avg > 0) {
        totalRating += avg;
        ratingCount++;
      }
    }

    return {
      totalPlugins: this.catalog.size,
      totalInstalled: this.installed.size,
      byCategory,
      avgRating: ratingCount > 0 ? totalRating / ratingCount : 0,
    };
  }

  private isNewerVersion(a: string, b: string): boolean {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((partsA[i] || 0) > (partsB[i] || 0)) return true;
      if ((partsA[i] || 0) < (partsB[i] || 0)) return false;
    }
    return false;
  }
}

export function createPluginRegistry(): PluginRegistry {
  return new PluginRegistry();
}
