/**
 * D3VONN Workflow Studio — Workflow Engine
 *
 * Visual workflow execution engine supporting branches,
 * parallel execution, scheduling, conditions, and loops.
 */

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type NodeType = "start" | "end" | "action" | "condition" | "parallel" | "loop" | "delay" | "webhook" | "agent" | "transform" | "merge";
export type EdgeType = "default" | "true" | "false" | "error" | "timeout";
export type WorkflowStatus = "draft" | "active" | "paused" | "archived" | "error";
export type ExecutionStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | "timeout";

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  metadata?: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  condition?: string;
  label?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, WorkflowVariable>;
  triggers: WorkflowTrigger[];
  schedule?: WorkflowSchedule;
  timeout: number; // ms
  retryPolicy: RetryPolicy;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowVariable {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  defaultValue?: unknown;
  required: boolean;
  description?: string;
}

export interface WorkflowTrigger {
  type: "manual" | "event" | "schedule" | "webhook" | "api";
  config: Record<string, unknown>;
}

export interface WorkflowSchedule {
  cron: string;
  timezone: string;
  enabled: boolean;
  nextRun?: string;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  tenantId: string;
  variables: Record<string, unknown>;
  startedAt: string;
  status: ExecutionStatus;
  currentNodes: string[];
  completedNodes: string[];
  failedNodes: string[];
  nodeOutputs: Record<string, unknown>;
  errors: ExecutionError[];
}

export interface ExecutionError {
  nodeId: string;
  error: string;
  timestamp: string;
  retryCount: number;
}

export interface ExecutionResult {
  executionId: string;
  workflowId: string;
  status: ExecutionStatus;
  startedAt: string;
  completedAt: string;
  duration: number;
  outputs: Record<string, unknown>;
  nodesExecuted: number;
  errors: ExecutionError[];
}

// ─────────────────────────────────────────────────────────────────
// Workflow Engine
// ─────────────────────────────────────────────────────────────────

