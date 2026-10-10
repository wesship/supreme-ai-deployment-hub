export type IngestionStage =
  | "upload"
  | "security_scan"
  | "file_classification"
  | "ocr"
  | "docling"
  | "markitdown"
  | "markdown_cleanup"
  | "metadata_extraction"
  | "knowledge_graph"
  | "semantic_chunking"
  | "embeddings"
  | "pinecone_storage"
  | "hermes_memory"
  | "dkos_retrieval";

export type IngestionStatus = "pending" | "running" | "completed" | "failed" | "manual_review";

export interface IngestionDocument {
  documentId: string;
  sourceFilename: string;
  sourceType: string;
  contentHash?: string;
  tenantId?: string;
  uploadedBy?: string;
  classification?: "public" | "internal" | "confidential" | "restricted";
}

export interface IngestionArtifact {
  kind:
    | "source_metadata"
    | "markdown"
    | "chunks"
    | "knowledge_graph"
    | "embedding_manifest"
    | "audit_log";
  path: string;
  contentType: string;
}

export interface IngestionRun {
  runId: string;
  document: IngestionDocument;
  status: IngestionStatus;
  currentStage: IngestionStage;
  stages: Array<{
    stage: IngestionStage;
    status: IngestionStatus;
    startedAt?: string;
    completedAt?: string;
    error?: string;
  }>;
  artifacts: IngestionArtifact[];
  createdAt: string;
  updatedAt: string;
}

export const DKOS_INGESTION_STAGES: IngestionStage[] = [
  "upload",
  "security_scan",
  "file_classification",
  "ocr",
  "docling",
  "markitdown",
  "markdown_cleanup",
  "metadata_extraction",
  "knowledge_graph",
  "semantic_chunking",
  "embeddings",
  "pinecone_storage",
  "hermes_memory",
  "dkos_retrieval",
];

export function createPendingIngestionRun(document: IngestionDocument): IngestionRun {
  const now = new Date().toISOString();

  return {
    runId: crypto.randomUUID(),
    document,
    status: "pending",
    currentStage: "upload",
    stages: DKOS_INGESTION_STAGES.map((stage) => ({
      stage,
      status: stage === "upload" ? "completed" : "pending",
      completedAt: stage === "upload" ? now : undefined,
    })),
    artifacts: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function getNextIngestionStage(stage: IngestionStage): IngestionStage | null {
  const index = DKOS_INGESTION_STAGES.indexOf(stage);
  if (index === -1 || index === DKOS_INGESTION_STAGES.length - 1) return null;
  return DKOS_INGESTION_STAGES[index + 1];
}
