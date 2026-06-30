"""
Validate the D3VONN Platform Knowledge Graph.

Loads the seed data and runs assertions to ensure graph integrity.
Run with: python knowledge/graph/validate_graph.py
"""

import json
import sys
from pathlib import Path

# Add parent to path for import
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from knowledge.graph.graph_engine import PlatformKnowledgeGraph, load_from_seed


def validate() -> None:
    """Run all graph validation checks."""
    seed_path = str(Path(__file__).parent / "seed" / "platform-graph.json")
    taxonomy_path = str(Path(__file__).parent / "seed" / "route-taxonomy.json")

    graph = load_from_seed(seed_path=seed_path, taxonomy_path=taxonomy_path)
    stats = graph.stats

    print("=" * 60)
    print("D3VONN Platform Knowledge Graph — Validation Report")
    print("=" * 60)
    print()

    # ── Node Counts ───────────────────────────────────────────────
    print(f"Total Nodes: {stats['nodes']}")
    print(f"Total Edges: {stats['edges']}")
    print()
    print("Nodes by Type:")
    for key, val in sorted(stats.items()):
        if key not in ("nodes", "edges"):
            print(f"  {key}: {val}")
    print()

    # ── Assertions ────────────────────────────────────────────────
    errors: list[str] = []

    # Check minimum node counts
    if stats.get("Agent", 0) < 8:
        errors.append(f"Expected 8 agents, got {stats.get('Agent', 0)}")
    if stats.get("Pillar", 0) < 7:
        errors.append(f"Expected 7 pillars, got {stats.get('Pillar', 0)}")
    if stats.get("Workflow", 0) < 7:
        errors.append(f"Expected 7 workflows, got {stats.get('Workflow', 0)}")
    if stats.get("Integration", 0) < 8:
        errors.append(f"Expected 8 integrations, got {stats.get('Integration', 0)}")
    if stats.get("Event", 0) < 14:
        errors.append(f"Expected 14 events, got {stats.get('Event', 0)}")
    if stats.get("Route", 0) < 40:
        errors.append(f"Expected 40+ routes, got {stats.get('Route', 0)}")

    # Check Hermes is core
    hermes = graph.get_node("hermes")
    if not hermes:
        errors.append("Hermes node not found")
    elif hermes.properties.get("tier") != "core":
        errors.append("Hermes should be tier=core")

    # Check all agents delegate from Hermes
    delegates = graph.neighbors("hermes", edge_type="DELEGATES_TO", direction="outgoing")
    if len(delegates) < 7:
        errors.append(f"Hermes should delegate to 7 agents, found {len(delegates)}")

    # Check capability routing
    code_agents = graph.find_agents_for_capability("code")
    if not code_agents:
        errors.append("No agent found for 'code' capability")

    security_agents = graph.find_agents_for_capability("vulnerability")
    if not security_agents:
        errors.append("No agent found for 'vulnerability' capability")

    # Check impact analysis
    impact = graph.impact_analysis("hermes")
    if impact["risk_level"] != "critical":
        errors.append(f"Hermes impact should be 'critical', got '{impact['risk_level']}'")

    # Check event cascade
    cascade = graph.event_cascade("TaskCreated")
    if not cascade:
        errors.append("TaskCreated event cascade is empty")

    # Check platform health
    health = graph.platform_health()
    if health["active_agents"] < 8:
        errors.append(f"Expected 8 active agents, got {health['active_agents']}")
    if health["security_coverage_pct"] < 50:
        errors.append(f"Security coverage too low: {health['security_coverage_pct']}%")

    # ── Report ────────────────────────────────────────────────────
    print("Validation Checks:")
    if errors:
        for err in errors:
            print(f"  FAIL: {err}")
        print(f"\n{len(errors)} check(s) failed.")
        sys.exit(1)
    else:
        print("  All checks passed.")
        print()

    # ── Sample Queries ────────────────────────────────────────────
    print("Sample Queries:")
    print()

    print("  Best agent for 'code-review':")
    for agent in graph.find_agents_for_capability("code-review"):
        print(f"    → {agent.properties.get('name')} (capabilities: {agent.properties.get('capabilities')})")
    print()

    print("  Event cascade from TaskCreated:")
    for step in cascade[:3]:
        print(f"    Event: {step['event']}")
        print(f"      Subscribers: {step['subscribers']}")
        print(f"      Produces: {step['produced_events']}")
    print()

    print("  Platform Health:")
    for key, val in health.items():
        print(f"    {key}: {val}")
    print()

    print("  Hermes Impact Analysis:")
    print(f"    Risk Level: {impact['risk_level']}")
    print(f"    Direct Dependents: {len(impact['direct_dependents'])}")
    print(f"    Transitive Dependents: {len(impact['transitive_dependents'])}")
    print()

    print("=" * 60)
    print("VALIDATION PASSED")
    print("=" * 60)


if __name__ == "__main__":
    validate()
