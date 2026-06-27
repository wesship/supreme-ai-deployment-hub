export type MarketingChannel =
  | "x-twitter"
  | "linkedin"
  | "tiktok"
  | "threads"
  | "youtube-shorts"
  | "instagram"
  | "email"
  | "github";

export type MarketingContentStatus =
  | "IDEA"
  | "DRAFT"
  | "BRAND_REVIEW"
  | "CLAIM_CHECK"
  | "APPROVED"
  | "QUEUED"
  | "LIVE"
  | "MEASURED"
  | "REPURPOSED";

export type MarketingReviewDecision = "APPROVE" | "REVISE" | "BLOCK";

export interface MarketingCampaign {
  id: string;
  name: string;
  status: MarketingContentStatus;
  primaryCta: string;
  primaryMessage: string;
  channels: MarketingChannel[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingAsset {
  id: string;
  campaignId?: string;
  channel: MarketingChannel;
  label: string;
  subject?: string;
  body: string;
  status: MarketingContentStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface MarketingReviewResult {
  decision: MarketingReviewDecision;
  score?: number;
  issues: string[];
  suggestedRevision?: string;
  requiredSources?: string[];
}

export interface MarketingGenerateRequest {
  campaignName: string;
  audience: string;
  channel: MarketingChannel;
  cta: string;
  productUpdate: string;
  constraints?: string[];
}

export interface MarketingGenerateResponse {
  asset: MarketingAsset;
  brandReview?: MarketingReviewResult;
  claimReview?: MarketingReviewResult;
}
