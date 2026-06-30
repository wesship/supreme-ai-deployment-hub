/**
 * D3VONN Commercial Readiness — Partner Portal
 *
 * Partner management with tiers, revenue sharing,
 * co-branding, deal registration, and analytics.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type PartnerTier = "registered" | "silver" | "gold" | "platinum";
export type PartnerType = "reseller" | "technology" | "consulting" | "referral" | "oem";
export type DealStatus = "registered" | "approved" | "in_progress" | "won" | "lost" | "expired";

export interface Partner {
  id: string;
  name: string;
  type: PartnerType;
  tier: PartnerTier;
  contactEmail: string;
  contactName: string;
  company: string;
  website?: string;
  revenueShare: number; // percentage
  deals: Deal[];
  certifications: Certification[];
  joinedAt: string;
  status: "active" | "inactive" | "suspended";
  metadata: Record<string, unknown>;
}

export interface Deal {
  id: string;
  partnerId: string;
  customerName: string;
  customerEmail: string;
  estimatedValue: number;
  actualValue?: number;
  status: DealStatus;
  registeredAt: string;
  closedAt?: string;
  expiresAt: string;
  notes: string;
  commission?: number;
}

export interface Certification {
  id: string;
  name: string;
  level: "basic" | "advanced" | "expert";
  earnedAt: string;
  expiresAt: string;
  verified: boolean;
}

export interface PartnerAnalytics {
  partnerId: string;
  totalDeals: number;
  wonDeals: number;
  totalRevenue: number;
  totalCommission: number;
  conversionRate: number;
  avgDealSize: number;
  activeDealsPipeline: number;
}

// ─────────────────────────────────────────────────────────────────
// Partner Portal
// ─────────────────────────────────────────────────────────────────

export class PartnerPortal {
  private partners: Map<string, Partner> = new Map();

  // ─── Partner Management ─────────────────────────────────────

  registerPartner(partner: Omit<Partner, "id" | "deals" | "certifications" | "joinedAt">): Partner {
    const full: Partner = {
      ...partner,
      id: `partner_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      deals: [],
      certifications: [],
      joinedAt: new Date().toISOString(),
    };
    this.partners.set(full.id, full);
    return full;
  }

  getPartner(partnerId: string): Partner | undefined {
    return this.partners.get(partnerId);
  }

  listPartners(tier?: PartnerTier, type?: PartnerType): Partner[] {
    let partners = [...this.partners.values()];
    if (tier) partners = partners.filter((p) => p.tier === tier);
    if (type) partners = partners.filter((p) => p.type === type);
    return partners;
  }

  upgradeTier(partnerId: string, newTier: PartnerTier): boolean {
    const partner = this.partners.get(partnerId);
    if (!partner) return false;
    partner.tier = newTier;
    partner.revenueShare = this.getTierRevenueShare(newTier);
    return true;
  }

  private getTierRevenueShare(tier: PartnerTier): number {
    switch (tier) {
      case "platinum": return 30;
      case "gold": return 25;
      case "silver": return 20;
      case "registered": return 15;
    }
  }

  // ─── Deal Registration ──────────────────────────────────────

  registerDeal(partnerId: string, deal: Omit<Deal, "id" | "partnerId" | "registeredAt" | "status" | "expiresAt">): Deal | null {
    const partner = this.partners.get(partnerId);
    if (!partner) return null;

    const fullDeal: Deal = {
      ...deal,
      id: `deal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      partnerId,
      status: "registered",
      registeredAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(), // 90 days
    };

    partner.deals.push(fullDeal);
    return fullDeal;
  }

  updateDealStatus(partnerId: string, dealId: string, status: DealStatus, actualValue?: number): boolean {
    const partner = this.partners.get(partnerId);
    if (!partner) return false;

    const deal = partner.deals.find((d) => d.id === dealId);
    if (!deal) return false;

    deal.status = status;
    if (actualValue !== undefined) deal.actualValue = actualValue;
    if (status === "won" || status === "lost") {
      deal.closedAt = new Date().toISOString();
      if (status === "won") {
        deal.commission = (deal.actualValue ?? deal.estimatedValue) * (partner.revenueShare / 100);
      }
    }

    return true;
  }

  // ─── Certifications ─────────────────────────────────────────

  addCertification(partnerId: string, cert: Omit<Certification, "id">): boolean {
    const partner = this.partners.get(partnerId);
    if (!partner) return false;
    partner.certifications.push({ ...cert, id: `cert_${Date.now()}` });
    return true;
  }

  // ─── Analytics ──────────────────────────────────────────────

  getAnalytics(partnerId: string): PartnerAnalytics {
    const partner = this.partners.get(partnerId);
    if (!partner) return { partnerId, totalDeals: 0, wonDeals: 0, totalRevenue: 0, totalCommission: 0, conversionRate: 0, avgDealSize: 0, activeDealsPipeline: 0 };

    const wonDeals = partner.deals.filter((d) => d.status === "won");
    const totalRevenue = wonDeals.reduce((sum, d) => sum + (d.actualValue ?? d.estimatedValue), 0);
    const totalCommission = wonDeals.reduce((sum, d) => sum + (d.commission ?? 0), 0);
    const activeDeals = partner.deals.filter((d) => ["registered", "approved", "in_progress"].includes(d.status));

    return {
      partnerId,
      totalDeals: partner.deals.length,
      wonDeals: wonDeals.length,
      totalRevenue,
      totalCommission,
      conversionRate: partner.deals.length > 0 ? wonDeals.length / partner.deals.length : 0,
      avgDealSize: wonDeals.length > 0 ? totalRevenue / wonDeals.length : 0,
      activeDealsPipeline: activeDeals.reduce((sum, d) => sum + d.estimatedValue, 0),
    };
  }

  getProgramStats(): { totalPartners: number; byTier: Record<PartnerTier, number>; totalRevenue: number; totalCommissions: number } {
    const partners = [...this.partners.values()];
    const byTier: Record<string, number> = { registered: 0, silver: 0, gold: 0, platinum: 0 };
    let totalRevenue = 0;
    let totalCommissions = 0;

    for (const p of partners) {
      byTier[p.tier]++;
      for (const d of p.deals.filter((d) => d.status === "won")) {
        totalRevenue += d.actualValue ?? d.estimatedValue;
        totalCommissions += d.commission ?? 0;
      }
    }

    return { totalPartners: partners.length, byTier: byTier as Record<PartnerTier, number>, totalRevenue, totalCommissions };
  }
}

export function createPartnerPortal(): PartnerPortal {
  return new PartnerPortal();
}
