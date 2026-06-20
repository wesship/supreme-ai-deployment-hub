import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Bot,
  Wrench,
  Store,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import CommandCenterOverview from "@/components/command-center/CommandCenterOverview";
import CommandCenterAgents from "@/components/command-center/CommandCenterAgents";
import CommandCenterMcp from "@/components/command-center/CommandCenterMcp";
import CommandCenterMarketplace from "@/components/command-center/CommandCenterMarketplace";
import CommandCenterSettings from "@/components/command-center/CommandCenterSettings";
import D3vonnPageBanner from "@/components/index/D3vonnPageBanner";

type View = "overview" | "agents" | "mcp" | "marketplace" | "settings";

const SIDEBAR_ITEMS: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard className="h-5 w-5" /> },
  { id: "agents", label: "Agents", icon: <Bot className="h-5 w-5" /> },
  { id: "mcp", label: "MCP Tools", icon: <Wrench className="h-5 w-5" /> },
  { id: "marketplace", label: "Marketplace", icon: <Store className="h-5 w-5" /> },
  { id: "settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
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

  return (
    <TooltipProvider delayDuration={0}>
      <D3vonnPageBanner title="Command Center" />
      <div className="min-h-screen bg-background flex">
        {/* Sidebar */}
        <aside
          className={`sticky top-16 h-[calc(100vh-4rem)] border-r border-border bg-card/50 flex flex-col transition-all duration-300 ${
            collapsed ? "w-16" : "w-56"
          }`}
        >
          <div className="flex-1 py-4 space-y-1 px-2">
            {SIDEBAR_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              const btn = (
                <Button
                  key={item.id}
                  variant={isActive ? "secondary" : "ghost"}
                  className={`w-full justify-start gap-3 ${collapsed ? "px-0 justify-center" : ""}`}
                  onClick={() => setActiveView(item.id)}
                >
                  {item.icon}
                  {!collapsed && <span className="truncate">{item.label}</span>}
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

          <div className="p-2 border-t border-border">
            <Button
              variant="ghost"
              size="icon"
              className="w-full"
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="p-6 max-w-7xl mx-auto"
            >
              <ActiveComponent onNavigate={(v) => setActiveView(v as View)} />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </TooltipProvider>
  );
}
