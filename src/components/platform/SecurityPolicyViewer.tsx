/**
 * D3VONN Security Policy Viewer
 *
 * Displays security policies, RBAC configuration, and compliance status:
 * - Active policies with enforcement status
 * - RBAC role hierarchy
 * - Recent governance decisions
 * - Compliance audit trail
 * - Policy violation alerts
 *
 * @module components/platform/SecurityPolicyViewer
 * @version 1.0.0
 */

import React, { useState } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Users,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────
// Types & Mock Data
// ─────────────────────────────────────────────────────────────────

interface Policy {
  id: string;
  name: string;
  type: "rbac" | "rls" | "governance" | "compliance" | "network" | "data";
  status: "active" | "monitoring" | "disabled";
  enforcement: "strict" | "permissive" | "audit-only";
  description: string;
  lastTriggered?: string;
  violations24h: number;
}

interface RBACRole {
  id: string;
  name: string;
  level: number;
  inherits?: string;
  permissions: string[];
  userCount: number;
}

interface GovernanceDecision {
  id: string;
  timestamp: string;
  type: "allow" | "deny" | "escalate";
  policy: string;
  subject: string;
  resource: string;
  action: string;
  reason: string;
}

const POLICIES: Policy[] = [
  {
    id: "pol-001",
    name: "RBAC Deny-First Enforcer",
    type: "rbac",
    status: "active",
    enforcement: "strict",
    description: "All permissions denied by default. Explicit grants required per role.",
    lastTriggered: "5m ago",
    violations24h: 0,
  },
  {
    id: "pol-002",
    name: "Row-Level Security",
    type: "rls",
    status: "active",
    enforcement: "strict",
    description: "Tenant data isolation enforced at database level. 8 tables protected.",
    lastTriggered: "1m ago",
    violations24h: 0,
  },
  {
    id: "pol-003",
    name: "Agent Governance Framework",
    type: "governance",
    status: "active",
    enforcement: "strict",
    description: "Hermes enforces capability boundaries and escalation protocols.",
    lastTriggered: "10m ago",
    violations24h: 2,
  },
  {
    id: "pol-004",
    name: "Data Sovereignty Compliance",
    type: "compliance",
    status: "active",
    enforcement: "audit-only",
    description: "GDPR, SOC2, HIPAA compliance tracking and data residency enforcement.",
    violations24h: 0,
  },
  {
    id: "pol-005",
    name: "API Rate Limiting",
    type: "network",
    status: "active",
    enforcement: "strict",
    description: "Per-tenant rate limits: Free=100/min, Pro=1000/min, Enterprise=10000/min.",
    lastTriggered: "30s ago",
    violations24h: 12,
  },
  {
    id: "pol-006",
    name: "Sensitive Data Masking",
    type: "data",
    status: "active",
    enforcement: "strict",
    description: "PII and secrets automatically masked in logs, events, and agent memory.",
    lastTriggered: "2m ago",
    violations24h: 0,
  },
];

const RBAC_ROLES: RBACRole[] = [
  {
    id: "platform_admin",
    name: "Platform Admin",
    level: 100,
    permissions: ["*:*", "platform:manage", "tenant:manage", "agent:deploy", "security:configure"],
    userCount: 2,
  },
  {
    id: "tenant_admin",
    name: "Tenant Admin",
    level: 80,
    inherits: "workspace_admin",
    permissions: ["tenant:read", "tenant:write", "workspace:manage", "agent:deploy", "billing:manage"],
    userCount: 5,
  },
  {
    id: "workspace_admin",
    name: "Workspace Admin",
    level: 60,
    inherits: "developer",
    permissions: ["workspace:read", "workspace:write", "agent:configure", "event:replay"],
    userCount: 12,
  },
  {
    id: "developer",
    name: "Developer",
    level: 40,
    inherits: "viewer",
    permissions: ["agent:invoke", "event:publish", "knowledge:write", "tool:execute"],
    userCount: 34,
  },
  {
    id: "viewer",
    name: "Viewer",
    level: 20,
    permissions: ["agent:read", "event:read", "knowledge:read", "dashboard:view"],
    userCount: 89,
  },
];

const RECENT_DECISIONS: GovernanceDecision[] = [
  {
    id: "dec-001",
    timestamp: "2026-06-30T22:10:01Z",
    type: "allow",
    policy: "RBAC Enforcer",
    subject: "user:dev-042",
    resource: "agent:code-engineer",
    action: "invoke",
    reason: "Role 'developer' has 'agent:invoke' permission",
  },
  {
    id: "dec-002",
    timestamp: "2026-06-30T22:09:45Z",
    type: "deny",
    policy: "Agent Governance",
    subject: "agent:content-writer",
    resource: "tool:database-admin",
    action: "execute",
    reason: "Agent lacks 'database-admin' capability declaration",
  },
  {
    id: "dec-003",
    timestamp: "2026-06-30T22:09:30Z",
    type: "deny",
    policy: "Rate Limiting",
    subject: "tenant:tenant-003",
    resource: "api/v1/tasks",
    action: "create",
    reason: "Free tier rate limit exceeded (100/min)",
  },
  {
    id: "dec-004",
    timestamp: "2026-06-30T22:09:15Z",
    type: "allow",
    policy: "RLS",
    subject: "user:admin-001",
    resource: "events:tenant-001",
    action: "read",
    reason: "User belongs to tenant-001, RLS policy satisfied",
  },
  {
    id: "dec-005",
    timestamp: "2026-06-30T22:08:50Z",
    type: "escalate",
    policy: "Agent Governance",
    subject: "agent:devops-engineer",
    resource: "infrastructure:production",
    action: "deploy",
    reason: "Production deployment requires human approval",
  },
];

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

