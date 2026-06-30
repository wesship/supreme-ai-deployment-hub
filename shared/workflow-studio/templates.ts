/**
 * D3VONN Workflow Studio — Templates
 *
 * Pre-built workflow templates for common automation patterns.
 */

import type { WorkflowDefinition, WorkflowNode, WorkflowEdge } from "./workflow-engine";

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: "automation" | "ai-pipeline" | "data-processing" | "integration" | "governance" | "devops";
  tags: string[];
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, { name: string; type: string; defaultValue?: unknown; required: boolean }>;
}

// ─────────────────────────────────────────────────────────────────
// Built-in Templates
// ─────────────────────────────────────────────────────────────────

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: "tpl_research_pipeline",
    name: "AI Research Pipeline",
    description: "Multi-agent research workflow with source validation and report generation",
    category: "ai-pipeline",
    tags: ["research", "agents", "knowledge"],
    nodes: [
      { id: "start", type: "start", label: "Start", config: {}, position: { x: 0, y: 0 } },
      { id: "gather", type: "agent", label: "Gather Sources", config: { agentId: "research-analyst", task: "gather" }, position: { x: 200, y: 0 } },
      { id: "validate", type: "agent", label: "Validate Sources", config: { agentId: "security-sentinel", task: "validate" }, position: { x: 400, y: 0 } },
      { id: "check_quality", type: "condition", label: "Quality OK?", config: { field: "quality_score", operator: "gt", value: 0.7 }, position: { x: 600, y: 0 } },
      { id: "synthesize", type: "agent", label: "Synthesize Report", config: { agentId: "research-analyst", task: "synthesize" }, position: { x: 800, y: -50 } },
      { id: "retry", type: "action", label: "Request More Sources", config: { action: "retry_gather" }, position: { x: 800, y: 50 } },
      { id: "end", type: "end", label: "End", config: {}, position: { x: 1000, y: 0 } },
    ],
    edges: [
      { id: "e1", source: "start", target: "gather", type: "default" },
      { id: "e2", source: "gather", target: "validate", type: "default" },
      { id: "e3", source: "validate", target: "check_quality", type: "default" },
      { id: "e4", source: "check_quality", target: "synthesize", type: "true" },
      { id: "e5", source: "check_quality", target: "retry", type: "false" },
      { id: "e6", source: "synthesize", target: "end", type: "default" },
      { id: "e7", source: "retry", target: "gather", type: "default" },
    ],
    variables: {
      topic: { name: "topic", type: "string", required: true },
      quality_score: { name: "quality_score", type: "number", defaultValue: 0, required: false },
      max_retries: { name: "max_retries", type: "number", defaultValue: 3, required: false },
    },
  },
  {
    id: "tpl_task_delegation",
    name: "Hermes Task Delegation",
    description: "Intelligent task routing through Hermes with agent selection and monitoring",
    category: "automation",
    tags: ["hermes", "delegation", "agents"],
    nodes: [
      { id: "start", type: "start", label: "Start", config: {}, position: { x: 0, y: 0 } },
      { id: "classify", type: "agent", label: "Classify Task", config: { agentId: "hermes", task: "classify" }, position: { x: 200, y: 0 } },
      { id: "select_agent", type: "agent", label: "Select Agent", config: { agentId: "hermes", task: "route" }, position: { x: 400, y: 0 } },
      { id: "execute", type: "agent", label: "Execute Task", config: { agentId: "dynamic", task: "execute" }, position: { x: 600, y: 0 } },
      { id: "check_result", type: "condition", label: "Success?", config: { field: "task_success", operator: "eq", value: true }, position: { x: 800, y: 0 } },
      { id: "log_success", type: "action", label: "Log Success", config: { action: "audit_log" }, position: { x: 1000, y: -50 } },
      { id: "escalate", type: "action", label: "Escalate", config: { action: "escalate_to_human" }, position: { x: 1000, y: 50 } },
      { id: "end", type: "end", label: "End", config: {}, position: { x: 1200, y: 0 } },
    ],
    edges: [
      { id: "e1", source: "start", target: "classify", type: "default" },
      { id: "e2", source: "classify", target: "select_agent", type: "default" },
      { id: "e3", source: "select_agent", target: "execute", type: "default" },
      { id: "e4", source: "execute", target: "check_result", type: "default" },
      { id: "e5", source: "check_result", target: "log_success", type: "true" },
      { id: "e6", source: "check_result", target: "escalate", type: "false" },
      { id: "e7", source: "log_success", target: "end", type: "default" },
      { id: "e8", source: "escalate", target: "end", type: "default" },
    ],
    variables: {
      task_description: { name: "task_description", type: "string", required: true },
      task_success: { name: "task_success", type: "boolean", defaultValue: false, required: false },
      priority: { name: "priority", type: "string", defaultValue: "medium", required: false },
    },
  },
  {
    id: "tpl_data_pipeline",
    name: "Data Processing Pipeline",
    description: "ETL workflow with parallel processing, validation, and storage",
    category: "data-processing",
    tags: ["etl", "data", "parallel"],
    nodes: [
      { id: "start", type: "start", label: "Start", config: {}, position: { x: 0, y: 0 } },
      { id: "extract", type: "action", label: "Extract Data", config: { action: "extract" }, position: { x: 200, y: 0 } },
      { id: "parallel_transform", type: "parallel", label: "Transform", config: {}, position: { x: 400, y: 0 } },
      { id: "clean", type: "transform", label: "Clean", config: { expression: "clean" }, position: { x: 600, y: -50 } },
      { id: "enrich", type: "transform", label: "Enrich", config: { expression: "enrich" }, position: { x: 600, y: 50 } },
      { id: "merge", type: "merge", label: "Merge Results", config: {}, position: { x: 800, y: 0 } },
      { id: "validate", type: "condition", label: "Valid?", config: { field: "validation_passed", operator: "eq", value: true }, position: { x: 1000, y: 0 } },
      { id: "load", type: "action", label: "Load to DB", config: { action: "load" }, position: { x: 1200, y: -50 } },
      { id: "quarantine", type: "action", label: "Quarantine", config: { action: "quarantine" }, position: { x: 1200, y: 50 } },
      { id: "end", type: "end", label: "End", config: {}, position: { x: 1400, y: 0 } },
    ],
    edges: [
      { id: "e1", source: "start", target: "extract", type: "default" },
      { id: "e2", source: "extract", target: "parallel_transform", type: "default" },
      { id: "e3", source: "parallel_transform", target: "clean", type: "default" },
      { id: "e4", source: "parallel_transform", target: "enrich", type: "default" },
      { id: "e5", source: "clean", target: "merge", type: "default" },
      { id: "e6", source: "enrich", target: "merge", type: "default" },
      { id: "e7", source: "merge", target: "validate", type: "default" },
      { id: "e8", source: "validate", target: "load", type: "true" },
      { id: "e9", source: "validate", target: "quarantine", type: "false" },
      { id: "e10", source: "load", target: "end", type: "default" },
      { id: "e11", source: "quarantine", target: "end", type: "default" },
    ],
    variables: {
      source_url: { name: "source_url", type: "string", required: true },
      validation_passed: { name: "validation_passed", type: "boolean", defaultValue: true, required: false },
      batch_size: { name: "batch_size", type: "number", defaultValue: 1000, required: false },
    },
  },
  {
    id: "tpl_security_scan",
    name: "Security Compliance Scan",
    description: "Automated security scanning with policy enforcement and alerting",
    category: "governance",
    tags: ["security", "compliance", "scanning"],
    nodes: [
      { id: "start", type: "start", label: "Start", config: {}, position: { x: 0, y: 0 } },
      { id: "scan_secrets", type: "agent", label: "Scan Secrets", config: { agentId: "security-sentinel", task: "scan_secrets" }, position: { x: 200, y: 0 } },
      { id: "scan_deps", type: "agent", label: "Scan Dependencies", config: { agentId: "security-sentinel", task: "scan_deps" }, position: { x: 400, y: 0 } },
      { id: "check_policy", type: "condition", label: "Policy Pass?", config: { field: "policy_passed", operator: "eq", value: true }, position: { x: 600, y: 0 } },
      { id: "approve", type: "action", label: "Approve", config: { action: "approve_deployment" }, position: { x: 800, y: -50 } },
      { id: "block", type: "action", label: "Block & Alert", config: { action: "block_and_alert" }, position: { x: 800, y: 50 } },
      { id: "end", type: "end", label: "End", config: {}, position: { x: 1000, y: 0 } },
    ],
    edges: [
      { id: "e1", source: "start", target: "scan_secrets", type: "default" },
      { id: "e2", source: "scan_secrets", target: "scan_deps", type: "default" },
      { id: "e3", source: "scan_deps", target: "check_policy", type: "default" },
      { id: "e4", source: "check_policy", target: "approve", type: "true" },
      { id: "e5", source: "check_policy", target: "block", type: "false" },
      { id: "e6", source: "approve", target: "end", type: "default" },
      { id: "e7", source: "block", target: "end", type: "default" },
    ],
    variables: {
      target_repo: { name: "target_repo", type: "string", required: true },
      policy_passed: { name: "policy_passed", type: "boolean", defaultValue: false, required: false },
      severity_threshold: { name: "severity_threshold", type: "string", defaultValue: "high", required: false },
    },
  },
  {
    id: "tpl_onboarding",
    name: "Customer Onboarding",
    description: "Automated customer onboarding with workspace setup and guided tutorials",
    category: "automation",
    tags: ["onboarding", "customer", "setup"],
    nodes: [
      { id: "start", type: "start", label: "Start", config: {}, position: { x: 0, y: 0 } },
      { id: "create_workspace", type: "action", label: "Create Workspace", config: { action: "create_workspace" }, position: { x: 200, y: 0 } },
      { id: "setup_rbac", type: "action", label: "Setup RBAC", config: { action: "setup_rbac" }, position: { x: 400, y: 0 } },
      { id: "deploy_agents", type: "action", label: "Deploy Agents", config: { action: "deploy_default_agents" }, position: { x: 600, y: 0 } },
      { id: "send_welcome", type: "action", label: "Send Welcome", config: { action: "send_welcome_email" }, position: { x: 800, y: 0 } },
      { id: "end", type: "end", label: "End", config: {}, position: { x: 1000, y: 0 } },
    ],
    edges: [
      { id: "e1", source: "start", target: "create_workspace", type: "default" },
      { id: "e2", source: "create_workspace", target: "setup_rbac", type: "default" },
      { id: "e3", source: "setup_rbac", target: "deploy_agents", type: "default" },
      { id: "e4", source: "deploy_agents", target: "send_welcome", type: "default" },
      { id: "e5", source: "send_welcome", target: "end", type: "default" },
    ],
    variables: {
      tenant_name: { name: "tenant_name", type: "string", required: true },
      plan: { name: "plan", type: "string", defaultValue: "pro", required: false },
      admin_email: { name: "admin_email", type: "string", required: true },
    },
  },
];

