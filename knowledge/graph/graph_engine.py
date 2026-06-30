"""
D3VONN Platform Knowledge Graph — Python Engine

Provides the same graph reasoning capabilities as the TypeScript engine,
for use by the FastAPI backend and Hermes orchestration kernel.

Usage:
    from knowledge.graph.graph_engine import PlatformKnowledgeGraph, load_from_seed
    graph = load_from_seed()
    health = graph.platform_health()
    agents = graph.find_agents_for_capability("code-review")
"""

from __future__ import annotations

import json
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional


@dataclass
class GraphNode:
    id: str
    type: str
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass
class GraphEdge:
    id: str
    edge_type: str
    source: str
    target: str
    properties: dict[str, Any] = field(default_factory=dict)


class PlatformKnowledgeGraph:
    """In-memory directed graph with typed nodes and edges."""

    def __init__(self) -> None:
        self._nodes: dict[str, GraphNode] = {}
        self._edges: dict[str, GraphEdge] = {}
        self._out: dict[str, list[str]] = defaultdict(list)
        self._in: dict[str, list[str]] = defaultdict(list)
        self._edge_counter = 0

    # ── Node Operations ───────────────────────────────────────────

    def add_node(self, node_id: str, node_type: str, **properties: Any) -> None:
        self._nodes[node_id] = GraphNode(id=node_id, type=node_type, properties=properties)

    def get_node(self, node_id: str) -> Optional[GraphNode]:
        return self._nodes.get(node_id)

    def nodes_by_type(self, node_type: str) -> list[GraphNode]:
        return [n for n in self._nodes.values() if n.type == node_type]

    # ── Edge Operations ───────────────────────────────────────────

    def add_edge(self, edge_type: str, source: str, target: str, **properties: Any) -> str:
        self._edge_counter += 1
        edge_id = f"e_{self._edge_counter}"
        self._edges[edge_id] = GraphEdge(
            id=edge_id, edge_type=edge_type, source=source, target=target, properties=properties
        )
        self._out[source].append(edge_id)
        self._in[target].append(edge_id)
        return edge_id

    def edges_by_type(self, edge_type: str) -> list[GraphEdge]:
        return [e for e in self._edges.values() if e.edge_type == edge_type]

    # ── Query Operations ──────────────────────────────────────────

    def neighbors(
        self,
        node_id: str,
        edge_type: Optional[str] = None,
        direction: str = "both",
        node_type: Optional[str] = None,
    ) -> list[GraphNode]:
        """Find neighbors of a node, optionally filtered."""
        result_ids: set[str] = set()

        if direction in ("outgoing", "both"):
            for eid in self._out.get(node_id, []):
                edge = self._edges[eid]
                if edge_type and edge.edge_type != edge_type:
                    continue
                result_ids.add(edge.target)

        if direction in ("incoming", "both"):
            for eid in self._in.get(node_id, []):
                edge = self._edges[eid]
                if edge_type and edge.edge_type != edge_type:
                    continue
                result_ids.add(edge.source)

        nodes = [self._nodes[nid] for nid in result_ids if nid in self._nodes]
        if node_type:
            nodes = [n for n in nodes if n.type == node_type]
        return nodes

    def shortest_path(self, from_id: str, to_id: str) -> Optional[list[str]]:
        """BFS shortest path."""
        if from_id == to_id:
            return [from_id]
        visited = {from_id}
        queue: list[tuple[str, list[str]]] = [(from_id, [from_id])]
        while queue:
            current, path = queue.pop(0)
            for eid in self._out.get(current, []):
                edge = self._edges[eid]
                if edge.target in visited:
                    continue
                new_path = path + [edge.target]
                if edge.target == to_id:
                    return new_path
                visited.add(edge.target)
                queue.append((edge.target, new_path))
        return None

    # ── Hermes Reasoning ──────────────────────────────────────────

    def find_agents_for_capability(self, capability: str) -> list[GraphNode]:
        """Find agents whose capabilities match a keyword."""
        results = []
        for agent in self.nodes_by_type("Agent"):
            caps = agent.properties.get("capabilities", [])
            if any(capability in c or c in capability for c in caps):
                results.append(agent)
        return results

    def impact_analysis(self, node_id: str) -> dict[str, Any]:
        """Analyze impact of a node failure."""
        direct = [self._edges[eid].source for eid in self._in.get(node_id, [])]
        transitive: set[str] = set()
        queue = list(direct)
        while queue:
            current = queue.pop(0)
            if current in transitive:
                continue
            transitive.add(current)
            for eid in self._in.get(current, []):
                src = self._edges[eid].source
                if src not in transitive:
                    queue.append(src)

        node = self._nodes.get(node_id)
        risk = "low"
        if node and node.properties.get("tier") == "core":
            risk = "critical"
        elif len(transitive) > 10:
            risk = "high"
        elif len(transitive) > 5:
            risk = "medium"

        return {
            "node": node_id,
            "direct_dependents": direct,
            "transitive_dependents": list(transitive),
            "affected_routes": [nid for nid in transitive if self._nodes.get(nid, GraphNode("", "")).type == "Route"],
            "affected_workflows": [nid for nid in transitive if self._nodes.get(nid, GraphNode("", "")).type == "Workflow"],
            "risk_level": risk,
        }

    def event_cascade(self, trigger_event: str, max_depth: int = 3) -> list[dict[str, Any]]:
        """Trace event propagation through the system."""
        cascade: list[dict[str, Any]] = []
        visited: set[str] = set()
        queue = [trigger_event]
        depth = 0

        while queue and depth < max_depth:
            batch = list(queue)
            queue.clear()
            for event_name in batch:
                if event_name in visited:
                    continue
                visited.add(event_name)
                subscribers = self.neighbors(event_name, edge_type="SUBSCRIBES_TO", direction="incoming")
                produced: list[str] = []
                for sub in subscribers:
                    published = self.neighbors(sub.id, edge_type="PUBLISHES", direction="outgoing", node_type="Event")
                    for evt in published:
                        if evt.id not in visited:
                            produced.append(evt.id)
                            queue.append(evt.id)
                cascade.append({
                    "event": event_name,
                    "subscribers": [s.id for s in subscribers],
                    "produced_events": produced,
                })
            depth += 1
        return cascade

    def platform_health(self) -> dict[str, Any]:
        """Platform health summary."""
        agents = self.nodes_by_type("Agent")
        workflows = self.nodes_by_type("Workflow")
        integrations = self.nodes_by_type("Integration")
        routes = self.nodes_by_type("Route")

        agents_with_policy = sum(
            1 for a in agents if self.neighbors(a.id, edge_type="ENFORCES", direction="incoming")
        )

        orphaned = [
            r for r in routes
            if r.properties.get("access") != "public"
            and not r.properties.get("system")
            and not self.neighbors(r.id, edge_type="SERVES", direction="incoming")
        ]

        return {
            "total_nodes": len(self._nodes),
            "total_edges": len(self._edges),
            "active_agents": sum(1 for a in agents if a.properties.get("status") == "active"),
            "active_workflows": sum(1 for w in workflows if w.properties.get("status") == "active"),
            "active_integrations": sum(1 for i in integrations if i.properties.get("status") == "active"),
            "security_coverage_pct": round(agents_with_policy / max(len(agents), 1) * 100),
            "orphaned_routes": [r.id for r in orphaned],
        }

    @property
    def stats(self) -> dict[str, int]:
        by_type: dict[str, int] = defaultdict(int)
        for n in self._nodes.values():
            by_type[n.type] += 1
        return {"nodes": len(self._nodes), "edges": len(self._edges), **by_type}


