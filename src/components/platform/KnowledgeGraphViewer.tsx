/**
 * D3VONN Knowledge Graph Viewer
 *
 * Interactive visualization of the platform knowledge graph:
 * - Node exploration by type
 * - Edge relationship navigation
 * - Search and filter
 * - Graph statistics
 * - Hermes reasoning paths
 *
 * @module components/platform/KnowledgeGraphViewer
 * @version 1.0.0
 */

import React, { useState, useMemo } from "react";
import {
  Network,
  Search,
  Filter,
  ChevronRight,
  Circle,
  ArrowRight,
  Maximize2,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────
// Types & Mock Data (mirrors knowledge/graph/seed/platform-graph.json)
// ─────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string;
  type: string;
  label: string;
  properties: Record<string, unknown>;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
  weight?: number;
}

const NODE_TYPES = [
  { type: "agent", label: "Agents", color: "blue", count: 8 },
  { type: "route", label: "Routes", color: "purple", count: 52 },
  { type: "workflow", label: "Workflows", color: "amber", count: 7 },
  { type: "integration", label: "Integrations", color: "cyan", count: 8 },
  { type: "security_policy", label: "Security", color: "red", count: 6 },
  { type: "knowledge_module", label: "DKOS", color: "emerald", count: 5 },
  { type: "event", label: "Events", color: "orange", count: 14 },
  { type: "tool", label: "Tools", color: "indigo", count: 12 },
];

const SAMPLE_NODES: GraphNode[] = [
  { id: "agent:hermes", type: "agent", label: "Hermes", properties: { tier: "core", status: "active", model: "gpt-4o" } },
  { id: "agent:research-analyst", type: "agent", label: "Research Analyst", properties: { tier: "specialist", status: "active" } },
  { id: "agent:code-engineer", type: "agent", label: "Code Engineer", properties: { tier: "specialist", status: "active" } },
  { id: "agent:security-sentinel", type: "agent", label: "Security Sentinel", properties: { tier: "specialist", status: "active" } },
  { id: "agent:data-analyst", type: "agent", label: "Data Analyst", properties: { tier: "specialist", status: "idle" } },
  { id: "agent:ux-designer", type: "agent", label: "UX Designer", properties: { tier: "specialist", status: "idle" } },
  { id: "agent:devops-engineer", type: "agent", label: "DevOps Engineer", properties: { tier: "specialist", status: "active" } },
  { id: "agent:content-writer", type: "agent", label: "Content Writer", properties: { tier: "specialist", status: "idle" } },
  { id: "route:/platform", type: "route", label: "/platform", properties: { category: "platform", component: "PlatformConsole" } },
  { id: "route:/platform/hermes", type: "route", label: "/platform/hermes", properties: { category: "platform", component: "HermesDashboard" } },
  { id: "route:/platform/agents", type: "route", label: "/platform/agents", properties: { category: "platform", component: "AgentFleetView" } },
  { id: "route:/platform/events", type: "route", label: "/platform/events", properties: { category: "platform", component: "EventStreamPanel" } },
  { id: "route:/platform/knowledge", type: "route", label: "/platform/knowledge", properties: { category: "platform", component: "KnowledgeGraphViewer" } },
  { id: "route:/platform/security", type: "route", label: "/platform/security", properties: { category: "platform", component: "SecurityPolicyViewer" } },
  { id: "workflow:task-lifecycle", type: "workflow", label: "Task Lifecycle", properties: { steps: 7, trigger: "TaskCreated" } },
  { id: "workflow:security-audit", type: "workflow", label: "Security Audit", properties: { steps: 5, trigger: "DeploymentStarted" } },
  { id: "integration:openai", type: "integration", label: "OpenAI", properties: { type: "ai-provider", status: "connected" } },
  { id: "integration:supabase", type: "integration", label: "Supabase", properties: { type: "database", status: "connected" } },
  { id: "security:rbac-enforcer", type: "security_policy", label: "RBAC Enforcer", properties: { mode: "deny-first" } },
  { id: "security:rls-policies", type: "security_policy", label: "Row-Level Security", properties: { tables: 8 } },
  { id: "dkos:episodic-memory", type: "knowledge_module", label: "Episodic Memory", properties: { retention: "90d" } },
  { id: "dkos:semantic-index", type: "knowledge_module", label: "Semantic Index", properties: { vectors: "1.2M" } },
  { id: "event:TaskCreated", type: "event", label: "TaskCreated", properties: { priority: "critical" } },
  { id: "event:AgentStarted", type: "event", label: "AgentStarted", properties: { priority: "high" } },
  { id: "event:ToolInvoked", type: "event", label: "ToolInvoked", properties: { priority: "medium" } },
];

const SAMPLE_EDGES: GraphEdge[] = [
  { source: "agent:hermes", target: "agent:research-analyst", relationship: "delegates_to", weight: 0.94 },
  { source: "agent:hermes", target: "agent:code-engineer", relationship: "delegates_to", weight: 0.91 },
  { source: "agent:hermes", target: "agent:security-sentinel", relationship: "delegates_to", weight: 0.97 },
  { source: "agent:hermes", target: "event:TaskCreated", relationship: "subscribes_to" },
  { source: "agent:hermes", target: "event:AgentStarted", relationship: "publishes" },
  { source: "agent:research-analyst", target: "event:ToolInvoked", relationship: "publishes" },
  { source: "agent:research-analyst", target: "dkos:episodic-memory", relationship: "writes_to" },
  { source: "security:rbac-enforcer", target: "agent:hermes", relationship: "enforces_on" },
  { source: "security:rbac-enforcer", target: "agent:code-engineer", relationship: "enforces_on" },
  { source: "workflow:task-lifecycle", target: "event:TaskCreated", relationship: "triggered_by" },
  { source: "workflow:task-lifecycle", target: "agent:hermes", relationship: "invokes" },
  { source: "route:/platform/hermes", target: "agent:hermes", relationship: "visualizes" },
  { source: "route:/platform/agents", target: "agent:hermes", relationship: "monitors" },
  { source: "integration:openai", target: "agent:hermes", relationship: "provides_model_for" },
  { source: "integration:supabase", target: "dkos:episodic-memory", relationship: "stores" },
];

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

