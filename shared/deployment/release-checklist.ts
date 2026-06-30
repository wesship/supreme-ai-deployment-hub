/**
 * D3VONN Release Checklist
 *
 * Manages pre-deployment and post-deployment checklists with
 * automated verification and manual sign-off tracking.
 *
 * @module shared/deployment/release-checklist
 * @version 1.0.0
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type ChecklistPhase = "pre-deploy" | "deploy" | "post-deploy" | "verification";
export type ItemStatus = "pending" | "in-progress" | "completed" | "failed" | "skipped";
export type ItemType = "automated" | "manual" | "approval";

export interface ChecklistItem {
  id: string;
  phase: ChecklistPhase;
  name: string;
  description: string;
  type: ItemType;
  status: ItemStatus;
  required: boolean;
  assignee?: string;
  completedBy?: string;
  completedAt?: string;
  notes?: string;
  dependencies?: string[];
  verification?: () => Promise<boolean> | boolean;
}

export interface ReleaseChecklist {
  id: string;
  version: string;
  environment: string;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "active" | "completed" | "aborted";
  items: ChecklistItem[];
  summary: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    percentage: number;
  };
}

// ─────────────────────────────────────────────────────────────────
// Default Checklist Items
// ─────────────────────────────────────────────────────────────────

export const DEFAULT_CHECKLIST_ITEMS: Omit<ChecklistItem, "status">[] = [
  // Pre-deploy
  {
    id: "pre-01",
    phase: "pre-deploy",
    name: "All tests passing",
    description: "Unit tests, integration tests, and smoke tests all pass",
    type: "automated",
    required: true,
  },
  {
    id: "pre-02",
    phase: "pre-deploy",
    name: "Build succeeds",
    description: "Production build completes without errors or warnings",
    type: "automated",
    required: true,
  },
  {
    id: "pre-03",
    phase: "pre-deploy",
    name: "TypeScript type check passes",
    description: "tsc --noEmit reports zero errors",
    type: "automated",
    required: true,
  },
  {
    id: "pre-04",
    phase: "pre-deploy",
    name: "Secrets audit clean",
    description: "No secrets detected in source code",
    type: "automated",
    required: true,
  },
  {
    id: "pre-05",
    phase: "pre-deploy",
    name: "Environment variables validated",
    description: "All required env vars present for target environment",
    type: "automated",
    required: true,
  },
  {
    id: "pre-06",
    phase: "pre-deploy",
    name: "Database migrations reviewed",
    description: "New migrations are backward-compatible and reviewed",
    type: "manual",
    required: true,
  },
  {
    id: "pre-07",
    phase: "pre-deploy",
    name: "Rollback plan prepared",
    description: "Rollback plan is created and approved",
    type: "manual",
    required: true,
  },
  {
    id: "pre-08",
    phase: "pre-deploy",
    name: "Change log updated",
    description: "CHANGELOG.md reflects all changes in this release",
    type: "manual",
    required: false,
  },
  {
    id: "pre-09",
    phase: "pre-deploy",
    name: "Readiness score >= 90",
    description: "Production readiness scorecard passes the gate threshold",
    type: "automated",
    required: true,
  },
  {
    id: "pre-10",
    phase: "pre-deploy",
    name: "Team notified",
    description: "Engineering team notified of upcoming deployment",
    type: "manual",
    required: true,
  },

  // Deploy
  {
    id: "dep-01",
    phase: "deploy",
    name: "Deploy to staging",
    description: "Deploy current build to staging environment",
    type: "automated",
    required: true,
    dependencies: ["pre-01", "pre-02", "pre-03"],
  },
  {
    id: "dep-02",
    phase: "deploy",
    name: "Staging smoke tests pass",
    description: "Run smoke tests against staging deployment",
    type: "automated",
    required: true,
    dependencies: ["dep-01"],
  },
  {
    id: "dep-03",
    phase: "deploy",
    name: "Staging sign-off",
    description: "QA or team lead signs off on staging deployment",
    type: "approval",
    required: true,
    dependencies: ["dep-02"],
  },
  {
    id: "dep-04",
    phase: "deploy",
    name: "Deploy to production",
    description: "Deploy current build to production environment",
    type: "automated",
    required: true,
    dependencies: ["dep-03"],
  },
  {
    id: "dep-05",
    phase: "deploy",
    name: "Run database migrations",
    description: "Apply pending database migrations to production",
    type: "automated",
    required: true,
    dependencies: ["dep-04"],
  },

  // Post-deploy
  {
    id: "post-01",
    phase: "post-deploy",
    name: "Health checks passing",
    description: "All production health checks report healthy",
    type: "automated",
    required: true,
    dependencies: ["dep-04"],
  },
  {
    id: "post-02",
    phase: "post-deploy",
    name: "Sentry release created",
    description: "Sentry release is created with source maps",
    type: "automated",
    required: true,
  },
  {
    id: "post-03",
    phase: "post-deploy",
    name: "Monitor error rates (15 min)",
    description: "Monitor error rates for 15 minutes post-deploy",
    type: "automated",
    required: true,
    dependencies: ["post-01"],
  },
  {
    id: "post-04",
    phase: "post-deploy",
    name: "Event bus healthy",
    description: "Event bus is processing events without DLQ growth",
    type: "automated",
    required: true,
  },
  {
    id: "post-05",
    phase: "post-deploy",
    name: "Agent mesh responding",
    description: "All agents in the mesh are responding to health checks",
    type: "automated",
    required: true,
  },

  // Verification
  {
    id: "ver-01",
    phase: "verification",
    name: "Production smoke tests pass",
    description: "Run full smoke test suite against production",
    type: "automated",
    required: true,
    dependencies: ["post-01"],
  },
  {
    id: "ver-02",
    phase: "verification",
    name: "Tenant isolation verified",
    description: "Verify tenant isolation is working in production",
    type: "automated",
    required: true,
  },
  {
    id: "ver-03",
    phase: "verification",
    name: "RBAC enforcement verified",
    description: "Verify RBAC policies are enforced correctly",
    type: "automated",
    required: true,
  },
  {
    id: "ver-04",
    phase: "verification",
    name: "Performance baseline met",
    description: "Key performance metrics are within acceptable ranges",
    type: "automated",
    required: false,
  },
  {
    id: "ver-05",
    phase: "verification",
    name: "Deployment sign-off",
    description: "Final sign-off that deployment is successful",
    type: "approval",
    required: true,
  },
];

// ─────────────────────────────────────────────────────────────────
// Checklist Manager
// ─────────────────────────────────────────────────────────────────

export class ReleaseChecklistManager {
  private checklists: ReleaseChecklist[] = [];

  createChecklist(version: string, environment: string): ReleaseChecklist {
    const items: ChecklistItem[] = DEFAULT_CHECKLIST_ITEMS.map((item) => ({
      ...item,
      status: "pending" as ItemStatus,
    }));

    const checklist: ReleaseChecklist = {
      id: `release-${version}-${Date.now()}`,
      version,
      environment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "active",
      items,
      summary: this.calculateSummary(items),
    };

    this.checklists.push(checklist);
    return checklist;
  }

  completeItem(checklistId: string, itemId: string, completedBy: string, notes?: string): boolean {
    const checklist = this.checklists.find((c) => c.id === checklistId);
    if (!checklist) return false;

    const item = checklist.items.find((i) => i.id === itemId);
    if (!item) return false;

    // Check dependencies
    if (item.dependencies) {
      const unmetDeps = item.dependencies.filter((depId) => {
        const dep = checklist.items.find((i) => i.id === depId);
        return dep && dep.status !== "completed";
      });
      if (unmetDeps.length > 0) return false;
    }

    item.status = "completed";
    item.completedBy = completedBy;
    item.completedAt = new Date().toISOString();
    if (notes) item.notes = notes;

    checklist.updatedAt = new Date().toISOString();
    checklist.summary = this.calculateSummary(checklist.items);

    // Check if all required items are completed
    const allRequiredDone = checklist.items
      .filter((i) => i.required)
      .every((i) => i.status === "completed");
    if (allRequiredDone) {
      checklist.status = "completed";
    }

    return true;
  }

  failItem(checklistId: string, itemId: string, notes: string): boolean {
    const checklist = this.checklists.find((c) => c.id === checklistId);
    if (!checklist) return false;

    const item = checklist.items.find((i) => i.id === itemId);
    if (!item) return false;

    item.status = "failed";
    item.notes = notes;
    checklist.updatedAt = new Date().toISOString();
    checklist.summary = this.calculateSummary(checklist.items);

    return true;
  }

  skipItem(checklistId: string, itemId: string, reason: string): boolean {
    const checklist = this.checklists.find((c) => c.id === checklistId);
    if (!checklist) return false;

    const item = checklist.items.find((i) => i.id === itemId);
    if (!item || item.required) return false;

    item.status = "skipped";
    item.notes = reason;
    checklist.updatedAt = new Date().toISOString();
    checklist.summary = this.calculateSummary(checklist.items);

    return true;
  }

  abortChecklist(checklistId: string, reason: string): boolean {
    const checklist = this.checklists.find((c) => c.id === checklistId);
    if (!checklist) return false;

    checklist.status = "aborted";
    checklist.updatedAt = new Date().toISOString();
    return true;
  }

  getChecklist(checklistId: string): ReleaseChecklist | undefined {
    return this.checklists.find((c) => c.id === checklistId);
  }

  getChecklists(): ReleaseChecklist[] {
    return [...this.checklists];
  }

  getItemsByPhase(checklistId: string, phase: ChecklistPhase): ChecklistItem[] {
    const checklist = this.checklists.find((c) => c.id === checklistId);
    if (!checklist) return [];
    return checklist.items.filter((i) => i.phase === phase);
  }

  getBlockers(checklistId: string): ChecklistItem[] {
    const checklist = this.checklists.find((c) => c.id === checklistId);
    if (!checklist) return [];
    return checklist.items.filter(
      (i) => i.required && (i.status === "failed" || i.status === "pending")
    );
  }

  private calculateSummary(items: ChecklistItem[]): ReleaseChecklist["summary"] {
    const total = items.length;
    const completed = items.filter((i) => i.status === "completed" || i.status === "skipped").length;
    const failed = items.filter((i) => i.status === "failed").length;
    const pending = items.filter((i) => i.status === "pending" || i.status === "in-progress").length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, failed, pending, percentage };
  }
}

// ─────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────

export function createReleaseChecklistManager(): ReleaseChecklistManager {
  return new ReleaseChecklistManager();
}