const SecurityPolicyViewer: React.FC = () => {
  const [expandedPolicy, setExpandedPolicy] = useState<string | null>(null);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const enforcementColors: Record<string, string> = {
    strict: "border-emerald-500/30 text-emerald-400",
    permissive: "border-amber-500/30 text-amber-400",
    "audit-only": "border-blue-500/30 text-blue-400",
  };

  const decisionColors: Record<string, { icon: React.ReactNode; color: string }> = {
    allow: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />, color: "text-emerald-400" },
    deny: { icon: <XCircle className="h-3.5 w-3.5 text-red-400" />, color: "text-red-400" },
    escalate: { icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />, color: "text-amber-400" },
  };

  const policyTypeIcons: Record<string, React.ReactNode> = {
    rbac: <Lock className="h-4 w-4 text-blue-400" />,
    rls: <Shield className="h-4 w-4 text-purple-400" />,
    governance: <ShieldCheck className="h-4 w-4 text-emerald-400" />,
    compliance: <Eye className="h-4 w-4 text-cyan-400" />,
    network: <ShieldAlert className="h-4 w-4 text-amber-400" />,
    data: <Lock className="h-4 w-4 text-red-400" />,
  };

  const totalViolations = POLICIES.reduce((sum, p) => sum + p.violations24h, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Shield className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Security & Policies</h1>
            <p className="text-sm text-slate-400">
              RBAC, governance, compliance, and audit
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className={cn(
            totalViolations > 0
              ? "border-amber-500/30 text-amber-400"
              : "border-emerald-500/30 text-emerald-400"
          )}
        >
          {totalViolations > 0 ? (
            <>
              <AlertTriangle className="h-3 w-3 mr-1" />
              {totalViolations} violations (24h)
            </>
          ) : (
            <>
              <CheckCircle2 className="h-3 w-3 mr-1" />
              No violations
            </>
          )}
        </Badge>
      </div>

      {/* Policies */}
      <Card className="bg-slate-900/50 border-slate-800/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Active Policies ({POLICIES.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {POLICIES.map((policy) => (
              <div key={policy.id}>
                <button
                  onClick={() => setExpandedPolicy(expandedPolicy === policy.id ? null : policy.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/30 transition-colors text-left"
                >
                  {expandedPolicy === policy.id ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  )}
                  {policyTypeIcons[policy.type]}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">{policy.name}</div>
                    <div className="text-[10px] text-slate-500">{policy.type.toUpperCase()}</div>
                  </div>
                  <Badge variant="outline" className={cn("text-[9px]", enforcementColors[policy.enforcement])}>
                    {policy.enforcement}
                  </Badge>
                  {policy.violations24h > 0 && (
                    <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[9px]">
                      {policy.violations24h} violations
                    </Badge>
                  )}
                </button>
                {expandedPolicy === policy.id && (
                  <div className="ml-8 mt-1 p-3 rounded-md bg-slate-800/20 border border-slate-700/20">
                    <p className="text-xs text-slate-300 mb-2">{policy.description}</p>
                    <div className="flex items-center gap-4 text-[10px] text-slate-400">
                      <span>Status: <span className="text-emerald-400">{policy.status}</span></span>
                      {policy.lastTriggered && <span>Last triggered: {policy.lastTriggered}</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two Column: RBAC + Decisions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RBAC Hierarchy */}
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-400" />
              RBAC Role Hierarchy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {RBAC_ROLES.map((role) => (
                <div key={role.id}>
                  <button
                    onClick={() => setExpandedRole(expandedRole === role.id ? null : role.id)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-slate-800/30 transition-colors text-left"
                  >
                    {expandedRole === role.id ? (
                      <ChevronDown className="h-3 w-3 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-slate-400" />
                    )}
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-500"
                      style={{ width: `${role.level}%`, maxWidth: "60px" }}
                    />
                    <span className="text-sm text-white flex-1">{role.name}</span>
                    <span className="text-[10px] text-slate-400">{role.userCount} users</span>
                    <Badge variant="outline" className="border-slate-600 text-slate-400 text-[9px]">
                      L{role.level}
                    </Badge>
                  </button>
                  {expandedRole === role.id && (
                    <div className="ml-8 mt-1 p-2.5 rounded-md bg-slate-800/20">
                      {role.inherits && (
                        <div className="text-[10px] text-slate-400 mb-1.5">
                          Inherits from: <span className="text-blue-400">{role.inherits}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/50"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Governance Decisions */}
        <Card className="bg-slate-900/50 border-slate-800/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
              <Eye className="h-4 w-4 text-cyan-400" />
              Recent Decisions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {RECENT_DECISIONS.map((decision) => (
                <div
                  key={decision.id}
                  className="p-2.5 rounded-md bg-slate-800/30 border border-slate-700/20"
                >
                  <div className="flex items-center gap-2 mb-1">
                    {decisionColors[decision.type].icon}
                    <span className={cn("text-xs font-medium uppercase", decisionColors[decision.type].color)}>
                      {decision.type}
                    </span>
                    <span className="text-[10px] text-slate-500 ml-auto">
                      {new Date(decision.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-300 mb-1">
                    <span className="text-slate-400">{decision.subject}</span>
                    {" → "}
                    <span className="text-white">{decision.action}</span>
                    {" → "}
                    <span className="text-slate-400">{decision.resource}</span>
                  </div>
                  <div className="text-[10px] text-slate-500">{decision.reason}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SecurityPolicyViewer;
