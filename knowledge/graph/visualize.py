"""
D3VONN Platform Knowledge Graph — Visualization Generator

Generates Mermaid diagrams from the platform knowledge graph for
documentation, dashboards, and Hermes reasoning context.

Usage:
    python knowledge/graph/visualize.py --output documentation/graph-overview.mmd
    python knowledge/graph/visualize.py --focus hermes --depth 2
    python knowledge/graph/visualize.py --pillar security
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from knowledge.graph.graph_engine import PlatformKnowledgeGraph, load_from_seed, GraphNode


# ─────────────────────────────────────────────────────────────────
# Style Configuration
# ─────────────────────────────────────────────────────────────────

NODE_STYLES = {
    "Agent": {"shape": "([{}])", "class": "agent"},
    "Route": {"shape": "[/{}\\]", "class": "route"},
    "Workflow": {"shape": "{{{{{}}}}}",  "class": "workflow"},
    "Integration": {"shape": "[({})]", "class": "integration"},
    "SecurityPolicy": {"shape": "[{}]", "class": "security"},
    "KnowledgeModule": {"shape": "(({}))","class": "knowledge"},
    "Event": {"shape": ">{}]", "class": "event"},
    "Pillar": {"shape": "[{}]", "class": "pillar"},
    "RBACRole": {"shape": "({})", "class": "role"},
}

EDGE_LABELS = {
    "DELEGATES_TO": "delegates",
    "SERVES": "serves",
    "PART_OF": "part of",
    "USES_INTEGRATION": "uses",
    "QUERIES": "queries",
    "PUBLISHES": "publishes",
    "SUBSCRIBES_TO": "subscribes",
    "ENFORCES": "enforces",
    "BELONGS_TO": "belongs to",
    "REQUIRES_ROLE": "requires",
    "HAS_TOOL": "has tool",
}


def sanitize_id(node_id: str) -> str:
    """Make a node ID safe for Mermaid."""
    return node_id.replace("/", "_").replace("-", "_").replace(" ", "_").replace(".", "_")


def node_label(node: GraphNode) -> str:
    """Get a display label for a node."""
    name = node.properties.get("name") or node.properties.get("page") or node.id
    return str(name)


def format_node(node: GraphNode) -> str:
    """Format a node declaration for Mermaid."""
    style = NODE_STYLES.get(node.type, {"shape": "[{}]", "class": "default"})
    safe_id = sanitize_id(node.id)
    label = node_label(node)
    shape = style["shape"].format(label)
    return f"    {safe_id}{shape}"


# ─────────────────────────────────────────────────────────────────
# Diagram Generators
# ─────────────────────────────────────────────────────────────────

def generate_overview(graph: PlatformKnowledgeGraph) -> str:
    """Generate the high-level platform overview diagram."""
    lines = ["graph TD"]
    lines.append("    %% D3VONN Platform Knowledge Graph — Overview")
    lines.append("")

    # Pillars as subgraphs
    pillars = graph.nodes_by_type("Pillar")
    for pillar in pillars:
        safe_id = sanitize_id(pillar.id)
        lines.append(f"    subgraph {safe_id}[\"{pillar.properties['name']}\"]")

        # Get nodes in this pillar
        members = graph.neighbors(pillar.id, edge_type="PART_OF", direction="incoming")
        for member in members[:6]:  # Limit for readability
            lines.append(f"        {format_node(member).strip()}")
        lines.append("    end")
        lines.append("")

    # Key edges (delegation only for overview)
    lines.append("    %% Delegation edges")
    for edge in graph.edges_by_type("DELEGATES_TO"):
        src = sanitize_id(edge.source)
        tgt = sanitize_id(edge.target)
        lines.append(f"    {src} -->|delegates| {tgt}")

    # Styling
    lines.append("")
    lines.append("    %% Styles")
    lines.append("    classDef agent fill:#4F46E5,stroke:#312E81,color:#fff")
    lines.append("    classDef workflow fill:#059669,stroke:#064E3B,color:#fff")
    lines.append("    classDef integration fill:#D97706,stroke:#78350F,color:#fff")
    lines.append("    classDef security fill:#DC2626,stroke:#7F1D1D,color:#fff")
    lines.append("    classDef knowledge fill:#7C3AED,stroke:#4C1D95,color:#fff")

    return "\n".join(lines)


def generate_agent_focus(graph: PlatformKnowledgeGraph, agent_id: str, depth: int = 2) -> str:
    """Generate a diagram focused on a specific agent and its connections."""
    agent = graph.get_node(agent_id)
    if not agent:
        return f"graph TD\n    error[Agent '{agent_id}' not found]"

    lines = ["graph LR"]
    lines.append(f"    %% Focus: {node_label(agent)}")
    lines.append("")

    # Central node
    lines.append(format_node(agent))
    lines.append("")

    # Outgoing edges
    safe_agent = sanitize_id(agent_id)

    # Delegations
    delegates = graph.neighbors(agent_id, edge_type="DELEGATES_TO", direction="outgoing")
    if delegates:
        lines.append("    %% Delegates to")
        for d in delegates:
            lines.append(format_node(d))
            lines.append(f"    {safe_agent} -->|delegates| {sanitize_id(d.id)}")
        lines.append("")

    # Routes served
    routes = graph.neighbors(agent_id, edge_type="SERVES", direction="outgoing")
    if routes:
        lines.append("    %% Serves routes")
        for r in routes[:8]:
            lines.append(format_node(r))
            lines.append(f"    {safe_agent} -->|serves| {sanitize_id(r.id)}")
        lines.append("")

    # Integrations used
    integrations = graph.neighbors(agent_id, edge_type="USES_INTEGRATION", direction="outgoing")
    if integrations:
        lines.append("    %% Uses integrations")
        for i in integrations:
            lines.append(format_node(i))
            lines.append(f"    {safe_agent} -->|uses| {sanitize_id(i.id)}")
        lines.append("")

    # Knowledge queried
    knowledge = graph.neighbors(agent_id, edge_type="QUERIES", direction="outgoing")
    if knowledge:
        lines.append("    %% Queries knowledge")
        for k in knowledge:
            lines.append(format_node(k))
            lines.append(f"    {safe_agent} -->|queries| {sanitize_id(k.id)}")
        lines.append("")

    # Events published
    published = graph.neighbors(agent_id, edge_type="PUBLISHES", direction="outgoing")
    if published:
        lines.append("    %% Publishes events")
        for e in published:
            lines.append(format_node(e))
            lines.append(f"    {safe_agent} -->|publishes| {sanitize_id(e.id)}")
        lines.append("")

    # Policies enforced on this agent
    policies = graph.neighbors(agent_id, edge_type="ENFORCES", direction="incoming")
    if policies:
        lines.append("    %% Policies enforced")
        for p in policies:
            lines.append(format_node(p))
            lines.append(f"    {sanitize_id(p.id)} -->|enforces| {safe_agent}")
        lines.append("")

    # Styling
    lines.append("    classDef agent fill:#4F46E5,stroke:#312E81,color:#fff")
    lines.append("    classDef route fill:#0891B2,stroke:#164E63,color:#fff")
    lines.append("    classDef workflow fill:#059669,stroke:#064E3B,color:#fff")
    lines.append("    classDef integration fill:#D97706,stroke:#78350F,color:#fff")
    lines.append("    classDef security fill:#DC2626,stroke:#7F1D1D,color:#fff")
    lines.append("    classDef knowledge fill:#7C3AED,stroke:#4C1D95,color:#fff")
    lines.append("    classDef event fill:#EC4899,stroke:#831843,color:#fff")

    return "\n".join(lines)


def generate_event_flow(graph: PlatformKnowledgeGraph, event_name: str) -> str:
    """Generate an event cascade diagram."""
    lines = ["graph LR"]
    lines.append(f"    %% Event Flow: {event_name}")
    lines.append("")

    cascade = graph.event_cascade(event_name, max_depth=3)
    seen_nodes: set[str] = set()

    for step in cascade:
        evt_id = sanitize_id(step["event"])
        if step["event"] not in seen_nodes:
            lines.append(f"    {evt_id}>{step['event']}]")
            seen_nodes.add(step["event"])

        for sub in step["subscribers"]:
            sub_id = sanitize_id(sub)
            if sub not in seen_nodes:
                sub_node = graph.get_node(sub)
                if sub_node:
                    lines.append(format_node(sub_node))
                    seen_nodes.add(sub)
            lines.append(f"    {evt_id} -->|triggers| {sub_id}")

        for produced in step["produced_events"]:
            prod_id = sanitize_id(produced)
            if produced not in seen_nodes:
                lines.append(f"    {prod_id}>{produced}]")
                seen_nodes.add(produced)
            # Connect from subscribers to produced events
            for sub in step["subscribers"]:
                sub_id = sanitize_id(sub)
                lines.append(f"    {sub_id} -->|emits| {prod_id}")

    lines.append("")
    lines.append("    classDef agent fill:#4F46E5,stroke:#312E81,color:#fff")
    lines.append("    classDef event fill:#EC4899,stroke:#831843,color:#fff")

    return "\n".join(lines)


def generate_security_posture(graph: PlatformKnowledgeGraph) -> str:
    """Generate a security posture diagram showing policies and their targets."""
    lines = ["graph TD"]
    lines.append("    %% D3VONN Security Posture")
    lines.append("")

    policies = graph.nodes_by_type("SecurityPolicy")
    for policy in policies:
        lines.append(format_node(policy))
        targets = graph.neighbors(policy.id, edge_type="ENFORCES", direction="outgoing")
        for target in targets:
            if target.id not in [p.id for p in policies]:
                lines.append(format_node(target))
                lines.append(f"    {sanitize_id(policy.id)} -->|enforces| {sanitize_id(target.id)}")
        lines.append("")

    lines.append("    classDef security fill:#DC2626,stroke:#7F1D1D,color:#fff")
    lines.append("    classDef agent fill:#4F46E5,stroke:#312E81,color:#fff")
    lines.append("    classDef workflow fill:#059669,stroke:#064E3B,color:#fff")

    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Mermaid diagrams from the D3VONN Knowledge Graph")
    parser.add_argument("--output", "-o", type=str, default=None, help="Output file path")
    parser.add_argument("--focus", type=str, default=None, help="Focus on a specific agent ID")
    parser.add_argument("--event", type=str, default=None, help="Generate event flow diagram")
    parser.add_argument("--security", action="store_true", help="Generate security posture diagram")
    parser.add_argument("--depth", type=int, default=2, help="Traversal depth for focus diagrams")
    args = parser.parse_args()

    seed_path = str(Path(__file__).parent / "seed" / "platform-graph.json")
    taxonomy_path = str(Path(__file__).parent / "seed" / "route-taxonomy.json")
    graph = load_from_seed(seed_path=seed_path, taxonomy_path=taxonomy_path)

    if args.focus:
        diagram = generate_agent_focus(graph, args.focus, args.depth)
    elif args.event:
        diagram = generate_event_flow(graph, args.event)
    elif args.security:
        diagram = generate_security_posture(graph)
    else:
        diagram = generate_overview(graph)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(diagram)
        print(f"Diagram written to: {output_path}")
    else:
        print(diagram)


if __name__ == "__main__":
    main()
