export type AssetEvidence = "observed" | "reconstructed" | "inferred" | "verified";
export type AssetStatus = "draft" | "queued" | "running" | "review" | "complete" | "failed";

export type AquaGovAsset = {
  asset_id: string;
  site_id: string;
  asset_type: "panorama" | "matrix3d" | "wan_video" | "colmap" | "gaussian_splat";
  status: AssetStatus;
  evidence: AssetEvidence;
  source_asset_id?: string;
  uri?: string;
  created_at: string;
  pipeline_version?: string;
  notes?: string;
};

export type GpuJob = {
  job_id: string;
  site_id: string;
  input_asset_id: string;
  pipeline: "matrix3d-wan-colmap-splat";
  status: AssetStatus;
  requested_at: string;
};

export const demoAssets: AquaGovAsset[] = [
  {
    asset_id: "demo-panorama-001",
    site_id: "SHO-001",
    asset_type: "panorama",
    status: "complete",
    evidence: "observed",
    uri: "demo://field/sho-001/panorama",
    created_at: "2026-08-01T10:00:00Z",
    notes: "Prototype placeholder; replace with verified field capture.",
  },
];

export function createGpuJob(siteId: string, inputAssetId: string): GpuJob {
  return {
    job_id: `job-${Date.now()}`,
    site_id: siteId,
    input_asset_id: inputAssetId,
    pipeline: "matrix3d-wan-colmap-splat",
    status: "queued",
    requested_at: new Date().toISOString(),
  };
}

export function assetTypeLabel(type: AquaGovAsset["asset_type"]): string {
  return {
    panorama: "Original panorama",
    matrix3d: "Matrix-3D reconstruction",
    wan_video: "Wan 2.1 reconstruction video",
    colmap: "COLMAP dataset",
    gaussian_splat: "Gaussian Splat",
  }[type];
}
