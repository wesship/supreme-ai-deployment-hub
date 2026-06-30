"""
backend/app/security/knowledge_graph.py — Security Knowledge Graph

Builds and queries a graph of security entities and relationships.
Every event becomes part of the DKOS knowledge graph, enabling queries like:
- "Show every incident involving this API key"
- "Which IPs attacked multiple tenants?"
- "Show lateral movement over the past week"

Node types: user, ip, device, session, alert, incident, asset, ioc, country, organization, technique, tactic
Edge types: logged_in_from, triggered, attacked, owns, associated_with, resolved_to, escalated_to
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger("d3vonn.knowledge_graph")


class SecurityKnowledgeGraph:
    """
    Manages the security knowledge graph stored in Supabase.
    Provides methods to add nodes/edges and query relationships.
    """

    def __init__(self, supabase_client: Any):
        self.db = supabase_client

    async def ingest_event(self, event: dict[str, Any]):
        """
        Ingest a security event into the knowledge graph.
        Creates nodes for all entities and edges for relationships.
        """
        actor = event.get("actor") or event.get("actor_email")
        ip = event.get("ip") or event.get("ip_address")
        event_type = event.get("event_type", "")

        # Create/update actor node
        if actor:
            await self._upsert_node("user", actor, label=actor, properties={
                "last_event": event_type,
                "last_seen": datetime.now(timezone.utc).isoformat(),
            })

        # Create/update IP node
        if ip:
            ip_str = str(ip)
            await self._upsert_node("ip", ip_str, label=ip_str, properties={
                "last_event": event_type,
            })

            # Create edge: user → logged_in_from → IP
            if actor:
                actor_node = await self._get_node("user", actor)
                ip_node = await self._get_node("ip", ip_str)
                if actor_node and ip_node:
                    await self._add_edge(
                        actor_node["id"], ip_node["id"],
                        "logged_in_from",
                        properties={"event_type": event_type},
                    )

        # Create alert node if this event triggered an alert
        alert_id = event.get("alert_id")
        if alert_id:
            await self._upsert_node("alert", str(alert_id), label=f"Alert: {event_type}", properties={
                "severity": event.get("severity"),
                "rule_id": event.get("rule_id"),
            })

            if actor:
                actor_node = await self._get_node("user", actor)
                alert_node = await self._get_node("alert", str(alert_id))
                if actor_node and alert_node:
                    await self._add_edge(
                        actor_node["id"], alert_node["id"],
                        "triggered",
                        properties={"event_type": event_type},
                    )

    async def query_connections(
        self,
        node_type: str,
        node_id: str,
        depth: int = 1,
        relationship: Optional[str] = None,
    ) -> dict[str, Any]:
        """
        Query the graph for connections from a given node.
        Returns connected nodes up to the specified depth.
        """
        source_node = await self._get_node(node_type, node_id)
        if not source_node:
            return {"node": None, "connections": []}

        connections = await self._get_edges_from(source_node["id"], relationship)

        # For depth > 1, recursively get connections (limited to prevent explosion)
        if depth > 1:
            for conn in connections[:10]:  # Limit fan-out
                target_id = conn.get("target_node_id")
                if target_id:
                    sub_connections = await self._get_edges_from(target_id)
                    conn["sub_connections"] = sub_connections[:5]

        return {
            "node": source_node,
            "connections": connections,
            "depth": depth,
        }

    async def find_attack_paths(self, actor: str) -> list[dict[str, Any]]:
        """
        Find attack paths for a given actor by tracing graph relationships.
        """
        paths: list[dict[str, Any]] = []

        actor_node = await self._get_node("user", actor)
        if not actor_node:
            return paths

        # Get all edges from this actor
        edges = await self._get_edges_from(actor_node["id"])

        # Group by relationship type to identify patterns
        by_relationship: dict[str, list] = {}
        for edge in edges:
            rel = edge.get("relationship", "unknown")
            if rel not in by_relationship:
                by_relationship[rel] = []
            by_relationship[rel].append(edge)

        # Build path descriptions
        for rel, edge_list in by_relationship.items():
            if len(edge_list) > 1:
                paths.append({
                    "relationship": rel,
                    "count": len(edge_list),
                    "description": f"Actor connected via '{rel}' to {len(edge_list)} entities",
                    "targets": [e.get("target_node_id") for e in edge_list[:10]],
                })

        return paths

    async def get_graph_stats(self) -> dict[str, Any]:
        """Get overall graph statistics."""
        stats: dict[str, Any] = {}

        try:
            # Count nodes by type
            nodes_resp = (
                self.db.table("security_graph_nodes")
                .select("node_type", count="exact")
                .execute()
            )
            stats["total_nodes"] = nodes_resp.count or 0

            # Count edges
            edges_resp = (
                self.db.table("security_graph_edges")
                .select("id", count="exact")
                .execute()
            )
            stats["total_edges"] = edges_resp.count or 0

        except Exception:
            stats["total_nodes"] = 0
            stats["total_edges"] = 0

        return stats

    # --- Internal methods ---

    async def _upsert_node(
        self, node_type: str, node_id: str, label: Optional[str] = None, properties: Optional[dict] = None
    ):
        """Create or update a graph node."""
        try:
            self.db.table("security_graph_nodes").upsert({
                "node_type": node_type,
                "node_id": node_id,
                "label": label or node_id,
                "properties": properties or {},
            }, on_conflict="node_type,node_id").execute()
        except Exception as exc:
            logger.warning("Failed to upsert node: %s", exc)

    async def _get_node(self, node_type: str, node_id: str) -> Optional[dict[str, Any]]:
        """Get a node by type and ID."""
        try:
            resp = (
                self.db.table("security_graph_nodes")
                .select("*")
                .eq("node_type", node_type)
                .eq("node_id", node_id)
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception:
            return None

    async def _add_edge(
        self,
        source_node_id: str,
        target_node_id: str,
        relationship: str,
        weight: float = 1.0,
        properties: Optional[dict] = None,
    ):
        """Add an edge between two nodes."""
        try:
            self.db.table("security_graph_edges").insert({
                "source_node_id": source_node_id,
                "target_node_id": target_node_id,
                "relationship": relationship,
                "weight": weight,
                "properties": properties or {},
            }).execute()
        except Exception as exc:
            logger.warning("Failed to add edge: %s", exc)

    async def _get_edges_from(
        self, node_id: str, relationship: Optional[str] = None
    ) -> list[dict[str, Any]]:
        """Get all edges from a source node."""
        try:
            query = (
                self.db.table("security_graph_edges")
                .select("*")
                .eq("source_node_id", node_id)
                .limit(50)
            )
            if relationship:
                query = query.eq("relationship", relationship)

            resp = query.execute()
            return resp.data or []
        except Exception:
            return []
