import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Wrench, Store, Settings, Activity, ArrowRight } from "lucide-react";

interface Props {
  onNavigate: (view: "agents" | "mcp" | "marketplace" | "settings") => void;
}

const stats = [
  { label: "Active Agents", value: "—", icon: <Bot className="h-5 w-5" />, view: "agents" as const },
  { label: "MCP Tools", value: "—", icon: <Wrench className="h-5 w-5" />, view: "mcp" as const },
  { label: "Templates", value: "—", icon: <Store className="h-5 w-5" />, view: "marketplace" as const },
  { label: "API Keys", value: "—", icon: <Settings className="h-5 w-5" />, view: "settings" as const },
];

const services = [
  { name: "Database", status: "operational" },
  { name: "Authentication", status: "operational" },
  { name: "Edge Functions", status: "operational" },
  { name: "MCP Gateway", status: "unknown" },
];

export default function CommandCenterOverview({ onNavigate }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Command Center</h2>
        <p className="text-muted-foreground mt-1">
          Unified control hub for agents, tools, and infrastructure
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card
            key={s.label}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => onNavigate(s.view)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-muted-foreground">{s.icon}</span>
                <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onNavigate("agents")}>
            <Bot className="h-4 w-4 mr-2" /> Manage Agents
          </Button>
          <Button variant="outline" onClick={() => onNavigate("mcp")}>
            <Wrench className="h-4 w-4 mr-2" /> Explore MCP Tools
          </Button>
          <Button variant="outline" onClick={() => onNavigate("marketplace")}>
            <Store className="h-4 w-4 mr-2" /> Browse Marketplace
          </Button>
          <Button variant="outline" onClick={() => onNavigate("settings")}>
            <Settings className="h-4 w-4 mr-2" /> Configure Settings
          </Button>
        </div>
      </div>

      {/* System Health */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Activity className="h-5 w-5" /> System Health
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {services.map((svc) => (
            <Card key={svc.name}>
              <CardContent className="py-4 flex items-center justify-between">
                <span className="text-sm font-medium">{svc.name}</span>
                <Badge
                  variant={svc.status === "operational" ? "default" : "secondary"}
                  className="text-[10px]"
                >
                  {svc.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
