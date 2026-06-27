import type {
  MarketingAsset,
  MarketingGenerateRequest,
  MarketingGenerateResponse,
  MarketingReviewResult,
} from "../../types/marketing";

type ApiGenerateRequest = {
  campaign_name: string;
  audience: string;
  channel: MarketingGenerateRequest["channel"];
  cta: string;
  product_update: string;
  constraints?: string[];
};

type ApiAssetInput = {
  body: string;
  channel: MarketingAsset["channel"];
};

function toGeneratePayload(payload: MarketingGenerateRequest): ApiGenerateRequest {
  return {
    campaign_name: payload.campaignName,
    audience: payload.audience,
    channel: payload.channel,
    cta: payload.cta,
    product_update: payload.productUpdate,
    constraints: payload.constraints,
  };
}

async function postJson<TResponse, TPayload>(path: string, payload: TPayload): Promise<TResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "Unknown marketing API error");
    throw new Error(message || `Marketing API request failed: ${response.status}`);
  }

  return response.json() as Promise<TResponse>;
}

export const marketingApi = {
  generate(payload: MarketingGenerateRequest) {
    return postJson<MarketingGenerateResponse, ApiGenerateRequest>(
      "/api/marketing/generate",
      toGeneratePayload(payload)
    );
  },

  rewrite(asset: Pick<MarketingAsset, "body" | "channel">) {
    return postJson<MarketingGenerateResponse, ApiAssetInput>("/api/marketing/rewrite", asset);
  },

  brandCheck(asset: Pick<MarketingAsset, "body" | "channel">) {
    return postJson<MarketingReviewResult, ApiAssetInput>("/api/marketing/brand-check", asset);
  },

  claimCheck(asset: Pick<MarketingAsset, "body" | "channel">) {
    return postJson<MarketingReviewResult, ApiAssetInput>("/api/marketing/claim-check", asset);
  },

  approve(assetId: string) {
    return postJson<{ ok: true; assetId: string }, { asset_id: string }>("/api/marketing/approve", {
      asset_id: assetId,
    });
  },

  prepare(asset: Pick<MarketingAsset, "body" | "channel">) {
    return postJson<{ ok: true; channel: string; prepared: string; requires_human_approval: boolean }, ApiAssetInput>(
      "/api/marketing/prepare",
      asset
    );
  },

  analyze(campaignId: string) {
    return postJson<{ ok: true; campaign_id: string; summary: string }, { campaign_id: string }>(
      "/api/marketing/analyze",
      { campaign_id: campaignId }
    );
  },
};