const KnowledgeGraphViewer: React.FC = () => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNodes = useMemo(() => {
    return SAMPLE_NODES.filter((node) => {
      if (selectedType && node.type !== selectedType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return node.label.toLowerCase().includes(q) || node.id.toLowerCase().includes(q);
      }
      return true;
    });
  }, [selectedType, searchQuery]);

  const nodeEdges = useMemo(() => {
    if (!selectedNode) return [];
    return SAMPLE_EDGES.filter(
      (e) => e.source === selectedNode.id || e.target === selectedNode.id
    );
  }, [selectedNode]);

  const typeColorMap: Record<string, string> = {
    agent: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    route: "text-purple-400 bg-purple-500/10 border-purple-500/20",
    workflow: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    integration: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    security_policy: "text-red-400 bg-red-500/10 border-red-500/20",
    knowledge_module: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    event: "text-orange-400 bg-orange-500/10 border-orange-500/20",
    tool: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
  };

  const dotColorMap: Record<string, string> = {
    agent: "bg-blue-400",
    route: "bg-purple-400",
    workflow: "bg-amber-400",
    integration: "bg-cyan-400",
    security_policy: "bg-red-400",
    knowledge_module: "bg-emerald-400",
    event: "bg-orange-400",
    tool: "bg-indigo-400",
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10">
            <Network className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Knowledge Graph</h1>
            <p className="text-sm text-slate-400">
              112 nodes • 193 edges • 8 categories
            </p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {NODE_TYPES.map((nt) => (
          <button
            key={nt.type}
            onClick={() => setSelectedType(selectedType === nt.type ? null : nt.type)}
            className={cn(
              "p-2 rounded-lg border text-center transition-all",
              selectedType === nt.type
                ? typeColorMap[nt.type]
                : "bg-slate-900/50 border-slate-800/60 hover:border-slate-700/60"
            )}
          >
            <div className={cn("text-lg font-bold", selectedType === nt.type ? "" : "text-white")}>
              {nt.count}
            </div>
            <div className="text-[9px] text-slate-400 uppercase">{nt.label}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search nodes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Node List */}
        <div className="lg:col-span-2">
          <Card className="bg-slate-900/50 border-slate-800/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300">
                Nodes {selectedType && `— ${selectedType}`}
                <span className="text-slate-500 ml-2">({filteredNodes.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[500px] overflow-y-auto">
                {filteredNodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNode(node)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-all",
                      selectedNode?.id === node.id
                        ? "bg-blue-500/10 border border-blue-500/20"
                        : "hover:bg-slate-800/50"
                    )}
                  >
                    <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", dotColorMap[node.type])} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{node.label}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{node.id}</div>
                    </div>
                    <Badge variant="outline" className={cn("text-[9px]", typeColorMap[node.type])}>
                      {node.type.replace("_", " ")}
                    </Badge>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Node Detail Panel */}
        <div>
          <Card className="bg-slate-900/50 border-slate-800/60 sticky top-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-300 flex items-center gap-2">
                <Info className="h-3.5 w-3.5" />
                Node Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedNode ? (
                <div className="space-y-4">
                  {/* Node Info */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={cn("h-3 w-3 rounded-full", dotColorMap[selectedNode.type])} />
                      <span className="text-sm font-medium text-white">{selectedNode.label}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono mb-3">{selectedNode.id}</div>
                    <Badge variant="outline" className={cn("text-[10px]", typeColorMap[selectedNode.type])}>
                      {selectedNode.type.replace("_", " ")}
                    </Badge>
                  </div>

                  {/* Properties */}
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Properties</div>
                    <div className="space-y-1">
                      {Object.entries(selectedNode.properties).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">{key}</span>
                          <span className="text-white font-mono">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Edges */}
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">
                      Connections ({nodeEdges.length})
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {nodeEdges.map((edge, i) => {
                        const isSource = edge.source === selectedNode.id;
                        const otherNodeId = isSource ? edge.target : edge.source;
                        const otherNode = SAMPLE_NODES.find((n) => n.id === otherNodeId);
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-1.5 text-[11px] p-1.5 rounded bg-slate-800/30"
                          >
                            {isSource ? (
                              <>
                                <ArrowRight className="h-3 w-3 text-slate-500" />
                                <span className="text-slate-400">{edge.relationship}</span>
                                <ChevronRight className="h-2.5 w-2.5 text-slate-600" />
                                <span className="text-white truncate">{otherNode?.label || otherNodeId}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-white truncate">{otherNode?.label || otherNodeId}</span>
                                <ChevronRight className="h-2.5 w-2.5 text-slate-600" />
                                <span className="text-slate-400">{edge.relationship}</span>
                                <ArrowRight className="h-3 w-3 text-slate-500" />
                              </>
                            )}
                          </div>
                        );
                      })}
                      {nodeEdges.length === 0 && (
                        <div className="text-xs text-slate-500 text-center py-2">No connections</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-slate-500">
                  <Network className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                  Select a node to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeGraphViewer;
