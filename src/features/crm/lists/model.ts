export interface CrmCustomList {
  id: string;
  workspaceId: string;
  displayName: string;
  description: string;
  recordCount: number;
  updatedAt: string;
  archivedAt: string | null;
  createdBy: string;
  updatedBy: string;
}

export interface CreateCrmCustomListInput {
  workspaceId: string;
  displayName: string;
  description: string;
  actorId: string;
}

export interface UpdateCrmCustomListInput {
  displayName?: string;
  description?: string;
  actorId: string;
}

export interface CrmCustomListRepository {
  list(workspaceId: string): Promise<CrmCustomList[]>;
  create(input: CreateCrmCustomListInput): Promise<CrmCustomList>;
  update(id: string, input: UpdateCrmCustomListInput): Promise<CrmCustomList>;
  archive(id: string, actorId: string): Promise<void>;
}
