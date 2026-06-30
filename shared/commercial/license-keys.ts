/**
 * D3VONN Commercial Readiness — License Keys
 *
 * License key generation, validation, activation,
 * feature entitlements, and usage enforcement.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type LicenseType = "trial" | "standard" | "professional" | "enterprise" | "oem";
export type LicenseStatus = "active" | "expired" | "revoked" | "suspended";

export interface LicenseKey {
  id: string;
  key: string;
  tenantId: string;
  type: LicenseType;
  status: LicenseStatus;
  entitlements: LicenseEntitlement[];
  maxActivations: number;
  currentActivations: number;
  activations: Activation[];
  issuedAt: string;
  expiresAt: string;
  metadata: Record<string, unknown>;
}

export interface LicenseEntitlement {
  feature: string;
  enabled: boolean;
  limit?: number;
  currentUsage?: number;
}

export interface Activation {
  id: string;
  licenseId: string;
  machineId: string;
  machineName: string;
  ipAddress: string;
  activatedAt: string;
  lastSeenAt: string;
  deactivatedAt?: string;
}

export interface LicenseValidation {
  valid: boolean;
  license?: LicenseKey;
  errors: string[];
  entitlements: LicenseEntitlement[];
}

// ─────────────────────────────────────────────────────────────────
// License Manager
// ─────────────────────────────────────────────────────────────────

export class LicenseManager {
  private licenses: Map<string, LicenseKey> = new Map();
  private keyIndex: Map<string, string> = new Map(); // key -> id

  // ─── Key Generation ─────────────────────────────────────────

  generate(tenantId: string, type: LicenseType, options: { maxActivations?: number; durationDays?: number; entitlements?: LicenseEntitlement[] }): LicenseKey {
    const id = `lic_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const key = this.generateKey(type);
    const now = new Date();
    const durationDays = options.durationDays ?? (type === "trial" ? 14 : 365);
    const expiresAt = new Date(now.getTime() + durationDays * 86400000);

    const license: LicenseKey = {
      id,
      key,
      tenantId,
      type,
      status: "active",
      entitlements: options.entitlements ?? this.getDefaultEntitlements(type),
      maxActivations: options.maxActivations ?? (type === "enterprise" ? 100 : type === "professional" ? 10 : 3),
      currentActivations: 0,
      activations: [],
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      metadata: {},
    };

    this.licenses.set(id, license);
    this.keyIndex.set(key, id);
    return license;
  }

  private generateKey(type: LicenseType): string {
    const prefix = type === "enterprise" ? "D3V-ENT" : type === "professional" ? "D3V-PRO" : type === "trial" ? "D3V-TRL" : "D3V-STD";
    const segments = Array.from({ length: 4 }, () =>
      Math.random().toString(36).slice(2, 6).toUpperCase()
    );
    return `${prefix}-${segments.join("-")}`;
  }

  private getDefaultEntitlements(type: LicenseType): LicenseEntitlement[] {
    const base: LicenseEntitlement[] = [
      { feature: "agents", enabled: true, limit: type === "enterprise" ? -1 : type === "professional" ? 50 : 5 },
      { feature: "workflows", enabled: true, limit: type === "enterprise" ? -1 : type === "professional" ? 100 : 10 },
      { feature: "api_calls", enabled: true, limit: type === "enterprise" ? -1 : type === "professional" ? 1000000 : 10000 },
      { feature: "custom_plugins", enabled: type !== "trial", limit: type === "enterprise" ? -1 : 20 },
      { feature: "sso", enabled: type === "enterprise" || type === "professional" },
      { feature: "audit_logs", enabled: type === "enterprise" || type === "professional" },
      { feature: "white_label", enabled: type === "enterprise" },
      { feature: "multi_region", enabled: type === "enterprise" },
      { feature: "priority_support", enabled: type === "enterprise" || type === "professional" },
      { feature: "sla_guarantee", enabled: type === "enterprise" },
    ];
    return base;
  }

  // ─── Validation ─────────────────────────────────────────────

  validate(key: string): LicenseValidation {
    const id = this.keyIndex.get(key);
    if (!id) return { valid: false, errors: ["Invalid license key"], entitlements: [] };

    const license = this.licenses.get(id);
    if (!license) return { valid: false, errors: ["License not found"], entitlements: [] };

    const errors: string[] = [];
    if (license.status === "revoked") errors.push("License has been revoked");
    if (license.status === "suspended") errors.push("License is suspended");
    if (new Date(license.expiresAt) < new Date()) errors.push("License has expired");

    return {
      valid: errors.length === 0,
      license,
      errors,
      entitlements: license.entitlements,
    };
  }

  // ─── Activation ─────────────────────────────────────────────

  activate(key: string, machineId: string, machineName: string, ipAddress: string): { success: boolean; activation?: Activation; error?: string } {
    const validation = this.validate(key);
    if (!validation.valid || !validation.license) {
      return { success: false, error: validation.errors.join(", ") };
    }

    const license = validation.license;
    if (license.currentActivations >= license.maxActivations) {
      return { success: false, error: `Maximum activations (${license.maxActivations}) reached` };
    }

    // Check if already activated on this machine
    const existing = license.activations.find((a) => a.machineId === machineId && !a.deactivatedAt);
    if (existing) {
      existing.lastSeenAt = new Date().toISOString();
      return { success: true, activation: existing };
    }

    const activation: Activation = {
      id: `act_${Date.now()}`,
      licenseId: license.id,
      machineId,
      machineName,
      ipAddress,
      activatedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
    };

    license.activations.push(activation);
    license.currentActivations++;
    return { success: true, activation };
  }

  deactivate(key: string, machineId: string): boolean {
    const id = this.keyIndex.get(key);
    if (!id) return false;

    const license = this.licenses.get(id);
    if (!license) return false;

    const activation = license.activations.find((a) => a.machineId === machineId && !a.deactivatedAt);
    if (!activation) return false;

    activation.deactivatedAt = new Date().toISOString();
    license.currentActivations--;
    return true;
  }

  // ─── Management ─────────────────────────────────────────────

  revoke(licenseId: string): boolean {
    const license = this.licenses.get(licenseId);
    if (!license) return false;
    license.status = "revoked";
    return true;
  }

  suspend(licenseId: string): boolean {
    const license = this.licenses.get(licenseId);
    if (!license) return false;
    license.status = "suspended";
    return true;
  }

  extend(licenseId: string, additionalDays: number): boolean {
    const license = this.licenses.get(licenseId);
    if (!license) return false;
    const current = new Date(license.expiresAt);
    current.setDate(current.getDate() + additionalDays);
    license.expiresAt = current.toISOString();
    return true;
  }

  checkEntitlement(key: string, feature: string): { allowed: boolean; limit?: number; usage?: number } {
    const validation = this.validate(key);
    if (!validation.valid) return { allowed: false };

    const entitlement = validation.entitlements.find((e) => e.feature === feature);
    if (!entitlement || !entitlement.enabled) return { allowed: false };

    if (entitlement.limit && entitlement.limit !== -1 && entitlement.currentUsage && entitlement.currentUsage >= entitlement.limit) {
      return { allowed: false, limit: entitlement.limit, usage: entitlement.currentUsage };
    }

    return { allowed: true, limit: entitlement.limit ?? undefined, usage: entitlement.currentUsage };
  }

  listLicenses(tenantId?: string): LicenseKey[] {
    let licenses = [...this.licenses.values()];
    if (tenantId) licenses = licenses.filter((l) => l.tenantId === tenantId);
    return licenses;
  }
}

export function createLicenseManager(): LicenseManager {
  return new LicenseManager();
}
