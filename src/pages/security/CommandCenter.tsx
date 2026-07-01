/**
 * D3VONN Executive Command Center
 *
 * Full-featured security operations dashboard with:
 * - Real-time platform health
 * - Agent workforce status
 * - Threat landscape overview
 * - MITRE ATT&CK coverage
 * - Risk heatmap
 * - Chaos testing results
 * - Digital twin topology
 * - Compliance posture
 * - Executive KPIs (MTTD, MTTR, resolution rate)
 */

import React, { useState, useEffect } from "react";
import {
  Shield,
  Activity,
  AlertTriangle,
  Users,
  Server,
  Zap,
  Eye,
  Lock,
  Globe,
  Target,
  Cpu,
  BarChart3,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  Network,
  FlaskConical,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

const API_BASE = import.meta.env.VITE_API_URL || "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlatformHealth {
  total_services: number;
  healthy: number;
  degraded: number;
  unhealthy: number;
  overall_health: string;
}

interface AgentStatus {
  id: string;
  name: string;
  status: "active" | "idle" | "error";
  last_action: string;
  actions_24h: number;
}

interface SecurityMetrics {
  total_events: number;
  total_alerts: number;
  critical_alerts: number;
  open_incidents: number;
  mttd_hours: number;
  mttr_hours: number;
  resolution_rate: number;
  false_positive_rate: number;
  agent_automation_rate: number;
}

interface ChaosResult {
  name: string;
  passed: boolean;
  completed_at: string;
}

// ─── Mock Data (replaced by API calls in production) ──────────────────────────

const mockPlatformHealth: PlatformHealth = {
  total_services: 12,
  healthy: 10,
  degraded: 1,
  unhealthy: 1,
  overall_health: "degraded",
};

const mockAgents: AgentStatus[] = [
  { id: "soc_commander", name: "SOC Commander", status: "active", last_action: "Escalated incident", actions_24h: 15 },
  { id: "sentinel", name: "Sentinel", status: "active", last_action: "Analyzed 2.4k events", actions_24h: 48 },
  { id: "guardian", name: "Guardian", status: "active", last_action: "Flagged impossible travel", actions_24h: 7 },
  { id: "hunter", name: "Hunter", status: "idle", last_action: "Completed hunt H003", actions_24h: 3 },
  { id: "oracle", name: "Oracle", status: "active", last_action: "Enriched 12 IOCs", actions_24h: 22 },
  { id: "analyst", name: "Analyst", status: "active", last_action: "Generated timeline", actions_24h: 9 },
  { id: "engineer", name: "Engineer", status: "idle", last_action: "Proposed remediation", actions_24h: 4 },
  { id: "compliance", name: "Compliance", status: "active", last_action: "SOC2 assessment", actions_24h: 2 },
  { id: "detection_eng", name: "Detection Engineer", status: "active", last_action: "Tuned rule DET-007", actions_24h: 6 },
  { id: "incident_cmd", name: "Incident Commander", status: "idle", last_action: "Closed INC-042", actions_24h: 1 },
  { id: "forensics", name: "Forensics Analyst", status: "idle", last_action: "Evidence preserved", actions_24h: 2 },
  { id: "vuln_analyst", name: "Vulnerability Analyst", status: "active", last_action: "Assessed CVE-2026-1234", actions_24h: 8 },
];

const mockMetrics: SecurityMetrics = {
  total_events: 24680,
  total_alerts: 142,
  critical_alerts: 3,
  open_incidents: 2,
  mttd_hours: 1.8,
  mttr_hours: 6.2,
  resolution_rate: 94.5,
  false_positive_rate: 8.3,
  agent_automation_rate: 72.0,
};

const mockMitreCoverage = [
  { tactic: "Initial Access", coverage: 85 },
  { tactic: "Execution", coverage: 60 },
  { tactic: "Persistence", coverage: 75 },
  { tactic: "Priv Escalation", coverage: 90 },
  { tactic: "Defense Evasion", coverage: 45 },
  { tactic: "Credential Access", coverage: 95 },
  { tactic: "Discovery", coverage: 50 },
  { tactic: "Lateral Movement", coverage: 55 },
  { tactic: "Collection", coverage: 40 },
  { tactic: "Exfiltration", coverage: 70 },
  { tactic: "C2", coverage: 35 },
  { tactic: "Impact", coverage: 80 },
];