# ─────────────────────────────────────────────────────────────────
# Loader
# ─────────────────────────────────────────────────────────────────

def load_from_seed(
    seed_path: Optional[str] = None,
    taxonomy_path: Optional[str] = None,
) -> PlatformKnowledgeGraph:
    """Load the platform graph from seed JSON and route taxonomy YAML."""
    base = Path(__file__).parent

    if seed_path is None:
        seed_path = str(base / "seed" / "platform-graph.json")
    if taxonomy_path is None:
        # We'll parse the YAML taxonomy; for simplicity, load from JSON export
        taxonomy_path = str(base / "seed" / "route-taxonomy.json")

    graph = PlatformKnowledgeGraph()

    with open(seed_path) as f:
        seed = json.load(f)

    # Load nodes
    for pillar in seed["nodes"]["pillars"]:
        graph.add_node(pillar["id"], "Pillar", name=pillar["name"], description=pillar["description"])

    for agent in seed["nodes"]["agents"]:
        graph.add_node(agent["id"], "Agent", **agent)

    for wf in seed["nodes"]["workflows"]:
        graph.add_node(wf["id"], "Workflow", **wf)

    for integ in seed["nodes"]["integrations"]:
        graph.add_node(integ["id"], "Integration", **integ)

    for policy in seed["nodes"]["security_policies"]:
        graph.add_node(policy["id"], "SecurityPolicy", **policy)

    for module in seed["nodes"]["knowledge_modules"]:
        graph.add_node(module["id"], "KnowledgeModule", **module)

    for event in seed["nodes"]["events"]:
        graph.add_node(event["name"], "Event", **event)

    for role in seed["nodes"]["rbac_roles"]:
        graph.add_node(role["id"], "RBACRole", **role)

    # Load edges
    for e in seed["edges"]["delegates_to"]:
        graph.add_edge("DELEGATES_TO", e["from"], e["to"], conditions=e["conditions"])

    for e in seed["edges"]["part_of_pillar"]:
        graph.add_edge("PART_OF", e["from"], e["pillar"])

    for e in seed["edges"]["agent_uses_integration"]:
        graph.add_edge("USES_INTEGRATION", e["agent"], e["integration"])

    for e in seed["edges"]["agent_queries_knowledge"]:
        graph.add_edge("QUERIES", e["agent"], e["module"], operations=e["operations"])

    for e in seed["edges"]["agent_publishes_event"]:
        graph.add_edge("PUBLISHES", e["agent"], e["event"])

    for e in seed["edges"]["agent_subscribes_to_event"]:
        graph.add_edge("SUBSCRIBES_TO", e["agent"], e["event"])

    for e in seed["edges"]["policy_enforces"]:
        graph.add_edge("ENFORCES", e["policy"], e["target"], target_type=e["target_type"])

    for e in seed["edges"]["route_requires_role"]:
        graph.add_edge("REQUIRES_ROLE", e["route"], e["role"])

    # Load routes from taxonomy if available
    taxonomy_file = Path(taxonomy_path)
    if taxonomy_file.exists():
        with open(taxonomy_file) as f:
            taxonomy = json.load(f)
        for route in taxonomy.get("routes", []):
            if route.get("redirect_to"):
                continue
            graph.add_node(route["path"], "Route", **route)
            for agent_id in route.get("agents", []):
                graph.add_edge("SERVES", agent_id, route["path"])
            if route.get("pillar"):
                graph.add_edge("BELONGS_TO", route["path"], route["pillar"])

    return graph


# ─────────────────────────────────────────────────────────────────
# Singleton
# ─────────────────────────────────────────────────────────────────

_instance: Optional[PlatformKnowledgeGraph] = None


def get_platform_graph() -> PlatformKnowledgeGraph:
    """Get or create the singleton platform graph."""
    global _instance
    if _instance is None:
        _instance = load_from_seed()
    return _instance


def reset_platform_graph() -> None:
    """Reset the singleton (for testing)."""
    global _instance
    _instance = None
