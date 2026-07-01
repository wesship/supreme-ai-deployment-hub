"""
backend/app/security/asset_identity_graph.py — Asset & Identity Graph

Complete operational graph covering:
- Users, Devices, Servers, Containers
- Agents, API Keys, Secrets
- Repositories, Cloud Resources
- Knowledge Stores, Tenants, Workspaces

Every alert points back to this graph for context and blast radius analysis.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger("d3vonn.asset_graph")


class NodeType(str, Enum):
    USER = "user"
    DEVICE = "device"
    SERVER = "server"
    CONTAINER = "container"
    AGENT = "agent"
    API_KEY = "api_key"
    SECRET = "secret"
    REPOSITORY = "repository"
    CLOUD_RESOURCE = "cloud_resource"
    KNOWLEDGE_STORE = "knowledge_store"
    TENANT = "tenant"
    WORKSPACE = "workspace"
    SERVICE = "service"
    NETWORK = "network"
    IP_ADDRESS = "ip_address"
    DOMAIN = "domain"
    CERTIFICATE = "certificate"


class EdgeType(str, Enum):
    OWNS = "owns"
    ACCESSES = "accesses"
    AUTHENTICATES_AS = "authenticates_as"
    DEPLOYED_ON = "deployed_on"
    CONNECTS_TO = "connects_to"
    MEMBER_OF = "member_of"
    MANAGES = "manages"
    DEPENDS_ON = "depends_on"
    COMMUNICATES_WITH = "communicates_with"
    RUNS_ON = "runs_on"
    STORES_IN = "stores_in"
    EXPOSES = "exposes"
    TRUSTS = "trusts"
    CONTAINS = "contains"
    ASSOCIATED_WITH = "associated_with"


class RiskLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    NONE = "none"


class AssetIdentityGraph:
    """
    Manages the operational asset and identity graph.
    Provides entity registration, relationship management,
    blast radius analysis, and alert contextualization.
    """

    def __init__(self, supabase_client: Any):
        self.db = supabase_client

    # -----------------------------------------------------------------------
    # Node Management
    # -----------------------------------------------------------------------

    async def register_node(
        self,
        node_type: NodeType,
        node_id: str,
        name: str,
        tenant_id: str = "",
        properties: dict[str, Any] = None,
        risk_level: RiskLevel = RiskLevel.NONE,
        tags: list[str] = None,
    ) -> dict[str, Any]:
        """Register or update a node in the graph."""
        node_data = {
            "node_type": node_type.value,
            "node_id": node_id,
            "name": name,
            "tenant_id": tenant_id,
            "properties": properties or {},
            "risk_level": risk_level.value,
            "tags": tags or [],
            "status": "active",
            "last_seen": datetime.now(timezone.utc).isoformat(),
        }

        try:
            existing = (
                self.db.table("security_graph_nodes")
                .select("id")
                .eq("node_type", node_type.value)
                .eq("node_id", node_id)
                .limit(1)
                .execute()
            )

            if existing.data:
                self.db.table("security_graph_nodes").update({
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                    "properties": properties or {},
                    "risk_level": risk_level.value,
                }).eq("id", existing.data[0]["id"]).execute()
                node_data["id"] = existing.data[0]["id"]
                node_data["action"] = "updated"
            else:
                node_data["first_seen"] = datetime.now(timezone.utc).isoformat()
                resp = self.db.table("security_graph_nodes").insert(node_data).execute()
                if resp.data:
                    node_data["id"] = resp.data[0].get("id")
                node_data["action"] = "created"

        except Exception as exc:
            logger.error("Failed to register node: %s", exc)
            node_data["error"] = str(exc)

        return node_data

    async def register_edge(
        self,
        source_type: NodeType,
        source_id: str,
        target_type: NodeType,
        target_id: str,
        edge_type: EdgeType,
        properties: dict[str, Any] = None,
    ) -> dict[str, Any]:
        """Create or update an edge between two nodes."""
        edge_data = {
            "source_type": source_type.value,
            "source_id": source_id,
            "target_type": target_type.value,
            "target_id": target_id,
            "edge_type": edge_type.value,
            "properties": properties or {},
            "last_seen": datetime.now(timezone.utc).isoformat(),
        }

        try:
            existing = (
                self.db.table("security_graph_edges")
                .select("id")
                .eq("source_type", source_type.value)
                .eq("source_id", source_id)
                .eq("target_type", target_type.value)
                .eq("target_id", target_id)
                .eq("edge_type", edge_type.value)
                .limit(1)
                .execute()
            )

            if existing.data:
                self.db.table("security_graph_edges").update({
                    "last_seen": datetime.now(timezone.utc).isoformat(),
                    "properties": properties or {},
                }).eq("id", existing.data[0]["id"]).execute()
                edge_data["id"] = existing.data[0]["id"]
            else:
                edge_data["first_seen"] = datetime.now(timezone.utc).isoformat()
                resp = self.db.table("security_graph_edges").insert(edge_data).execute()
                if resp.data:
                    edge_data["id"] = resp.data[0].get("id")

        except Exception as exc:
            logger.error("Failed to register edge: %s", exc)

        return edge_data

    # -----------------------------------------------------------------------
    # Bulk Registration (for initial asset discovery)
    # -----------------------------------------------------------------------

    async def register_user(self, user_id: str, email: str, tenant_id: str = "", role: str = "user", **kwargs) -> dict[str, Any]:
        """Register a user node."""
        return await self.register_node(
            NodeType.USER, user_id, email,
            tenant_id=tenant_id,
            properties={"email": email, "role": role, **kwargs},
            risk_level=RiskLevel.HIGH if role in ("admin", "superadmin") else RiskLevel.LOW,
            tags=["user", role],
        )

    async def register_device(self, device_id: str, name: str, owner_id: str, device_type: str = "workstation", **kwargs) -> dict[str, Any]:
        """Register a device node and link to owner."""
        node = await self.register_node(
            NodeType.DEVICE, device_id, name,
            properties={"device_type": device_type, "owner": owner_id, **kwargs},
            tags=["device", device_type],
        )
        await self.register_edge(NodeType.USER, owner_id, NodeType.DEVICE, device_id, EdgeType.OWNS)
        return node

    async def register_server(self, server_id: str, hostname: str, environment: str = "production", **kwargs) -> dict[str, Any]:
        """Register a server node."""
        risk = RiskLevel.CRITICAL if environment == "production" else RiskLevel.MEDIUM
        return await self.register_node(
            NodeType.SERVER, server_id, hostname,
            properties={"environment": environment, **kwargs},
            risk_level=risk,
            tags=["server", environment],
        )

    async def register_container(self, container_id: str, image: str, server_id: str = "", **kwargs) -> dict[str, Any]:
        """Register a container node."""
        node = await self.register_node(
            NodeType.CONTAINER, container_id, image,
            properties={"image": image, **kwargs},
            tags=["container"],
        )
        if server_id:
            await self.register_edge(NodeType.CONTAINER, container_id, NodeType.SERVER, server_id, EdgeType.RUNS_ON)
        return node

    async def register_api_key(self, key_id: str, name: str, owner_id: str, scopes: list[str] = None, **kwargs) -> dict[str, Any]:
        """Register an API key node."""
        node = await self.register_node(
            NodeType.API_KEY, key_id, name,
            properties={"scopes": scopes or [], "owner": owner_id, **kwargs},
            risk_level=RiskLevel.HIGH if "admin" in (scopes or []) else RiskLevel.MEDIUM,
            tags=["api_key"],
        )
        await self.register_edge(NodeType.USER, owner_id, NodeType.API_KEY, key_id, EdgeType.OWNS)
        return node

    async def register_repository(self, repo_id: str, name: str, visibility: str = "private", **kwargs) -> dict[str, Any]:
        """Register a repository node."""
        return await self.register_node(
            NodeType.REPOSITORY, repo_id, name,
            properties={"visibility": visibility, **kwargs},
            risk_level=RiskLevel.HIGH if visibility == "public" else RiskLevel.MEDIUM,
            tags=["repository", visibility],
        )

    async def register_cloud_resource(self, resource_id: str, name: str, provider: str, resource_type: str, **kwargs) -> dict[str, Any]:
        """Register a cloud resource node."""
        return await self.register_node(
            NodeType.CLOUD_RESOURCE, resource_id, name,
            properties={"provider": provider, "resource_type": resource_type, **kwargs},
            tags=["cloud", provider, resource_type],
        )

    async def register_secret(self, secret_id: str, name: str, vault: str = "default", **kwargs) -> dict[str, Any]:
        """Register a secret node."""
        return await self.register_node(
            NodeType.SECRET, secret_id, name,
            properties={"vault": vault, **kwargs},
            risk_level=RiskLevel.CRITICAL,
            tags=["secret"],
        )

    async def register_tenant(self, tenant_id: str, name: str, plan: str = "free", **kwargs) -> dict[str, Any]:
        """Register a tenant node."""
        return await self.register_node(
            NodeType.TENANT, tenant_id, name,
            tenant_id=tenant_id,
            properties={"plan": plan, **kwargs},
            tags=["tenant", plan],
        )

    async def register_workspace(self, workspace_id: str, name: str, tenant_id: str, **kwargs) -> dict[str, Any]:
        """Register a workspace node."""
        node = await self.register_node(
            NodeType.WORKSPACE, workspace_id, name,
            tenant_id=tenant_id,
            properties=kwargs,
            tags=["workspace"],
        )
        await self.register_edge(NodeType.WORKSPACE, workspace_id, NodeType.TENANT, tenant_id, EdgeType.MEMBER_OF)
        return node

    # -----------------------------------------------------------------------
    # Query Operations
    # -----------------------------------------------------------------------

    async def get_node(self, node_type: NodeType, node_id: str) -> Optional[dict[str, Any]]:
        """Get a node by type and ID."""
        try:
            resp = (
                self.db.table("security_graph_nodes")
                .select("*")
                .eq("node_type", node_type.value)
                .eq("node_id", node_id)
                .limit(1)
                .execute()
            )
            return resp.data[0] if resp.data else None
        except Exception:
            return None

    async def get_neighbors(self, node_type: NodeType, node_id: str, edge_types: list[EdgeType] = None) -> list[dict[str, Any]]:
        """Get all nodes connected to a given node."""
        neighbors: list[dict[str, Any]] = []
        try:
            # Outgoing edges
            query = (
                self.db.table("security_graph_edges")
                .select("*")
                .eq("source_type", node_type.value)
                .eq("source_id", node_id)
            )
            if edge_types:
                query = query.in_("edge_type", [e.value for e in edge_types])
            outgoing = query.execute()

            # Incoming edges
            query2 = (
                self.db.table("security_graph_edges")
                .select("*")
                .eq("target_type", node_type.value)
                .eq("target_id", node_id)
            )
            if edge_types:
                query2 = query2.in_("edge_type", [e.value for e in edge_types])
            incoming = query2.execute()

            for edge in (outgoing.data or []):
                neighbors.append({
                    "direction": "outgoing",
                    "edge_type": edge["edge_type"],
                    "node_type": edge["target_type"],
                    "node_id": edge["target_id"],
                })

            for edge in (incoming.data or []):
                neighbors.append({
                    "direction": "incoming",
                    "edge_type": edge["edge_type"],
                    "node_type": edge["source_type"],
                    "node_id": edge["source_id"],
                })

        except Exception as exc:
            logger.error("Failed to get neighbors: %s", exc)

        return neighbors

    async def get_blast_radius(self, node_type: NodeType, node_id: str, max_depth: int = 3) -> dict[str, Any]:
        """
        Compute the blast radius for a compromised node.
        Traverses the graph up to max_depth hops to find all affected entities.
        """
        visited: set[str] = set()
        affected: list[dict[str, Any]] = []
        queue: list[tuple[str, str, int]] = [(node_type.value, node_id, 0)]

        while queue:
            current_type, current_id, depth = queue.pop(0)
            key = f"{current_type}:{current_id}"

            if key in visited or depth > max_depth:
                continue
            visited.add(key)

            if depth > 0:
                node = await self.get_node(NodeType(current_type), current_id)
                affected.append({
                    "node_type": current_type,
                    "node_id": current_id,
                    "name": node.get("name", "") if node else "",
                    "risk_level": node.get("risk_level", "unknown") if node else "unknown",
                    "depth": depth,
                })

            # Get neighbors for next level
            neighbors = await self.get_neighbors(NodeType(current_type), current_id)
            for neighbor in neighbors:
                nkey = f"{neighbor['node_type']}:{neighbor['node_id']}"
                if nkey not in visited:
                    queue.append((neighbor["node_type"], neighbor["node_id"], depth + 1))

        # Categorize affected entities
        by_type: dict[str, int] = {}
        by_risk: dict[str, int] = {}
        for entity in affected:
            by_type[entity["node_type"]] = by_type.get(entity["node_type"], 0) + 1
            by_risk[entity["risk_level"]] = by_risk.get(entity["risk_level"], 0) + 1

        return {
            "source": {"node_type": node_type.value, "node_id": node_id},
            "total_affected": len(affected),
            "max_depth_reached": max_depth,
            "by_type": by_type,
            "by_risk": by_risk,
            "affected_entities": affected[:50],  # Limit response size
        }

    async def contextualize_alert(self, actor: str, ip: str) -> dict[str, Any]:
        """
        Provide graph context for an alert.
        Links the alert to known entities, their relationships, and risk levels.
        """
        context: dict[str, Any] = {"actor": actor, "ip": ip, "entities": []}

        # Find user node
        try:
            user_resp = (
                self.db.table("security_graph_nodes")
                .select("*")
                .eq("node_type", "user")
                .or_(f"node_id.eq.{actor},properties->>email.eq.{actor}")
                .limit(1)
                .execute()
            )
            if user_resp.data:
                user = user_resp.data[0]
                context["user"] = user
                context["user_risk"] = user.get("risk_level")

                # Get user's assets
                neighbors = await self.get_neighbors(NodeType.USER, user["node_id"])
                context["user_assets"] = neighbors

            # Find IP node
            ip_resp = (
                self.db.table("security_graph_nodes")
                .select("*")
                .eq("node_type", "ip_address")
                .eq("node_id", ip)
                .limit(1)
                .execute()
            )
            if ip_resp.data:
                context["ip_node"] = ip_resp.data[0]
                context["ip_risk"] = ip_resp.data[0].get("risk_level")

        except Exception as exc:
            logger.warning("Alert contextualization failed: %s", exc)

        return context

    # -----------------------------------------------------------------------
    # Graph Statistics
    # -----------------------------------------------------------------------

    async def get_graph_stats(self) -> dict[str, Any]:
        """Get overall graph statistics."""
        stats: dict[str, Any] = {"nodes": {}, "edges": {}}

        try:
            for node_type in NodeType:
                resp = (
                    self.db.table("security_graph_nodes")
                    .select("id", count="exact")
                    .eq("node_type", node_type.value)
                    .execute()
                )
                stats["nodes"][node_type.value] = resp.count or 0

            for edge_type in EdgeType:
                resp = (
                    self.db.table("security_graph_edges")
                    .select("id", count="exact")
                    .eq("edge_type", edge_type.value)
                    .execute()
                )
                stats["edges"][edge_type.value] = resp.count or 0

            stats["total_nodes"] = sum(stats["nodes"].values())
            stats["total_edges"] = sum(stats["edges"].values())

        except Exception as exc:
            logger.error("Failed to get graph stats: %s", exc)

        return stats