// ─────────────────────────────────────────────────────────────────
// Template Manager
// ─────────────────────────────────────────────────────────────────

export class TemplateManager {
  private templates: Map<string, WorkflowTemplate> = new Map();

  constructor() {
    for (const tpl of WORKFLOW_TEMPLATES) {
      this.templates.set(tpl.id, tpl);
    }
  }

  getTemplate(templateId: string): WorkflowTemplate | undefined {
    return this.templates.get(templateId);
  }

  listTemplates(category?: string): WorkflowTemplate[] {
    const all = [...this.templates.values()];
    return category ? all.filter((t) => t.category === category) : all;
  }

  searchTemplates(query: string): WorkflowTemplate[] {
    const q = query.toLowerCase();
    return [...this.templates.values()].filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  addTemplate(template: WorkflowTemplate): void {
    this.templates.set(template.id, template);
  }

  instantiate(templateId: string, tenantId: string, name?: string): WorkflowDefinition | null {
    const template = this.templates.get(templateId);
    if (!template) return null;

    return {
      id: `wf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: name ?? template.name,
      description: template.description,
      version: "1.0.0",
      status: "draft",
      nodes: [...template.nodes],
      edges: [...template.edges],
      variables: template.variables as any,
      triggers: [{ type: "manual", config: {} }],
      timeout: 300000,
      retryPolicy: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2, maxBackoffMs: 30000 },
      tenantId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  getStats(): { totalTemplates: number; byCategory: Record<string, number> } {
    const byCategory: Record<string, number> = {};
    for (const tpl of this.templates.values()) {
      byCategory[tpl.category] = (byCategory[tpl.category] || 0) + 1;
    }
    return { totalTemplates: this.templates.size, byCategory };
  }
}

export function createTemplateManager(): TemplateManager {
  return new TemplateManager();
}
