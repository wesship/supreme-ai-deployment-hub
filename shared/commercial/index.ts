/**
 * D3VONN Commercial Readiness
 *
 * Complete commercial infrastructure with subscription lifecycle,
 * license management, partner portal, white-label, and multi-region.
 */

export {
  SubscriptionManager,
  createSubscriptionManager,
  type Subscription,
  type SubscriptionStatus,
  type BillingInterval,
  type ChangeType,
  type SubscriptionChange,
  type SubscriptionDiscount,
  type ProrationResult,
  type SubscriptionEvent,
} from "./subscription-lifecycle";

export {
  LicenseManager,
  createLicenseManager,
  type LicenseKey,
  type LicenseType,
  type LicenseStatus,
  type LicenseEntitlement,
  type Activation,
  type LicenseValidation,
} from "./license-keys";

export {
  PartnerPortal,
  createPartnerPortal,
  type Partner,
  type PartnerTier,
  type PartnerType,
  type Deal,
  type DealStatus,
  type Certification,
  type PartnerAnalytics,
} from "./partner-portal";

export {
  WhiteLabelEngine,
  createWhiteLabelEngine,
  MultiRegionManager,
  createMultiRegionManager,
  type WhiteLabelConfig,
  type ThemeConfig,
  type LogoConfig,
  type EmailConfig,
  type FeatureVisibility,
  type LegalConfig,
  type Region,
  type RegionId,
  type RegionStatus,
  type TenantRegionConfig,
  type RegionHealth,
} from "./white-label";
