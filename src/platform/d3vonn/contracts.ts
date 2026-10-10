export type WorkspaceRole = "owner" | "admin" | "operator" | "viewer";

export type DomainEvent<TPayload = unknown> = {
  id: string;
  workspaceId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  eventVersion: number;
  occurredAt: string;
  payload: TPayload;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
};

export type AgentManifest = {
  key: string;
  name: string;
  version: string;
  role: string;
  permissions: string[];
  modelPolicy: Record<string, unknown>;
  memoryPolicy: Record<string, unknown>;
  toolPolicy: Record<string, unknown>;
  evaluationPolicy: Record<string, unknown>;
};

export type MarketplaceManifest = {
  schemaVersion: "1";
  type: "agent" | "workflow" | "module" | "connector" | "template";
  name: string;
  version: string;
  permissions: string[];
  requiredCapabilities: string[];
};
