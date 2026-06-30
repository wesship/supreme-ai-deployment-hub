/**
 * D3VONN Autonomous Operations — Goal Engine
 *
 * Long-running goal management with recursive decomposition,
 * self-healing, cost-aware routing, and progress tracking.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type GoalStatus = "pending" | "active" | "decomposing" | "executing" | "blocked" | "completed" | "failed" | "cancelled";
export type GoalPriority = "critical" | "high" | "medium" | "low";
export type SubtaskStrategy = "sequential" | "parallel" | "adaptive";

export interface Goal {
  id: string;
  tenantId: string;
  title: string;
  description: string;
  priority: GoalPriority;
  status: GoalStatus;
  parentGoalId?: string;
  subtasks: Subtask[];
  constraints: GoalConstraints;
  progress: GoalProgress;
  routing: RoutingDecision;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  metadata: Record<string, unknown>;
}

export interface Subtask {
  id: string;
  goalId: string;
  title: string;
  description: string;
  status: GoalStatus;
  assignedAgent?: string;
  dependencies: string[];
  estimatedCost: number;
  actualCost: number;
  estimatedDuration: number; // ms
  actualDuration: number;
  retries: number;
  maxRetries: number;
  output?: unknown;
  error?: string;
}

export interface GoalConstraints {
  maxBudget: number;
  maxDuration: number; // ms
  maxRetries: number;
  allowedAgents: string[];
  requiredCapabilities: string[];
  qualityThreshold: number; // 0-1
}

export interface GoalProgress {
  completedSubtasks: number;
  totalSubtasks: number;
  percentComplete: number;
  totalCost: number;
  totalDuration: number;
  healthScore: number; // 0-1
}

export interface RoutingDecision {
  strategy: SubtaskStrategy;
  selectedAgents: AgentAssignment[];
  costEstimate: number;
  confidenceScore: number;
  reasoning: string;
}

export interface AgentAssignment {
  agentId: string;
  subtaskId: string;
  costPerUnit: number;
  capabilities: string[];
  estimatedDuration: number;
}

export interface SelfHealingAction {
  type: "retry" | "reassign" | "decompose_further" | "escalate" | "skip" | "rollback";
  subtaskId: string;
  reason: string;
  newAgent?: string;
  timestamp: string;
}

export interface CostModel {
  agentId: string;
  costPerInvocation: number;
  costPerToken: number;
  costPerMinute: number;
  capabilities: string[];
  reliability: number; // 0-1
  avgLatency: number; // ms
}

// ─────────────────────────────────────────────────────────────────
// Goal Engine
// ─────────────────────────────────────────────────────────────────

export class GoalEngine {
  private goals: Map<string, Goal> = new Map();
  private costModels: Map<string, CostModel> = new Map();
  private healingLog: SelfHealingAction[] = [];

  // ─── Goal Management ────────────────────────────────────────

  createGoal(goal: Omit<Goal, "subtasks" | "progress" | "routing" | "createdAt" | "updatedAt">): Goal {
    const fullGoal: Goal = {
      ...goal,
      subtasks: [],
      progress: { completedSubtasks: 0, totalSubtasks: 0, percentComplete: 0, totalCost: 0, totalDuration: 0, healthScore: 1 },
      routing: { strategy: "adaptive", selectedAgents: [], costEstimate: 0, confidenceScore: 0, reasoning: "" },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.goals.set(fullGoal.id, fullGoal);
    return fullGoal;
  }

  getGoal(goalId: string): Goal | undefined {
    return this.goals.get(goalId);
  }

  listGoals(tenantId?: string, status?: GoalStatus): Goal[] {
    let goals = [...this.goals.values()];
    if (tenantId) goals = goals.filter((g) => g.tenantId === tenantId);
    if (status) goals = goals.filter((g) => g.status === status);
    return goals;
  }

  cancelGoal(goalId: string): boolean {
    const goal = this.goals.get(goalId);
    if (!goal) return false;
    goal.status = "cancelled";
    goal.subtasks.forEach((s) => { if (s.status !== "completed") s.status = "cancelled"; });
    return true;
  }

  // ─── Recursive Decomposition ────────────────────────────────

  decompose(goalId: string, subtasks: Omit<Subtask, "goalId" | "status" | "actualCost" | "actualDuration" | "retries">[]): Goal | null {
    const goal = this.goals.get(goalId);
    if (!goal) return null;

    goal.status = "decomposing";
    goal.subtasks = subtasks.map((s) => ({
      ...s,
      goalId,
      status: "pending" as GoalStatus,
      actualCost: 0,
      actualDuration: 0,
      retries: 0,
    }));
    goal.progress.totalSubtasks = goal.subtasks.length;
    goal.updatedAt = new Date().toISOString();

    // Route subtasks to agents
    goal.routing = this.routeSubtasks(goal);
    goal.status = "active";

    return goal;
  }

  decomposeRecursively(goalId: string, depth = 0, maxDepth = 3): Goal | null {
    const goal = this.goals.get(goalId);
    if (!goal || depth >= maxDepth) return goal ?? null;

    // Check if any subtask is too complex (estimated duration > 60s)
    for (const subtask of goal.subtasks) {
      if (subtask.estimatedDuration > 60000 && subtask.status === "pending") {
        // Create a sub-goal for this complex subtask
        const subGoal = this.createGoal({
          id: `${goalId}_sub_${subtask.id}`,
          tenantId: goal.tenantId,
          title: `Sub-goal: ${subtask.title}`,
          description: subtask.description,
          priority: goal.priority,
          status: "pending",
          parentGoalId: goalId,
          constraints: goal.constraints,
          deadline: goal.deadline,
          metadata: { parentSubtaskId: subtask.id, decompositionDepth: depth + 1 },
        });
        subtask.metadata = { subGoalId: subGoal.id } as any;
      }
    }

    return goal;
  }

  // ─── Execution ──────────────────────────────────────────────

  async executeGoal(goalId: string): Promise<Goal | null> {
    const goal = this.goals.get(goalId);
    if (!goal || goal.status !== "active") return null;

    goal.status = "executing";
    const startTime = Date.now();

    for (const subtask of goal.subtasks) {
      if (goal.status === "cancelled") break;

      // Check dependencies
      const depsCompleted = subtask.dependencies.every(
        (depId) => goal.subtasks.find((s) => s.id === depId)?.status === "completed"
      );
      if (!depsCompleted) {
        subtask.status = "blocked";
        continue;
      }

      // Execute subtask
      subtask.status = "executing" as GoalStatus;
      const subtaskStart = Date.now();

      try {
        subtask.output = await this.executeSubtask(subtask, goal);
        subtask.status = "completed";
        subtask.actualDuration = Date.now() - subtaskStart;
        subtask.actualCost = this.calculateSubtaskCost(subtask);
        goal.progress.completedSubtasks++;
      } catch (err) {
        subtask.error = String(err);
        const healed = this.selfHeal(subtask, goal);
        if (!healed) {
          subtask.status = "failed";
          goal.progress.healthScore = Math.max(0, goal.progress.healthScore - 0.2);
        }
      }

      // Update progress
      goal.progress.percentComplete = (goal.progress.completedSubtasks / goal.progress.totalSubtasks) * 100;
      goal.progress.totalCost += subtask.actualCost;

      // Check budget constraint
      if (goal.progress.totalCost > goal.constraints.maxBudget) {
        goal.status = "blocked";
        break;
      }
    }

    goal.progress.totalDuration = Date.now() - startTime;
    goal.status = goal.subtasks.every((s) => s.status === "completed") ? "completed" :
                  goal.subtasks.some((s) => s.status === "failed") ? "failed" : "blocked";
    goal.updatedAt = new Date().toISOString();

    return goal;
  }

  private async executeSubtask(subtask: Subtask, _goal: Goal): Promise<unknown> {
    // Simulated execution — in production this delegates to the agent mesh
    return { executed: true, subtaskId: subtask.id, agent: subtask.assignedAgent, timestamp: new Date().toISOString() };
  }

  // ─── Self-Healing ───────────────────────────────────────────

  private selfHeal(subtask: Subtask, goal: Goal): boolean {
    if (subtask.retries < subtask.maxRetries) {
      // Retry
      subtask.retries++;
      subtask.status = "pending";
      this.healingLog.push({
        type: "retry",
        subtaskId: subtask.id,
        reason: `Retry ${subtask.retries}/${subtask.maxRetries}: ${subtask.error}`,
        timestamp: new Date().toISOString(),
      });
      return true;
    }

    // Try reassignment
    const alternativeAgent = this.findAlternativeAgent(subtask, goal);
    if (alternativeAgent) {
      subtask.assignedAgent = alternativeAgent;
      subtask.retries = 0;
      subtask.status = "pending";
      this.healingLog.push({
        type: "reassign",
        subtaskId: subtask.id,
        reason: `Reassigned to ${alternativeAgent} after ${subtask.maxRetries} failures`,
        newAgent: alternativeAgent,
        timestamp: new Date().toISOString(),
      });
      return true;
    }

    // Escalate
    this.healingLog.push({
      type: "escalate",
      subtaskId: subtask.id,
      reason: `All retry and reassignment options exhausted`,
      timestamp: new Date().toISOString(),
    });
    return false;
  }

  private findAlternativeAgent(subtask: Subtask, goal: Goal): string | null {
    const currentAgent = subtask.assignedAgent;
    const alternatives = goal.constraints.allowedAgents.filter((a) => a !== currentAgent);
    return alternatives.length > 0 ? alternatives[0] : null;
  }

  // ─── Cost-Aware Routing ─────────────────────────────────────

  registerCostModel(model: CostModel): void {
    this.costModels.set(model.agentId, model);
  }

  private routeSubtasks(goal: Goal): RoutingDecision {
    const assignments: AgentAssignment[] = [];
    let totalCost = 0;

    for (const subtask of goal.subtasks) {
      const bestAgent = this.selectBestAgent(subtask, goal.constraints);
      if (bestAgent) {
        assignments.push(bestAgent);
        subtask.assignedAgent = bestAgent.agentId;
        totalCost += bestAgent.costPerUnit;
      }
    }

    const strategy: SubtaskStrategy = goal.subtasks.some((s) => s.dependencies.length === 0) ? "parallel" : "sequential";

    return {
      strategy,
      selectedAgents: assignments,
      costEstimate: totalCost,
      confidenceScore: assignments.length / goal.subtasks.length,
      reasoning: `Routed ${assignments.length}/${goal.subtasks.length} subtasks using ${strategy} strategy`,
    };
  }

  private selectBestAgent(subtask: Subtask, constraints: GoalConstraints): AgentAssignment | null {
    const candidates = [...this.costModels.values()]
      .filter((m) => constraints.allowedAgents.length === 0 || constraints.allowedAgents.includes(m.agentId))
      .filter((m) => m.reliability >= constraints.qualityThreshold)
      .sort((a, b) => {
        // Balance cost and reliability
        const scoreA = a.reliability / (a.costPerInvocation + 0.01);
        const scoreB = b.reliability / (b.costPerInvocation + 0.01);
        return scoreB - scoreA;
      });

    if (candidates.length === 0) return null;

    const best = candidates[0];
    return {
      agentId: best.agentId,
      subtaskId: subtask.id,
      costPerUnit: best.costPerInvocation,
      capabilities: best.capabilities,
      estimatedDuration: best.avgLatency,
    };
  }

  private calculateSubtaskCost(subtask: Subtask): number {
    const model = this.costModels.get(subtask.assignedAgent ?? "");
    if (!model) return 0;
    return model.costPerInvocation + (subtask.actualDuration / 60000) * model.costPerMinute;
  }

  // ─── Healing Log ────────────────────────────────────────────

  getHealingLog(goalId?: string): SelfHealingAction[] {
    if (!goalId) return [...this.healingLog];
    const goal = this.goals.get(goalId);
    if (!goal) return [];
    const subtaskIds = new Set(goal.subtasks.map((s) => s.id));
    return this.healingLog.filter((h) => subtaskIds.has(h.subtaskId));
  }

  // ─── Stats ──────────────────────────────────────────────────

  getStats(): { totalGoals: number; activeGoals: number; completedGoals: number; totalCost: number; avgHealthScore: number; healingActions: number } {
    const goals = [...this.goals.values()];
    const totalCost = goals.reduce((sum, g) => sum + g.progress.totalCost, 0);
    const healthScores = goals.filter((g) => g.status !== "pending").map((g) => g.progress.healthScore);
    const avgHealth = healthScores.length > 0 ? healthScores.reduce((a, b) => a + b, 0) / healthScores.length : 1;

    return {
      totalGoals: goals.length,
      activeGoals: goals.filter((g) => ["active", "executing", "decomposing"].includes(g.status)).length,
      completedGoals: goals.filter((g) => g.status === "completed").length,
      totalCost,
      avgHealthScore: avgHealth,
      healingActions: this.healingLog.length,
    };
  }
}

export function createGoalEngine(): GoalEngine {
  return new GoalEngine();
}
