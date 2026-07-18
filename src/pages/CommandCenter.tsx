import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Bot,
  Wrench,
  Store,
  Settings,
  ChevronLeft,
  ChevronRight,
  Command,
  ShieldCheck,
  Activity,
} from "lucide-react";
import CommandCenterOverview from "@/components/command-center/CommandCenterOverview";
import CommandCenterAgents from "@/components/command-center/CommandCenterAgents";
import CommandCenterMcp from "@/components/command-center/CommandCenterMcp";
import CommandCenterMarketplace from "@/components/command-center/CommandCenterMarketplace";
import CommandCenterSettings from "@/components/command-center/CommandCenterSettings";
import D3vonnPageBanner from "@/components/index/D3vonnPageBanner";

type View = "overview" | "agents" | "mcp" | "marketplace" | "settings";

const SIDEBAR_ITEMS: { id: View; label: string; description: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", description: "Executive operating picture", icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: "agents", label: "Agents", description: "AI workforce operations", icon: <Bot className="h-5 w-5" /> },
  { id: "mcp", label: "MCP Tools", description: "Connected capabilities", icon: <Wrench className="h-5 w-5" /> },
  { id: "marketplace", label: "Marketplace", description: "Deployable intelligence", icon: <Store className="h-5 w-5" /> },
  { id: "settings", label: "Settings", description: "Platform governance", icon: <Settings className="h-5 w-5" /> },
];

const VIEW_COMPONENTS: Record<View, React.FC<{ onNavigate: (v: string) => void }>> = {
  overview: CommandCenterOverview,
  agents: CommandCenterAgents,
  mcp: CommandCenterMcp,
  marketplace: CommandCenterMarketplace,
  settings: CommandCenterSettings,
};

export default function CommandCenter() {
  const [activeView, setActiveView] = useState<View>("overview");
  const [collapsed, setCollapsed] = useState(false);

  const ActiveComponent = VIEW_COMPONENTS[activeView];
  const activeItem = SIDEBAR_ITEMS.find((item) => item.id === activeView) ?? SIDEBAR_ITEMS[0];

  return (
    <TooltipProvider delayDuration={0}>
      <D3vonnPageBanner title="Command Center" />
      <div className="d3-os-shell min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(43,117,255,0.09),transparent_32%)]">
        <div className="border-b border-blue-300/10 bg-black/30 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1800px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-300/20 bg-blue-400/10 shadow-[0_0_30px_rgba(59,130,246,0.14)]">
                <Command className="h-5 w-5 text-blue-100" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{activeItem.label}</p>
                <p className="truncate text-xs text-white/45">{activeItem.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.14em] text-white/55">
              <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-emerald-300/15 bg-emerald-400/[0.06] px-3">
                <Activity className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                Systems online
              </span>
              <span className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-blue-300/15 bg-blue-400/[0.06] px-3">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-200" aria-hidden="true" />
                Governance active
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1800px] flex-col md:flex-row">
          <aside
            aria-label="Command Center navigation"
            className={`sticky top-16 z-20 flex h-auto flex-col border-b border-white/10 bg-[#030816]/80 backdrop-blur-2xl transition-all duration-300 md:h-[calc(100vh-4rem)] md:border-b-0 md:border-r ${
              collapsed ? "md:w-20" : "md:w-72"
            }`}
          >
            <div className="flex flex-1 gap-2 overflow-x-auto p-2 md:block md:space-y-2 md:overflow-visible md:p-4">
              {SIDEBAR_ITEMS.map((item) => {
                const isActive = activeView === item.id;
                const btn = (
                  <Button
                    key={item.id}
                    variant="ghost"
                    aria-pressed={isActive}
                    className={`group min-h-12 min-w-max justify-start gap-3 rounded-xl border px-3 transition-all md:w-full ${
                      isActive
                        ? "border-blue-300/25 bg-blue-400/10 text-white shadow-[inset_3px_0_0_rgba(147,197,253,0.9)]"
                        : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/[0.04] hover:text-white"
                    } ${collapsed ? "md:justify-center md:px-0" : ""}`}
                    onClick={() => setActiveView(item.id)}
                  >
                    <span className={isActive ? "text-blue-200" : "text-white/45 group-hover:text-blue-200"}>{item.icon}</span>
                    <span className={`${collapsed ? "md:hidden" : ""} min-w-0 text-left`}>
                      <span className="block truncate text-sm font-medium">{item.label}</span>
                      <span className="hidden truncate text-[10px] font-normal text-white/35 md:block">{item.description}</span>
                    </span>
                  </Button>
                );

                return collapsed ? (
                  <Tooltip key={item.id}>
                    <TooltipTrigger asChild>{btn}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                ) : (
                  btn
                );
              })}
            </div>

            <div className="hidden border-t border-white/10 p-3 md:block">
              <Button
                variant="ghost"
                size="icon"
                className="w-full rounded-xl text-white/45 hover:bg-white/[0.05] hover:text-white"
                aria-label={collapsed ? "Expand Command Center navigation" : "Collapse Command Center navigation"}
                aria-expanded={!collapsed}
                onClick={() => setCollapsed(!collapsed)}
              >
                {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </Button>
            </div>
          </aside>

          <section aria-label="Command Center content" className="min-w-0 flex-1 overflow-y-auto pb-24 md:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"
              >
                <ActiveComponent onNavigate={(view) => setActiveView(view as View)} />
              </motion.div>
            </AnimatePresence>
          </section>
        </div>

        <nav aria-label="Mobile Command Center navigation" className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-blue-300/15 bg-[#020714]/92 p-1.5 shadow-2xl backdrop-blur-2xl md:hidden">
          <div className="grid grid-cols-5 gap-1">
            {SIDEBAR_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  aria-pressed={isActive}
                  onClick={() => setActiveView(item.id)}
                  className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] transition-colors ${
                    isActive ? "bg-blue-400/12 text-blue-100" : "text-white/40 hover:bg-white/[0.04] hover:text-white"
                  }`}
                >
                  {item.icon}
                  <span>{item.label === "Marketplace" ? "Market" : item.label.replace("MCP Tools", "Tools")}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  );
}
