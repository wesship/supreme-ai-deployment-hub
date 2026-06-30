/**
 * D3VONN Platform Console v1
 *
 * The unified control layer for the D3VONN platform.
 * Provides navigation to all platform subsystems:
 * - Hermes orchestration dashboard
 * - Agent fleet management
 * - Event stream monitoring
 * - Tenant/workspace switching
 * - Knowledge graph exploration
 * - Security policy viewer
 *
 * @module pages/platform/PlatformConsole
 * @version 1.0.0
 */

import React, { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  Brain,
  Bot,
  Activity,
  Building2,
  Network,
  Shield,
  LayoutDashboard,
  ChevronRight,
  Menu,
  X,
  HeartPulse,
  BarChart3,
  Bell,
  Bug,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TenantWorkspaceSwitcher from "@/components/platform/TenantWorkspaceSwitcher";

// ─────────────────────────────────────────────────────────────────
// Navigation Configuration
// ─────────────────────────────────────────────────────────────────

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    path: "/platform",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Platform health & metrics",
  },
  {
    path: "/platform/hermes",
    label: "Hermes",
    icon: Brain,
    description: "Orchestration engine",
  },
  {
    path: "/platform/agents",
    label: "Agent Fleet",
    icon: Bot,
    description: "Agent management & health",
  },
  {
    path: "/platform/events",
    label: "Event Stream",
    icon: Activity,
    description: "Live events & replay",
  },
  {
    path: "/platform/knowledge",
    label: "Knowledge Graph",
    icon: Network,
    description: "Platform topology",
  },
  {
    path: "/platform/security",
    label: "Security",
    icon: Shield,
    description: "Policies & RBAC",
  },
  {
    path: "/platform/tenants",
    label: "Tenants",
    icon: Building2,
    description: "Multi-tenant management",
  },
  {
    path: "/platform/health",
    label: "Health",
    icon: HeartPulse,
    description: "System health checks",
  },
  {
    path: "/platform/metrics",
    label: "Metrics",
    icon: BarChart3,
    description: "Performance metrics",
  },
  {
    path: "/platform/alerts",
    label: "Alerts",
    icon: Bell,
    description: "Alert management",
  },
  {
    path: "/platform/errors",
    label: "Errors",
    icon: Bug,
    description: "Error traces & Sentry",
  },
  {
    path: "/platform/deployment",
    label: "Deployment",
    icon: Rocket,
    description: "Deployment hardening & readiness",
  },
];

// ─────────────────────────────────────────────────────────────────
// Platform Console Layout
// ─────────────────────────────────────────────────────────────────

const PlatformConsole: React.FC = () => {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isActive = (path: string) => {
    if (path === "/platform") return location.pathname === "/platform";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <Helmet>
        <title>Platform Console | D3VONN</title>
        <meta
          name="description"
          content="D3VONN Platform Console — unified control layer for orchestration, agents, events, and security."
        />
      </Helmet>

      <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "flex flex-col border-r border-slate-800/60 bg-slate-900/50 backdrop-blur-xl transition-all duration-300",
            sidebarOpen ? "w-64" : "w-16"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-slate-800/60">
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Brain className="h-4 w-4 text-white" />
                </div>
                <span className="font-semibold text-sm">D3VONN Console</span>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-md hover:bg-slate-800 transition-colors"
            >
              {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>

          {/* Tenant Switcher */}
          {sidebarOpen && (
            <div className="p-3 border-b border-slate-800/60">
              <TenantWorkspaceSwitcher compact />
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                    active
                      ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  )}
                >
                  <Icon className={cn("h-4 w-4 flex-shrink-0", active && "text-blue-400")} />
                  {sidebarOpen && (
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{item.label}</div>
                      <div className="text-xs text-slate-500 truncate">{item.description}</div>
                    </div>
                  )}
                  {sidebarOpen && active && (
                    <ChevronRight className="h-3 w-3 text-blue-400" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          {sidebarOpen && (
            <div className="p-3 border-t border-slate-800/60">
              <div className="text-xs text-slate-500">
                D3VONN Platform v2.0.0-alpha.1
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                639 tests passing
              </div>
            </div>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </>
  );
};

export default PlatformConsole;
