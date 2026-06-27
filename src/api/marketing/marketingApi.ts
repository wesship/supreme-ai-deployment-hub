import type {
  MarketingAsset,
  MarketingGenerateRequest,
  MarketingGenerateResponse,
  MarketingReviewResult,
} from "../../types/marketing";

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
    return postJson<MarketingGenerateResponse, MarketingGenerateRequest>("/api/marketing/generate", payload);
  },

  rewrite(asset: Pick<MarketingAsset, "body" | "channel">) {
    return postJson<MarketingGenerateResponse, typeof asset>("/api/marketing/rewrite", asset);
  },

  brandCheck(asset: Pick<MarketingAsset, "body" | "channel">) {
    return postJson<MarketingReviewResult, typeof asset>("/api/marketing/brand-check", asset);
  },

  claimCheck(asset: Pick<MarketingAsset, "body" | "channel">) {
    return postJson<MarketingReviewResult, typeof asset>("/api/marketing/claim-check", asset);
  },

  approve(assetId: string) {
    return postJson<{ ok: true; assetId: string }, { assetId: string }>("/api/marketing/approve", { assetId });
  },

  analyze(campaignId: string) {
    return postJson<{ ok: true; campaignId: string; summary: string }, { campaignId: string }>(
      "/api/marketing/analyze",
      { campaignId }
    );
  },
};