const mockTrendData = [
  { day: "Mon", events: 3200, alerts: 18, incidents: 0 },
  { day: "Tue", events: 4100, alerts: 24, incidents: 1 },
  { day: "Wed", events: 3800, alerts: 21, incidents: 0 },
  { day: "Thu", events: 5200, alerts: 32, incidents: 2 },
  { day: "Fri", events: 4600, alerts: 28, incidents: 1 },
  { day: "Sat", events: 2100, alerts: 9, incidents: 0 },
  { day: "Sun", events: 1680, alerts: 10, incidents: 0 },
];

const mockComplianceScores = [
  { framework: "SOC2", score: 87 },
  { framework: "ISO27001", score: 72 },
  { framework: "NIST CSF", score: 81 },
  { framework: "PCI DSS", score: 65 },
  { framework: "HIPAA", score: 78 },
];

const mockChaosResults: ChaosResult[] = [
  { name: "Brute Force Detection", passed: true, completed_at: "2026-06-30T10:00:00Z" },
  { name: "Privilege Escalation", passed: true, completed_at: "2026-06-30T10:05:00Z" },
  { name: "Agent Response Time", passed: true, completed_at: "2026-06-30T10:10:00Z" },
  { name: "Incident Escalation", passed: false, completed_at: "2026-06-30T10:15:00Z" },
  { name: "SOAR Playbook", passed: true, completed_at: "2026-06-30T10:20:00Z" },
  { name: "Alert Pipeline Latency", passed: true, completed_at: "2026-06-30T10:25:00Z" },
  { name: "Impossible Travel", passed: true, completed_at: "2026-06-30T10:30:00Z" },
];

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#6366f1", "#8b5cf6"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommandCenter() {
  const [activeTab, setActiveTab] = useState<"overview" | "agents" | "threats" | "chaos" | "compliance">("overview");
  const [metrics, setMetrics] = useState<SecurityMetrics>(mockMetrics);
  const [platformHealth, setPlatformHealth] = useState<PlatformHealth>(mockPlatformHealth);
  const [agents, setAgents] = useState<AgentStatus[]>(mockAgents);

  // In production, fetch from API
  useEffect(() => {
    // fetch(`${API_BASE}/api/security/v2/metrics`).then(...)
  }, []);

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "agents" as const, label: "Agent Workforce", icon: Cpu },
    { id: "threats" as const, label: "Threat Landscape", icon: Target },
    { id: "chaos" as const, label: "Chaos Testing", icon: FlaskConical },
    { id: "compliance" as const, label: "Compliance", icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-emerald-400" />
          <div>
            <h1 className="text-2xl font-bold">D3VONN Command Center</h1>
            <p className="text-gray-400 text-sm">Executive Security Operations Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            platformHealth.overall_health === "healthy" ? "bg-emerald-900/50 text-emerald-400" :
            platformHealth.overall_health === "degraded" ? "bg-amber-900/50 text-amber-400" :
            "bg-red-900/50 text-red-400"
          }`}>
            <Activity className="w-4 h-4" />
            Platform: {platformHealth.overall_health.toUpperCase()}
          </div>
          <div className="text-gray-500 text-sm">
            {new Date().toLocaleString()}
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KPICard label="Events (24h)" value={metrics.total_events.toLocaleString()} icon={Activity} />
        <KPICard label="Alerts" value={metrics.total_alerts.toString()} icon={AlertTriangle} color="amber" />
        <KPICard label="Critical" value={metrics.critical_alerts.toString()} icon={Zap} color="red" />
        <KPICard label="Open Incidents" value={metrics.open_incidents.toString()} icon={Eye} color="purple" />
        <KPICard label="MTTD" value={`${metrics.mttd_hours}h`} icon={Clock} trend="down" />
        <KPICard label="MTTR" value={`${metrics.mttr_hours}h`} icon={Clock} trend="down" />
        <KPICard label="Resolution" value={`${metrics.resolution_rate}%`} icon={CheckCircle} color="emerald" />
        <KPICard label="Automation" value={`${metrics.agent_automation_rate}%`} icon={Cpu} color="blue" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-gray-800 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && <OverviewTab metrics={metrics} />}
      {activeTab === "agents" && <AgentsTab agents={agents} />}
      {activeTab === "threats" && <ThreatsTab />}
      {activeTab === "chaos" && <ChaosTab />}
      {activeTab === "compliance" && <ComplianceTab />}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ label, value, icon: Icon, color = "gray", trend }: {
  label: string; value: string; icon: any; color?: string; trend?: "up" | "down";
}) {
  const colorMap: Record<string, string> = {
    gray: "text-gray-300",
    amber: "text-amber-400",
    red: "text-red-400",
    purple: "text-purple-400",
    emerald: "text-emerald-400",
    blue: "text-blue-400",
  };

  return (
    <div className="bg-gray-900 rounded-lg p-3 border border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <Icon className={`w-4 h-4 ${colorMap[color]}`} />
        {trend && (
          trend === "down"
            ? <TrendingDown className="w-3 h-3 text-emerald-400" />
            : <TrendingUp className="w-3 h-3 text-red-400" />
        )}
      </div>
      <div className={`text-lg font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

