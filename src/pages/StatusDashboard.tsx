/**
 * StatusDashboard — Enterprise-grade system status page for D3VONN.IO.
 * Shows real-time health of all production services: Frontend, API,
 * Supabase, Redis/Queue, AI Providers, and Hermes Orchestration.
 */
import { motion, AnimatePresence } from "framer-motion";
import { Helmet } from "react-helmet-async";
import { useEffect, useState } from "react";
import {
  Activity,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  Loader2,
  Server,
  Globe,
  Shield,
} from "lucide-react";
import { useServiceHealth, type ServiceEndpoint, type ServiceStatus } from "@/hooks/useServiceHealth";
import D3vonnPageBanner from "@/components/index/D3vonnPageBanner";

// ── Status color helpers ─────────────────────────────────────────────────────

const statusColor = (s: ServiceStatus["status"]) => {
  switch (s) {
    case "online": return "text-emerald-400";
    case "offline": return "text-red-400";
    case "degraded": return "text-yellow-400";
    case "checking": return "text-blue-400";
    default: return "text-gray-400";
  }
};

const statusBg = (s: ServiceStatus["status"]) => {
  switch (s) {
    case "online": return "bg-emerald-500/10 border-emerald-500/30";
    case "offline": return "bg-red-500/10 border-red-500/30";
    case "degraded": return "bg-yellow-500/10 border-yellow-500/30";
    case "checking": return "bg-blue-500/10 border-blue-500/30";
    default: return "bg-gray-500/10 border-gray-500/30";
  }
};

const statusIcon = (s: ServiceStatus["status"]) => {
  switch (s) {
    case "online": return <CheckCircle2 className="h-5 w-5 text-emerald-400" />;
    case "offline": return <XCircle className="h-5 w-5 text-red-400" />;
    case "degraded": return <AlertTriangle className="h-5 w-5 text-yellow-400" />;
    case "checking": return <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />;
    default: return <Clock className="h-5 w-5 text-gray-400" />;
  }
};

const categoryLabel = (cat: ServiceEndpoint["category"]) => {
  switch (cat) {
    case "frontend": return "Frontend";
    case "api": return "API";
    case "database": return "Database";
    case "queue": return "Queue";
    case "ai": return "AI Provider";
    case "orchestration": return "Orchestration";
    default: return "Service";
  }
};

type PublicStatusData = {
  components: Array<{ id: string; name: string; description: string; status: string; uptime_30d: number; updated_at: string }>;
  incidents: Array<{ id: string; title: string; impact: string; status: string; started_at: string; resolved_at?: string | null; updated_at: string }>;
  maintenance: Array<{ id: string; title: string; description?: string | null; status: string; starts_at: string; ends_at: string }>;
};

const ASSURANCE_API = import.meta.env.VITE_API_URL || "https://api.d3vonn.io";

// ── Component ────────────────────────────────────────────────────────────────

