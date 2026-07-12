import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Wrench,
  Store,
  Settings,
  Activity,
  ArrowUpRight,
  BrainCircuit,
  ShieldCheck,
  Database,
  Workflow,
  Sparkles,
} from "lucide-react";

interface Props {
  onNavigate: (view: "agents" | "mcp" | "marketplace" | "settings") => void;
}

const stats = [
  {
    label: "AI Workforce",
    value: "Ready",
    detail: "Agents available for orchestration",
    icon: Bot,
    view: "agents" as const,
  },
  {
    label: "Capability Layer",
    value: "Connected",
    detail: "MCP tools and integrations",
    icon: Wrench,
    view: "mcp" as const,
  },
  {
    label: "Intelligence Catalog",
    value: "Live",
    detail: "Templates and deployable systems",
    icon: Store,
    view: "marketplace" as const,
  },
  {
    label: "Control Plane",
    value: "Protected",
    detail: "Settings, access and governance",
    icon: Settings,
    view: "settings" as const,
  },
];

const services = [
  { name: "Database", status: "operational", icon: Database },
  { name: "Authentication", status: "operational", icon: ShieldCheck },
  { name: "Orchestration", status: "operational", icon: Workflow },
  { name: "MCP Gateway", status: "observing", icon: Activity },
];

const priorities = [
  { title: "Deploy an AI specialist", description: "Create or activate an agent for a focused business outcome.", view: "agents" as const, icon: Bot },
  { title: "Connect a new capability", description: "Expand the operating system with an MCP tool or integration.", view: "mcp" as const, icon: Wrench },
  { title: "Launch from a proven template", description: "Start with a reusable workflow, agent or automation package.", view: "marketplace" as const, icon: Sparkles },
];

export default function CommandCenterOverview({ onNavigate }: Props) {
  return (
    <div className="space-y-8">
      <section className="d3-chrome-panel overflow-hidden rounded-3xl border border-blue-300/15 p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
          <div>
            <div className="d3-system-status">D3 Core synchronized</div>
            <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Operate the company from one intelligent control plane.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/55 sm:text-base">
              Coordinate agents, tools, workflows, knowledge and governance without losing sight of what the system is doing or what happens next.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => onNavigate("agents")} className="min-h-11 rounded-xl px-5">
                <Bot className="mr-2 h-4 w-4" /> Open AI Workforce
              </Button>
              <Button variant="outline" onClick={() => onNavigate("mcp")} className="min-h-11 rounded-xl border-white/15 bg-white/[0.03] px-5 text-white hover:bg-white/[0.07]">
                <Wrench className="mr-2 h-4 w-4" /> Manage Capabilities
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-300/15 bg-black/25 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-white/40">Operational posture</p>
                <p className="mt-2 text-2xl font-semibold text-white">Stable</p>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.08]">
                <BrainCircuit className="h-6 w-6 text-emerald-300" aria-hidden="true" />
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div className="h-full w-[86%] rounded-full bg-gradient-to-r from-blue-500 via-cyan-300 to-emerald-300" />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-white/40">
              <span>Core readiness</span>
              <span className="font-medium text-white/70">86%</span>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="operating-domains-heading">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-blue-200/55">Operating domains</p>
            <h2 id="operating-domains-heading" className="mt-1 text-xl font-semibold text-white">Your command surfaces</h2>
          </div>
          <span className="hidden text-xs text-white/35 sm:block">Select a domain to continue</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, detail, icon: Icon, view }) => (
            <button key={label} type="button" onClick={() => onNavigate(view)} className="group text-left">
              <Card className="h-full rounded-2xl border-white/10 bg-white/[0.025] transition-all duration-200 group-hover:-translate-y-1 group-hover:border-blue-300/25 group-hover:bg-blue-400/[0.05] group-hover:shadow-[0_20px_50px_rgba(0,20,60,0.24)]">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="grid h-10 w-10 place-items-center rounded-xl border border-blue-300/15 bg-blue-400/[0.07]">
                      <Icon className="h-5 w-5 text-blue-200" aria-hidden="true" />
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-white/25 transition-colors group-hover:text-blue-200" aria-hidden="true" />
                  </div>
                  <p className="mt-5 text-lg font-semibold text-white">{value}</p>
                  <p className="mt-1 text-sm font-medium text-white/75">{label}</p>
                  <p className="mt-2 text-xs leading-5 text-white/40">{detail}</p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="d3-chrome-panel rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-blue-200/55">Priority actions</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Move the system forward</h2>
            </div>
            <Sparkles className="h-5 w-5 text-blue-200/70" aria-hidden="true" />
          </div>
          <div className="space-y-3">
            {priorities.map(({ title, description, view, icon: Icon }, index) => (
              <button
                key={title}
                type="button"
                onClick={() => onNavigate(view)}
                className="group flex min-h-20 w-full items-center gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-left transition-colors hover:border-blue-300/25 hover:bg-blue-400/[0.05]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-blue-200">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-white/40">{description}</span>
                </span>
                <span className="text-xs font-mono text-white/20">0{index + 1}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-white/25 group-hover:text-blue-200" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        <div className="d3-chrome-panel rounded-2xl p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Activity className="h-5 w-5 text-emerald-300" aria-hidden="true" />
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-blue-200/55">System health</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Live service posture</h2>
            </div>
          </div>
          <div className="space-y-3">
            {services.map(({ name, status, icon: Icon }) => (
              <div key={name} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-blue-200/75" aria-hidden="true" />
                  <span className="text-sm font-medium text-white/75">{name}</span>
                </div>
                <Badge
                  variant="secondary"
                  className={status === "operational" ? "border border-emerald-300/15 bg-emerald-400/[0.08] text-emerald-200" : "border border-amber-300/15 bg-amber-400/[0.08] text-amber-200"}
                >
                  {status}
                </Badge>
              </div>
            ))}
          </div>
          <Button variant="ghost" onClick={() => onNavigate("settings")} className="mt-4 w-full justify-between rounded-xl text-white/55 hover:bg-white/[0.04] hover:text-white">
            Review platform configuration <ArrowUpRight className="h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
