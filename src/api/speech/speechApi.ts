import { apiClient } from "../core/apiClient";

export interface SpeechChunk {
  start: number;
  end: number;
  text: string;
}

export interface SpeechGraphNode {
  id: string;
  label: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface SpeechGraphEdge {
  source: string;
  target: string;
  relationship: string;
  weight: number;
}

export interface SpeechTranscriptionResponse {
  status: string;
  job_id?: string | null;
  filename: string;
  model: string;
  transcript: string;
  chunks: SpeechChunk[];
  summary?: string | null;
  topics: string[];
  action_items: string[];
  knowledge_graph?: {
    nodes: SpeechGraphNode[];
    edges: SpeechGraphEdge[];
  } | null;
  raw?: Record<string, unknown>;
}

export interface SpeechHealthResponse {
  configured: boolean;
  service_url: string;
  status: string;
}

export interface TranscribeOptions {
  model?: string;
  language?: string;
  task?: "transcribe" | "translate";
  includeGraph?: boolean;
  saveToCrm?: boolean;
  crmContactId?: string;
}

export const speechApi = {
  health: async (): Promise<SpeechHealthResponse> => {
    const response = await apiClient.get("/api/speech/health");
    return response.data;
  },

  transcribe: async (
    file: File,
    options: TranscribeOptions = {},
    onUploadProgress?: (progress: number) => void,
  ): Promise<SpeechTranscriptionResponse> => {
    const form = new FormData();
    form.append("file", file);
    form.append("model", options.model ?? "openai/whisper-large-v3");
    form.append("task", options.task ?? "transcribe");
    form.append("include_graph", String(options.includeGraph ?? true));
    form.append("save_to_crm", String(options.saveToCrm ?? false));

    if (options.language) form.append("language", options.language);
    if (options.crmContactId) form.append("crm_contact_id", options.crmContactId);

    const response = await apiClient.post("/api/speech/transcribe", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 15 * 60 * 1000,
      onUploadProgress: (event) => {
        if (!onUploadProgress || !event.total) return;
        onUploadProgress(Math.round((event.loaded / event.total) * 100));
      },
    });

    return response.data;
  },
};