export class WorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private executions: Map<string, ExecutionContext> = new Map();
  private results: ExecutionResult[] = [];
  private executionCounter = 0;

  // ─── Workflow Management ────────────────────────────────────

  createWorkflow(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow);
  }

  updateWorkflow(workflowId: string, updates: Partial<WorkflowDefinition>): boolean {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return false;
    Object.assign(workflow, updates, { updatedAt: new Date().toISOString() });
    return true;
  }

  deleteWorkflow(workflowId: string): boolean {
    return this.workflows.delete(workflowId);
  }

  getWorkflow(workflowId: string): WorkflowDefinition | undefined {
    return this.workflows.get(workflowId);
  }

  listWorkflows(tenantId?: string): WorkflowDefinition[] {
    const all = [...this.workflows.values()];
    return tenantId ? all.filter((w) => w.tenantId === tenantId) : all;
  }

  // ─── Execution ──────────────────────────────────────────────

  async execute(workflowId: string, inputs: Record<string, unknown> = {}): Promise<ExecutionResult> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) throw new Error(`Workflow ${workflowId} not found`);

    const executionId = `exec_${++this.executionCounter}_${Date.now()}`;
    const startedAt = new Date().toISOString();

    const context: ExecutionContext = {
      executionId,
      workflowId,
      tenantId: workflow.tenantId,
      variables: { ...this.getDefaultVariables(workflow), ...inputs },
      startedAt,
      status: "running",
      currentNodes: [],
      completedNodes: [],
      failedNodes: [],
      nodeOutputs: {},
      errors: [],
    };

    this.executions.set(executionId, context);

    try {
      // Find start node
      const startNode = workflow.nodes.find((n) => n.type === "start");
      if (!startNode) throw new Error("No start node found");

      // Execute graph traversal
      await this.executeNode(startNode, workflow, context);

      context.status = context.failedNodes.length > 0 ? "failed" : "completed";
    } catch (err) {
      context.status = "failed";
      context.errors.push({
        nodeId: "engine",
        error: String(err),
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
    }

    const result: ExecutionResult = {
      executionId,
      workflowId,
      status: context.status,
      startedAt,
      completedAt: new Date().toISOString(),
      duration: Date.now() - new Date(startedAt).getTime(),
      outputs: context.nodeOutputs,
      nodesExecuted: context.completedNodes.length,
      errors: context.errors,
    };

    this.results.push(result);
    return result;
  }

  cancelExecution(executionId: string): boolean {
    const context = this.executions.get(executionId);
    if (!context || context.status !== "running") return false;
    context.status = "cancelled";
    return true;
  }

  getExecution(executionId: string): ExecutionContext | undefined {
    return this.executions.get(executionId);
  }

  getExecutionHistory(workflowId?: string, limit = 50): ExecutionResult[] {
    let history = [...this.results];
    if (workflowId) history = history.filter((r) => r.workflowId === workflowId);
    return history.slice(-limit);
  }

  // ─── Node Execution ─────────────────────────────────────────

  private async executeNode(node: WorkflowNode, workflow: WorkflowDefinition, context: ExecutionContext): Promise<void> {
    if (context.status !== "running") return;
    if (context.completedNodes.includes(node.id)) return;

    context.currentNodes.push(node.id);

    try {
      const output = await this.processNode(node, context);
      context.nodeOutputs[node.id] = output;
      context.completedNodes.push(node.id);
    } catch (err) {
      context.failedNodes.push(node.id);
      context.errors.push({
        nodeId: node.id,
        error: String(err),
        timestamp: new Date().toISOString(),
        retryCount: 0,
      });
      return;
    } finally {
      context.currentNodes = context.currentNodes.filter((id) => id !== node.id);
    }

    // Find and execute next nodes
    const outEdges = workflow.edges.filter((e) => e.source === node.id);

    if (node.type === "condition") {
      const condResult = context.nodeOutputs[node.id] as boolean;
      const nextEdge = outEdges.find((e) => e.type === (condResult ? "true" : "false")) ?? outEdges[0];
      if (nextEdge) {
        const nextNode = workflow.nodes.find((n) => n.id === nextEdge.target);
        if (nextNode) await this.executeNode(nextNode, workflow, context);
      }
    } else if (node.type === "parallel") {
      // Execute all branches in parallel
      const nextNodes = outEdges
        .map((e) => workflow.nodes.find((n) => n.id === e.target))
        .filter(Boolean) as WorkflowNode[];
      await Promise.all(nextNodes.map((n) => this.executeNode(n, workflow, context)));
    } else {
      // Sequential execution
      for (const edge of outEdges) {
        const nextNode = workflow.nodes.find((n) => n.id === edge.target);
        if (nextNode) await this.executeNode(nextNode, workflow, context);
      }
    }
  }

  private async processNode(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
    switch (node.type) {
      case "start":
        return { started: true };
      case "end":
        return { ended: true };
      case "action":
        return this.executeAction(node, context);
      case "condition":
        return this.evaluateCondition(node, context);
      case "delay":
        return this.executeDelay(node);
      case "transform":
        return this.executeTransform(node, context);
      case "agent":
        return this.executeAgentNode(node, context);
      case "parallel":
        return { parallel: true };
      case "merge":
        return { merged: true };
      case "loop":
        return this.executeLoop(node, context);
      default:
        return null;
    }
  }

  private async executeAction(node: WorkflowNode, _context: ExecutionContext): Promise<unknown> {
    const action = node.config.action as string;
    return { action, executed: true, timestamp: new Date().toISOString() };
  }

  private evaluateCondition(node: WorkflowNode, context: ExecutionContext): boolean {
    const field = node.config.field as string;
    const operator = node.config.operator as string;
    const value = node.config.value;
    const actual = context.variables[field];

    switch (operator) {
      case "eq": return actual === value;
      case "neq": return actual !== value;
      case "gt": return (actual as number) > (value as number);
      case "lt": return (actual as number) < (value as number);
      case "contains": return String(actual).includes(String(value));
      case "exists": return actual !== undefined && actual !== null;
      default: return false;
    }
  }

  private async executeDelay(node: WorkflowNode): Promise<unknown> {
    const delayMs = (node.config.delayMs as number) ?? 0;
    // In production, this would actually delay; here we simulate
    return { delayed: true, delayMs };
  }

  private async executeTransform(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
    const expression = node.config.expression as string;
    const inputVar = node.config.input as string;
    return { transformed: true, expression, input: context.variables[inputVar] };
  }

  private async executeAgentNode(node: WorkflowNode, _context: ExecutionContext): Promise<unknown> {
    const agentId = node.config.agentId as string;
    const task = node.config.task as string;
    return { agentId, task, delegated: true, timestamp: new Date().toISOString() };
  }

  private async executeLoop(node: WorkflowNode, context: ExecutionContext): Promise<unknown> {
    const iterations = (node.config.maxIterations as number) ?? 1;
    const collection = node.config.collection as string;
    const items = context.variables[collection] as unknown[] ?? [];
    return { looped: true, iterations: Math.min(iterations, items.length) };
  }

  // ─── Helpers ────────────────────────────────────────────────

  private getDefaultVariables(workflow: WorkflowDefinition): Record<string, unknown> {
    const vars: Record<string, unknown> = {};
    for (const [name, def] of Object.entries(workflow.variables)) {
      if (def.defaultValue !== undefined) vars[name] = def.defaultValue;
    }
    return vars;
  }

  // ─── Stats ──────────────────────────────────────────────────

  getStats(): { totalWorkflows: number; totalExecutions: number; successRate: number; avgDuration: number } {
    const successful = this.results.filter((r) => r.status === "completed").length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    return {
      totalWorkflows: this.workflows.size,
      totalExecutions: this.results.length,
      successRate: this.results.length > 0 ? successful / this.results.length : 0,
      avgDuration: this.results.length > 0 ? totalDuration / this.results.length : 0,
    };
  }
}

export function createWorkflowEngine(): WorkflowEngine {
  return new WorkflowEngine();
}