export default function StatusDashboard() {
  const {
    endpoints,
    statuses,
    isChecking,
    checkAll,
    lastSuccessfulExecution,
  } = useServiceHealth();
  const [history, setHistory] = useState<PublicStatusData>({ components: [], incidents: [], maintenance: [] });
  const [subscription, setSubscription] = useState({ email: "", webhook_url: "" });
  const [subscriptionMessage, setSubscriptionMessage] = useState("");

  const loadHistory = async () => {
    try {
      const response = await fetch(`${ASSURANCE_API}/api/assurance/public/status`);
      if (response.ok) setHistory(await response.json());
    } catch {
      // Core health information remains available if the assurance API is briefly unavailable.
    }
  };

  useEffect(() => { void loadHistory(); }, []);

  const subscribe = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubscriptionMessage("Submitting subscription request…");
    try {
      const response = await fetch(`${ASSURANCE_API}/api/assurance/public/status-subscriptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: subscription.email || undefined, webhook_url: subscription.webhook_url || undefined }),
      });
      const body = await response.json();
      setSubscriptionMessage(response.ok ? body.message : body.detail || "Subscription could not be completed.");
    } catch {
      setSubscriptionMessage("Subscription service is temporarily unavailable.");
    }
  };

  const onlineCount = Object.values(statuses).filter((s) => s.status === "online").length;
  const offlineCount = Object.values(statuses).filter((s) => s.status === "offline").length;
  const degradedCount = Object.values(statuses).filter((s) => s.status === "degraded").length;
  const totalChecked = Object.values(statuses).filter((s) => s.status !== "checking").length;

  const avgLatency = (() => {
    const latencies = Object.values(statuses)
      .filter((s) => s.latency !== null)
      .map((s) => s.latency!);
    return latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;
  })();

  const overallStatus = offlineCount > 0
    ? "partial_outage"
    : degradedCount > 0
    ? "degraded"
    : totalChecked === endpoints.length && onlineCount === endpoints.length
    ? "operational"
    : "checking";

  const overallLabel = {
    operational: "All Systems Operational",
    degraded: "Performance Degraded",
    partial_outage: "Partial System Outage",
    checking: "Checking Systems...",
  }[overallStatus];

  const overallColor = {
    operational: "text-emerald-400 border-emerald-500/40 bg-emerald-500/5",
    degraded: "text-yellow-400 border-yellow-500/40 bg-yellow-500/5",
    partial_outage: "text-red-400 border-red-500/40 bg-red-500/5",
    checking: "text-blue-400 border-blue-500/40 bg-blue-500/5",
  }[overallStatus];

  return (
    <div className="d3-os-shell min-h-screen text-white">
      <Helmet>
        <title>System Status — D3VONN.IO</title>
        <meta name="description" content="Real-time system status for D3VONN.IO platform services." />
      </Helmet>

      <D3vonnPageBanner title="Infrastructure & System Health" />

      <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Overall Status Banner */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          role="status" aria-live="polite" className={`d3-chrome-panel rounded-2xl border p-5 sm:p-6 mb-8 ${overallColor}`}
        >
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              {overallStatus === "operational" && <CheckCircle2 className="h-6 w-6" />}
              {overallStatus === "degraded" && <AlertTriangle className="h-6 w-6" />}
              {overallStatus === "partial_outage" && <XCircle className="h-6 w-6" />}
              {overallStatus === "checking" && <Loader2 className="h-6 w-6 animate-spin" />}
              <div>
                <h2 className="text-xl font-bold">{overallLabel}</h2>
                <p className="text-sm opacity-70 mt-0.5">
                  {onlineCount}/{endpoints.length} services responding
                </p>
              </div>
            </div>
            <button
              onClick={() => { void checkAll(); void loadHistory(); }}
              disabled={isChecking}
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm font-medium hover:bg-white/10 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
              {isChecking ? "Checking..." : "Refresh"}
            </button>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard icon={<Server className="h-5 w-5" />} label="Total Services" value={endpoints.length} />
          <SummaryCard icon={<Wifi className="h-5 w-5 text-emerald-400" />} label="Online" value={onlineCount} accent="emerald" />
          <SummaryCard icon={<WifiOff className="h-5 w-5 text-red-400" />} label="Offline" value={offlineCount} accent="red" />
          <SummaryCard icon={<Activity className="h-5 w-5 text-blue-400" />} label="Avg Latency" value={`${avgLatency}ms`} accent="blue" />
        </div>

        {/* Service List */}
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {endpoints.map((ep) => {
              const status = statuses[ep.id];
              return (
                <motion.div
                  key={ep.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  layout
                  className={`d3-chrome-panel rounded-xl border p-4 transition-all ${
                    status ? statusBg(status.status) : "bg-white/[0.02] border-white/10"
                  }`}
                >
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    {/* Icon */}
                    <div className="text-2xl shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-white/5">
                      {ep.icon}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white text-sm">{ep.name}</h3>
                        <span className="text-[10px] uppercase tracking-wider text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                          {categoryLabel(ep.category)}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 mt-0.5">{ep.description}</p>
                      {status?.details && (
                        <p className="text-xs text-emerald-400/70 mt-0.5">{status.details}</p>
                      )}
                    </div>

                    {/* Status */}
                    <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start sm:shrink-0">
                      {status?.latency !== null && status?.latency !== undefined && (
                        <span className={`text-xs font-mono ${
                          status.latency < 200 ? "text-emerald-400" :
                          status.latency < 500 ? "text-yellow-400" :
                          "text-red-400"
                        }`}>
                          {status.latency}ms
                        </span>
                      )}
                      <div className="flex items-center gap-1.5">
                        {status ? statusIcon(status.status) : <Clock className="h-5 w-5 text-gray-500" />}
                        <span className={`text-xs font-medium uppercase tracking-wider ${
                          status ? statusColor(status.status) : "text-gray-500"
                        }`}>
                          {status?.status ?? "pending"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Error message */}
                  {status?.error && (
                    <div className="mt-2 ml-14 text-xs text-red-400/80">
                      {status.error}
                    </div>
                  )}

                  {/* Last checked */}
                  {status?.lastChecked && (
                    <div className="mt-2 ml-14 text-[10px] text-white/30">
                      Last checked: {status.lastChecked.toLocaleTimeString()}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <section className="mt-10 grid gap-6 lg:grid-cols-2" aria-label="Operational history and planned maintenance">
          <div className="d3-chrome-panel rounded-2xl border border-white/10 p-5">
            <h2 className="text-lg font-semibold">Incident history</h2>
            <p className="mt-1 text-sm text-white/55">Resolved and active service notices published by the reliability team.</p>
            <div className="mt-4 space-y-3">{history.incidents.length ? history.incidents.map((incident) => <div key={incident.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center justify-between gap-2"><span className="font-medium">{incident.title}</span><span className="text-xs uppercase tracking-wide text-white/55">{incident.status.replace('_', ' ')}</span></div><p className="mt-1 text-xs text-white/45">{new Date(incident.started_at).toLocaleString()} · {incident.impact} impact</p></div>) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/50">No incidents have been published.</p>}</div>
          </div>
          <div className="d3-chrome-panel rounded-2xl border border-white/10 p-5">
            <h2 className="text-lg font-semibold">Planned maintenance</h2>
            <p className="mt-1 text-sm text-white/55">Maintenance windows are published here before work begins.</p>
            <div className="mt-4 space-y-3">{history.maintenance.length ? history.maintenance.map((window) => <div key={window.id} className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="flex items-center justify-between gap-2"><span className="font-medium">{window.title}</span><span className="text-xs uppercase tracking-wide text-white/55">{window.status}</span></div><p className="mt-1 text-xs text-white/45">{new Date(window.starts_at).toLocaleString()} – {new Date(window.ends_at).toLocaleString()}</p>{window.description && <p className="mt-2 text-sm text-white/65">{window.description}</p>}</div>) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/50">No planned maintenance is currently scheduled.</p>}</div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2" aria-label="Component uptime and status subscriptions">
          <div className="d3-chrome-panel rounded-2xl border border-white/10 p-5"><h2 className="text-lg font-semibold">30-day component uptime</h2><div className="mt-4 space-y-3">{history.components.length ? history.components.map((component) => <div key={component.id} className="flex items-center justify-between border-b border-white/10 pb-3 text-sm"><span>{component.name}</span><span className="font-mono text-emerald-300">{Number(component.uptime_30d).toFixed(2)}%</span></div>) : <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/50">Uptime history will appear after the first scheduled health aggregation.</p>}</div></div>
          <form onSubmit={subscribe} className="d3-chrome-panel rounded-2xl border border-white/10 p-5"><h2 className="text-lg font-semibold">Subscribe to status updates</h2><p className="mt-1 text-sm text-white/55">Use an email address or an HTTPS webhook endpoint. Webhooks are challenge-verified and signed.</p><div className="mt-4 space-y-3"><label className="block text-sm"><span className="mb-1 block text-white/65">Email</span><input value={subscription.email} onChange={(event) => setSubscription({ email: event.target.value, webhook_url: "" })} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2" type="email" placeholder="ops@example.com" /></label><label className="block text-sm"><span className="mb-1 block text-white/65">or HTTPS webhook</span><input value={subscription.webhook_url} onChange={(event) => setSubscription({ email: "", webhook_url: event.target.value })} className="w-full rounded-lg border border-white/15 bg-black/20 px-3 py-2" type="url" placeholder="https://example.com/status" /></label><button className="rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-300/20">Subscribe</button>{subscriptionMessage && <p role="status" className="text-xs text-white/60">{subscriptionMessage}</p>}</div></form>
        </section>

        {/* Last Successful Execution */}
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-white/40" />
            <div>
              <h3 className="text-sm font-medium text-white/80">Last Successful Full Check</h3>
              <p className="text-xs text-white/40 mt-0.5">
                {lastSuccessfulExecution
                  ? `All services operational at ${lastSuccessfulExecution.toLocaleString()}`
                  : "Waiting for first complete check..."}
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-white/30 space-y-1">
          <p>Use Refresh for a new on-demand health snapshot.</p>
          <p>For incident reports, contact <a href="mailto:support@d3vonn.io" className="text-blue-400/60 hover:text-blue-400">support@d3vonn.io</a></p>
        </div>
      </div>
    </div>
  );
}

// ── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div className="d3-chrome-panel rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[10px] uppercase tracking-wider text-white/50">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${
        accent === "emerald" ? "text-emerald-400" :
        accent === "red" ? "text-red-400" :
        accent === "blue" ? "text-blue-400" :
        "text-white"
      }`}>
        {value}
      </div>
    </div>
  );
}