function OverviewTab({ metrics }: { metrics: SecurityMetrics }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Event Trend */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Event & Alert Trend (7 days)</h3>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={mockTrendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="day" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }} />
            <Area type="monotone" dataKey="events" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} name="Events" />
            <Area type="monotone" dataKey="alerts" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} name="Alerts" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* MITRE Coverage Radar */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">MITRE ATT&CK Coverage</h3>
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={mockMitreCoverage}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey="tactic" stroke="#6b7280" fontSize={10} />
            <PolarRadiusAxis stroke="#374151" domain={[0, 100]} />
            <Radar name="Coverage" dataKey="coverage" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Platform Services Health */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Platform Health</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-emerald-400">{mockPlatformHealth.healthy}</div>
            <div className="text-xs text-gray-500">Healthy</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-amber-400">{mockPlatformHealth.degraded}</div>
            <div className="text-xs text-gray-500">Degraded</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-red-400">{mockPlatformHealth.unhealthy}</div>
            <div className="text-xs text-gray-500">Unhealthy</div>
          </div>
        </div>
        <div className="mt-4 h-3 bg-gray-800 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 h-full" style={{ width: `${(mockPlatformHealth.healthy / mockPlatformHealth.total_services) * 100}%` }} />
          <div className="bg-amber-500 h-full" style={{ width: `${(mockPlatformHealth.degraded / mockPlatformHealth.total_services) * 100}%` }} />
          <div className="bg-red-500 h-full" style={{ width: `${(mockPlatformHealth.unhealthy / mockPlatformHealth.total_services) * 100}%` }} />
        </div>
      </div>

      {/* Risk Score Distribution */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Risk Score Distribution</h3>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={[
            { range: "0-20", count: 45 },
            { range: "21-40", count: 28 },
            { range: "41-60", count: 15 },
            { range: "61-80", count: 8 },
            { range: "81-100", count: 3 },
          ]}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="range" stroke="#6b7280" fontSize={12} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }} />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function AgentsTab({ agents }: { agents: AgentStatus[] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <div key={agent.id} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-400" />
                <span className="font-medium text-sm">{agent.name}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                agent.status === "active" ? "bg-emerald-900/50 text-emerald-400" :
                agent.status === "idle" ? "bg-gray-800 text-gray-400" :
                "bg-red-900/50 text-red-400"
              }`}>
                {agent.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 mb-2">Last: {agent.last_action}</div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Actions (24h)</span>
              <span className="text-sm font-medium text-indigo-300">{agent.actions_24h}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Agent Performance */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Agent Actions (7 days)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={agents.slice(0, 8).map(a => ({ name: a.name.split(" ")[0], actions: a.actions_24h * 7 }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="name" stroke="#6b7280" fontSize={11} />
            <YAxis stroke="#6b7280" fontSize={12} />
            <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }} />
            <Bar dataKey="actions" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ThreatsTab() {
  const topActors = [
    { actor: "203.0.113.42", events: 847, severity: "critical" },
    { actor: "attacker@phish.io", events: 234, severity: "high" },
    { actor: "198.51.100.7", events: 189, severity: "high" },
    { actor: "scanner@botnet.ru", events: 156, severity: "medium" },
    { actor: "10.0.0.99", events: 98, severity: "medium" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top Threat Actors */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Top Threat Actors</h3>
        <div className="space-y-3">
          {topActors.map((actor, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-gray-600 text-xs w-4">{i + 1}</span>
                <span className="text-sm font-mono">{actor.actor}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{actor.events} events</span>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  actor.severity === "critical" ? "bg-red-900/50 text-red-400" :
                  actor.severity === "high" ? "bg-amber-900/50 text-amber-400" :
                  "bg-gray-800 text-gray-400"
                }`}>
                  {actor.severity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Attack Vector Distribution */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Attack Vectors</h3>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={[
                { name: "Credential Abuse", value: 42 },
                { name: "API Exploitation", value: 28 },
                { name: "Privilege Escalation", value: 15 },
                { name: "Data Exfiltration", value: 10 },
                { name: "Other", value: 5 },
              ]}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              labelLine={false}
            >
              {COLORS.map((color, index) => (
                <Cell key={index} fill={color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* IOC Feed Status */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800 lg:col-span-2">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Threat Intelligence Feeds</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { name: "Internal IOC DB", indicators: 1247, status: "active", lastSync: "2m ago" },
            { name: "TAXII Feed Alpha", indicators: 8432, status: "active", lastSync: "15m ago" },
            { name: "GitHub Advisory", indicators: 342, status: "active", lastSync: "1h ago" },
            { name: "Community STIX", indicators: 5621, status: "stale", lastSync: "6h ago" },
          ].map((feed, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{feed.name}</span>
                <span className={`w-2 h-2 rounded-full ${feed.status === "active" ? "bg-emerald-400" : "bg-amber-400"}`} />
              </div>
              <div className="text-xs text-gray-500">{feed.indicators.toLocaleString()} indicators</div>
              <div className="text-xs text-gray-600">Synced {feed.lastSync}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChaosTab() {
  const passCount = mockChaosResults.filter(r => r.passed).length;
  const totalCount = mockChaosResults.length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-center">
          <div className="text-2xl font-bold text-indigo-400">{totalCount}</div>
          <div className="text-xs text-gray-500">Experiments Run</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-center">
          <div className="text-2xl font-bold text-emerald-400">{passCount}</div>
          <div className="text-xs text-gray-500">Passed</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-center">
          <div className="text-2xl font-bold text-red-400">{totalCount - passCount}</div>
          <div className="text-xs text-gray-500">Failed</div>
        </div>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 text-center">
          <div className="text-2xl font-bold text-amber-400">{Math.round((passCount / totalCount) * 100)}%</div>
          <div className="text-xs text-gray-500">Pass Rate</div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Recent Experiments</h3>
        <div className="space-y-2">
          {mockChaosResults.map((result, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
              <div className="flex items-center gap-3">
                {result.passed
                  ? <CheckCircle className="w-4 h-4 text-emerald-400" />
                  : <XCircle className="w-4 h-4 text-red-400" />
                }
                <span className="text-sm">{result.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                  result.passed ? "bg-emerald-900/50 text-emerald-400" : "bg-red-900/50 text-red-400"
                }`}>
                  {result.passed ? "PASSED" : "FAILED"}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(result.completed_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Experiment Library */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Available Experiments</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            { id: "CHAOS-001", name: "Brute Force Detection", category: "Detection" },
            { id: "CHAOS-002", name: "Privilege Escalation", category: "Detection" },
            { id: "CHAOS-003", name: "Agent Response Time", category: "Response" },
            { id: "CHAOS-004", name: "Incident Escalation", category: "Escalation" },
            { id: "CHAOS-005", name: "SOAR Playbook", category: "Response" },
            { id: "CHAOS-006", name: "Pipeline Latency", category: "Resilience" },
            { id: "CHAOS-007", name: "Recovery After Failure", category: "Recovery" },
            { id: "CHAOS-008", name: "Impossible Travel", category: "Detection" },
          ].map((exp) => (
            <div key={exp.id} className="flex items-center justify-between bg-gray-800 rounded-lg p-3">
              <div>
                <div className="text-sm font-medium">{exp.name}</div>
                <div className="text-xs text-gray-500">{exp.category}</div>
              </div>
              <button className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-medium transition-colors">
                Run
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ComplianceTab() {
  return (
    <div className="space-y-6">
      {/* Framework Scores */}
      <div className="bg-gray-900 rounded-lg p-5 border border-gray-800">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Compliance Posture by Framework</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={mockComplianceScores} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis type="number" domain={[0, 100]} stroke="#6b7280" fontSize={12} />
            <YAxis dataKey="framework" type="category" stroke="#6b7280" fontSize={12} width={80} />
            <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }} />
            <Bar dataKey="score" radius={[0, 4, 4, 0]}>
              {mockComplianceScores.map((entry, index) => (
                <Cell key={index} fill={entry.score >= 80 ? "#10b981" : entry.score >= 60 ? "#f59e0b" : "#ef4444"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Framework Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockComplianceScores.map((fw) => (
          <div key={fw.framework} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <span className="font-medium text-sm">{fw.framework}</span>
              <span className={`text-lg font-bold ${
                fw.score >= 80 ? "text-emerald-400" : fw.score >= 60 ? "text-amber-400" : "text-red-400"
              }`}>
                {fw.score}%
              </span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  fw.score >= 80 ? "bg-emerald-500" : fw.score >= 60 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${fw.score}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {fw.score >= 80 ? "Compliant" : fw.score >= 60 ? "Needs Improvement" : "Non-Compliant"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
