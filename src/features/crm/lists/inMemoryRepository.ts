import type {
  CreateCrmCustomListInput,
  CrmCustomList,
  CrmCustomListRepository,
  UpdateCrmCustomListInput,
} from "./model";

const seedNames = [
  "Future Transactions",
  "Hot List",
  "Landing Page Leads",
  "Licensing Client Landing Page Leads",
  "Opportunity Landing Page Leads",
  "Managed Clients Not Logged In",
  "Pending Business",
  "Proactive Retention Pilot",
  "Social Media Lead Generation",
  "Uploads",
  "Wall of Wealth Landing Page Leads",
  "90 Day Challenge Call Script",
  "90 Day Challenge Omar Script",
];

const descriptions: Record<string, string> = {
  "Future Transactions": "Contacts with a planned future transaction.",
  "Hot List": "High-priority people requiring immediate follow-up.",
  "Landing Page Leads": "Leads submitted through public landing pages.",
  "Licensing Client Landing Page Leads": "Training and licensing-related client inquiries.",
  "Opportunity Landing Page Leads": "Business-opportunity interest submissions.",
  "Managed Clients Not Logged In": "Managed clients who have not activated portal access.",
  "Pending Business": "Open items awaiting underwriting, documents, or follow-up.",
  "Proactive Retention Pilot": "Clients included in the proactive service pilot.",
  "Social Media Lead Generation": "Leads attributed to approved social campaigns.",
  Uploads: "Contacts imported through approved file uploads.",
  "Wall of Wealth Landing Page Leads": "Leads from the Wall of Wealth campaign.",
  "90 Day Challenge Call Script": "Contacts assigned to the 90-day calling workflow.",
  "90 Day Challenge Omar Script": "Contacts assigned to the Omar script variation.",
};

export class InMemoryCrmCustomListRepository implements CrmCustomListRepository {
  private records: CrmCustomList[];

  constructor(workspaceId: string, actorId: string) {
    this.records = seedNames.map((displayName, index) => ({
      id: crypto.randomUUID(),
      workspaceId,
      displayName,
      description: descriptions[displayName] ?? "",
      recordCount: [18, 12, 47, 9, 21, 31, 16, 24, 53, 84, 11, 26, 19][index] ?? 0,
      updatedAt: new Date(Date.now() - index * 86_400_000).toISOString(),
      archivedAt: null,
      createdBy: actorId,
      updatedBy: actorId,
    }));
  }

  async list(workspaceId: string): Promise<CrmCustomList[]> {
    return this.records.filter((record) => record.workspaceId === workspaceId && !record.archivedAt);
  }

  async create(input: CreateCrmCustomListInput): Promise<CrmCustomList> {
    const record: CrmCustomList = {
      id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      displayName: input.displayName,
      description: input.description,
      recordCount: 0,
      updatedAt: new Date().toISOString(),
      archivedAt: null,
      createdBy: input.actorId,
      updatedBy: input.actorId,
    };
    this.records = [record, ...this.records];
    return record;
  }

  async update(id: string, input: UpdateCrmCustomListInput): Promise<CrmCustomList> {
    const current = this.records.find((record) => record.id === id && !record.archivedAt);
    if (!current) throw new Error("Custom list not found");
    const updated: CrmCustomList = {
      ...current,
      displayName: input.displayName ?? current.displayName,
      description: input.description ?? current.description,
      updatedAt: new Date().toISOString(),
      updatedBy: input.actorId,
    };
    this.records = this.records.map((record) => (record.id === id ? updated : record));
    return updated;
  }

  async archive(id: string, actorId: string): Promise<void> {
    const archivedAt = new Date().toISOString();
    this.records = this.records.map((record) =>
      record.id === id ? { ...record, archivedAt, updatedAt: archivedAt, updatedBy: actorId } : record,
    );
  }
}
