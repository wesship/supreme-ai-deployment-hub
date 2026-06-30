/**
 * D3VONN Tenant/Workspace Switcher
 *
 * Provides tenant and workspace context switching for the platform console.
 * Integrates with the multi-tenant system to scope all views.
 *
 * @module components/platform/TenantWorkspaceSwitcher
 * @version 1.0.0
 */

import React, { useState } from "react";
import { Building2, ChevronDown, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  plan: "free" | "pro" | "enterprise";
  status: "active" | "suspended" | "trial";
}

interface Workspace {
  id: string;
  name: string;
  tenantId: string;
  environment: "production" | "staging" | "development";
}

// ─────────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────────

const TENANTS: Tenant[] = [
  { id: "tenant-001", name: "D3VONN Labs", plan: "enterprise", status: "active" },
  { id: "tenant-002", name: "Acme Corp", plan: "pro", status: "active" },
  { id: "tenant-003", name: "Startup Inc", plan: "free", status: "trial" },
];

const WORKSPACES: Workspace[] = [
  { id: "ws-001", name: "Production", tenantId: "tenant-001", environment: "production" },
  { id: "ws-002", name: "Staging", tenantId: "tenant-001", environment: "staging" },
  { id: "ws-003", name: "Development", tenantId: "tenant-001", environment: "development" },
  { id: "ws-004", name: "Main", tenantId: "tenant-002", environment: "production" },
  { id: "ws-005", name: "Sandbox", tenantId: "tenant-003", environment: "development" },
];

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

interface TenantWorkspaceSwitcherProps {
  compact?: boolean;
}

const TenantWorkspaceSwitcher: React.FC<TenantWorkspaceSwitcherProps> = ({ compact = false }) => {
  const [selectedTenant, setSelectedTenant] = useState<Tenant>(TENANTS[0]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace>(WORKSPACES[0]);
  const [tenantDropdownOpen, setTenantDropdownOpen] = useState(false);
  const [workspaceDropdownOpen, setWorkspaceDropdownOpen] = useState(false);

  const tenantWorkspaces = WORKSPACES.filter((ws) => ws.tenantId === selectedTenant.id);

  const handleTenantSelect = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    const firstWorkspace = WORKSPACES.find((ws) => ws.tenantId === tenant.id);
    if (firstWorkspace) setSelectedWorkspace(firstWorkspace);
    setTenantDropdownOpen(false);
  };

  const handleWorkspaceSelect = (workspace: Workspace) => {
    setSelectedWorkspace(workspace);
    setWorkspaceDropdownOpen(false);
  };

  const planColors: Record<string, string> = {
    free: "border-slate-500/30 text-slate-400",
    pro: "border-blue-500/30 text-blue-400",
    enterprise: "border-purple-500/30 text-purple-400",
  };

  const envColors: Record<string, string> = {
    production: "bg-emerald-500/10 text-emerald-400",
    staging: "bg-amber-500/10 text-amber-400",
    development: "bg-blue-500/10 text-blue-400",
  };

  if (compact) {
    return (
      <div className="space-y-2">
        {/* Tenant Selector */}
        <div className="relative">
          <button
            onClick={() => setTenantDropdownOpen(!tenantDropdownOpen)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-800/50 border border-slate-700/50 hover:border-slate-600/50 transition-colors text-left"
          >
            <Building2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-xs text-white truncate flex-1">{selectedTenant.name}</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {tenantDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-800 border border-slate-700/60 rounded-md shadow-xl py-1">
              {TENANTS.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleTenantSelect(tenant)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700/50 transition-colors text-left"
                >
                  {tenant.id === selectedTenant.id && (
                    <Check className="h-3 w-3 text-blue-400" />
                  )}
                  <span className={cn("text-xs text-white", tenant.id !== selectedTenant.id && "ml-5")}>
                    {tenant.name}
                  </span>
                  <Badge variant="outline" className={cn("text-[9px] ml-auto", planColors[tenant.plan])}>
                    {tenant.plan}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Workspace Selector */}
        <div className="relative">
          <button
            onClick={() => setWorkspaceDropdownOpen(!workspaceDropdownOpen)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/50 transition-colors text-left"
          >
            <span className={cn("text-[9px] px-1.5 py-0.5 rounded", envColors[selectedWorkspace.environment])}>
              {selectedWorkspace.environment.slice(0, 4)}
            </span>
            <span className="text-xs text-slate-300 truncate flex-1">{selectedWorkspace.name}</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {workspaceDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-slate-800 border border-slate-700/60 rounded-md shadow-xl py-1">
              {tenantWorkspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleWorkspaceSelect(ws)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-700/50 transition-colors text-left"
                >
                  {ws.id === selectedWorkspace.id && (
                    <Check className="h-3 w-3 text-blue-400" />
                  )}
                  <span className={cn("text-xs text-white", ws.id !== selectedWorkspace.id && "ml-5")}>
                    {ws.name}
                  </span>
                  <span className={cn("text-[9px] px-1.5 py-0.5 rounded ml-auto", envColors[ws.environment])}>
                    {ws.environment}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full-size version (for /platform/tenants page)
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tenant Management</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage tenants, workspaces, and access scopes
        </p>
      </div>

      {/* Tenant List */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TENANTS.map((tenant) => (
          <div
            key={tenant.id}
            onClick={() => handleTenantSelect(tenant)}
            className={cn(
              "p-4 rounded-lg border cursor-pointer transition-all",
              tenant.id === selectedTenant.id
                ? "border-blue-500/40 bg-blue-500/5"
                : "border-slate-800/60 bg-slate-900/50 hover:border-slate-700/60"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">{tenant.name}</span>
              <Badge variant="outline" className={planColors[tenant.plan]}>
                {tenant.plan}
              </Badge>
            </div>
            <div className="text-xs text-slate-400">
              {WORKSPACES.filter((ws) => ws.tenantId === tenant.id).length} workspaces
            </div>
            <div className="text-xs text-slate-500 mt-1">ID: {tenant.id}</div>
          </div>
        ))}
      </div>

      {/* Workspaces for Selected Tenant */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-3">
          Workspaces — {selectedTenant.name}
        </h2>
        <div className="space-y-2">
          {tenantWorkspaces.map((ws) => (
            <div
              key={ws.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border transition-all",
                ws.id === selectedWorkspace.id
                  ? "border-blue-500/30 bg-blue-500/5"
                  : "border-slate-800/60 bg-slate-900/30"
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn("text-xs px-2 py-0.5 rounded", envColors[ws.environment])}>
                  {ws.environment}
                </span>
                <span className="text-sm text-white">{ws.name}</span>
              </div>
              <span className="text-xs text-slate-500">{ws.id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TenantWorkspaceSwitcher;
