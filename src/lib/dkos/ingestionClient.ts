import type { IngestionArtifact, IngestionRun } from "./ingestionPipeline";

const API_BASE =
  import.meta.env.VITE_DKOS_INGESTION_API_URL ||
  import.meta.env.VITE_D3VONN_API_URL ||
  import.meta.env.VITE_DEVONN_API_URL ||
  import.meta.env.VITE_API_URL ||
  "https://devonn-ai-api.up.railway.app";

export type StartIngestionInput = {
  file: File;
  tenantId: string;
  uploadedBy: string;
  classification?: "public" | "internal" | "confidential" | "restricted";
  agentAccess?: string[];
};

export type StartIngestionResponse = {
  run_id: string;
  document_id: string;
  status: IngestionRun["status"];
  current_stage: IngestionRun["currentStage"];
};

export type IngestionArtifactsResponse = {
  run_id: string;
  artifacts: IngestionArtifact[];
};

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text().catch(() => "Request failed");
    throw new Error(message || `Request failed with HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export async function startDkosIngestion(input: StartIngestionInput): Promise<StartIngestionResponse> {
  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("tenant_id", input.tenantId);
  formData.append("uploaded_by", input.uploadedBy);
  if (input.classification) formData.append("classification", input.classification);
  if (input.agentAccess?.length) formData.append("agent_access", input.agentAccess.join(","));

  const response = await fetch(`${API_BASE}/api/dkos/ingestion/runs`, {
    method: "POST",
    body: formData,
  });

  return parseJson<StartIngestionResponse>(response);
}

export async function getDkosIngestionRun(runId: string): Promise<IngestionRun> {
  const response = await fetch(`${API_BASE}/api/dkos/ingestion/runs/${runId}`);
  return parseJson<IngestionRun>(response);
}

export async function getDkosIngestionArtifacts(runId: string): Promise<IngestionArtifactsResponse> {
  const response = await fetch(`${API_BASE}/api/dkos/ingestion/runs/${runId}/artifacts`);
  return parseJson<IngestionArtifactsResponse>(response);
}
