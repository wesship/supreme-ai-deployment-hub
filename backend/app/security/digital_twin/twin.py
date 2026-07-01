"""
backend/app/security/digital_twin/twin.py — Platform Digital Twin Core

A continuously updated model of the platform's live operational state.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger("d3vonn.digital_twin")


class ComponentHealth(str, Enum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"
    MAINTENANCE = "maintenance"


class ServiceState(str, Enum):
    RUNNING = "running"
    STOPPED = "stopped"
    STARTING = "starting"
    STOPPING = "stopping"
    CRASHED = "crashed"
    DEPLOYING = "deploying"


class DigitalTwin:
    """
    Platform Digital Twin — maintains a real-time model of the platform.
    Tracks services, dependencies, versions, health, attack surfaces, and blast radii.
    """

    def __init__(self, supabase_client: Any):
        self.db = supabase_client
        self._services: dict[str, dict[str, Any]] = {}
        self._topology: dict[str, list[str]] = {}  # service -> dependencies
        self._last_sync: Optional[datetime] = None

    # -----------------------------------------------------------------------
    # Service Registry
    # -----------------------------------------------------------------------

    async def register_service(
        self,
        service_id: str,
        name: str,
        service_type: str = "microservice",
        version: str = "unknown",
        environment: str = "production",
        dependencies: list[str] = None,
        endpoints: list[str] = None,
        owner: str = "",
        tenant_ids: list[str] = None,
        metadata: dict[str, Any] = None,
    ) -> dict[str, Any]:
        """Register or update a service in the digital twin."""
        service_data = {
            "service_id": service_id,
            "name": name,
            "service_type": service_type,
            "version": version,
            "environment": environment,
            "state": ServiceState.RUNNING.value,
            "health": ComponentHealth.HEALTHY.value,
            "dependencies": dependencies or [],
            "endpoints": endpoints or [],
            "owner": owner,
            "tenant_ids": tenant_ids or [],
            "metadata": metadata or {},
            "last_heartbeat": datetime.now(timezone.utc).isoformat(),
            "registered_at": datetime.now(timezone.utc).isoformat(),
        }

        self._services[service_id] = service_data
        if dependencies:
            self._topology[service_id] = dependencies

        try:
            existing = (
                self.db.table("security_digital_twin_services")
                .select("id")
                .eq("service_id", service_id)
                .limit(1)
                .execute()
            )

            if existing.data:
                self.db.table("security_digital_twin_services").update(service_data).eq("id", existing.data[0]["id"]).execute()
            else:
                self.db.table("security_digital_twin_services").insert(service_data).execute()
        except Exception as exc:
            logger.warning("Failed to persist service to DB: %s", exc)

        return service_data

    async def update_health(self, service_id: str, health: ComponentHealth, details: str = "") -> dict[str, Any]:
        """Update a service's health status."""
        if service_id in self._services:
            self._services[service_id]["health"] = health.value
            self._services[service_id]["health_details"] = details
            self._services[service_id]["last_heartbeat"] = datetime.now(timezone.utc).isoformat()

        try:
            self.db.table("security_digital_twin_services").update({
                "health": health.value,
                "health_details": details,
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
            }).eq("service_id", service_id).execute()
        except Exception:
            pass

        return {"service_id": service_id, "health": health.value, "details": details}

    async def update_version(self, service_id: str, version: str, deployed_by: str = "") -> dict[str, Any]:
        """Record a version deployment."""
        if service_id in self._services:
            self._services[service_id]["version"] = version
            self._services[service_id]["state"] = ServiceState.DEPLOYING.value

        try:
            self.db.table("security_digital_twin_services").update({
                "version": version,
                "state": ServiceState.RUNNING.value,
                "last_deploy": datetime.now(timezone.utc).isoformat(),
                "deployed_by": deployed_by,
            }).eq("service_id", service_id).execute()

            # Log deployment event
            self.db.table("security_digital_twin_deployments").insert({
                "service_id": service_id,
                "version": version,
                "deployed_by": deployed_by,
                "deployed_at": datetime.now(timezone.utc).isoformat(),
                "status": "success",
            }).execute()
        except Exception as exc:
            logger.warning("Failed to record deployment: %s", exc)

        return {"service_id": service_id, "version": version, "deployed_by": deployed_by}

    # -----------------------------------------------------------------------
    # Topology & Dependencies
    # -----------------------------------------------------------------------

    async def get_topology(self) -> dict[str, Any]:
        """Get the full service topology."""
        try:
            services = (
                self.db.table("security_digital_twin_services")
                .select("service_id, name, dependencies, health, state, version")
                .execute()
            )

            nodes = []
            edges = []
            for svc in (services.data or []):
                nodes.append({
                    "id": svc["service_id"],
                    "name": svc.get("name", svc["service_id"]),
                    "health": svc.get("health", "unknown"),
                    "state": svc.get("state", "unknown"),
                    "version": svc.get("version", "unknown"),
                })
                for dep in (svc.get("dependencies") or []):
                    edges.append({"source": svc["service_id"], "target": dep, "type": "depends_on"})

            return {"nodes": nodes, "edges": edges, "total_services": len(nodes)}
        except Exception as exc:
            return {"error": str(exc)}

    async def get_dependency_chain(self, service_id: str, max_depth: int = 5) -> dict[str, Any]:
        """Get the full dependency chain for a service."""
        visited: set[str] = set()
        chain: list[dict[str, Any]] = []

        async def _traverse(svc_id: str, depth: int):
            if svc_id in visited or depth > max_depth:
                return
            visited.add(svc_id)

            svc = self._services.get(svc_id)
            if not svc:
                try:
                    resp = (
                        self.db.table("security_digital_twin_services")
                        .select("*")
                        .eq("service_id", svc_id)
                        .limit(1)
                        .execute()
                    )
                    svc = resp.data[0] if resp.data else None
                except Exception:
                    svc = None

            if svc:
                chain.append({"service_id": svc_id, "depth": depth, "health": svc.get("health", "unknown")})
                for dep in (svc.get("dependencies") or []):
                    await _traverse(dep, depth + 1)

        await _traverse(service_id, 0)
        return {"service_id": service_id, "chain": chain, "total_dependencies": len(chain) - 1}

    # -----------------------------------------------------------------------
    # Attack Surface & Blast Radius
    # -----------------------------------------------------------------------

    async def compute_attack_surface(self, service_id: str) -> dict[str, Any]:
        """Compute the attack surface for a service."""
        svc = self._services.get(service_id)
        if not svc:
            try:
                resp = (
                    self.db.table("security_digital_twin_services")
                    .select("*")
                    .eq("service_id", service_id)
                    .limit(1)
                    .execute()
                )
                svc = resp.data[0] if resp.data else None
            except Exception:
                return {"error": "Service not found"}

        if not svc:
            return {"error": "Service not found"}

        endpoints = svc.get("endpoints", [])
        dependencies = svc.get("dependencies", [])

        attack_surface = {
            "service_id": service_id,
            "endpoints_exposed": len(endpoints),
            "dependencies_count": len(dependencies),
            "internet_facing": any("public" in str(e).lower() for e in endpoints),
            "risk_factors": [],
            "attack_vectors": [],
        }

        # Assess risk factors
        if attack_surface["internet_facing"]:
            attack_surface["risk_factors"].append("Internet-facing endpoints")
            attack_surface["attack_vectors"].append("Direct external access")

        if len(dependencies) > 5:
            attack_surface["risk_factors"].append("High dependency count increases supply chain risk")
            attack_surface["attack_vectors"].append("Dependency compromise")

        if svc.get("environment") == "production":
            attack_surface["risk_factors"].append("Production environment — high impact if compromised")

        return attack_surface

    async def compute_blast_radius(self, service_id: str) -> dict[str, Any]:
        """
        Compute blast radius: what gets affected if this service is compromised.
        Traverses reverse dependencies to find all dependent services.
        """
        affected: list[str] = []
        affected_tenants: set[str] = set()

        try:
            # Find all services that depend on this one
            all_services = (
                self.db.table("security_digital_twin_services")
                .select("service_id, name, dependencies, tenant_ids")
                .execute()
            )

            # Build reverse dependency map
            reverse_deps: dict[str, list[str]] = {}
            for svc in (all_services.data or []):
                for dep in (svc.get("dependencies") or []):
                    if dep not in reverse_deps:
                        reverse_deps[dep] = []
                    reverse_deps[dep].append(svc["service_id"])

            # BFS from the target service
            queue = [service_id]
            visited: set[str] = set()

            while queue:
                current = queue.pop(0)
                if current in visited:
                    continue
                visited.add(current)

                if current != service_id:
                    affected.append(current)

                # Find tenants
                svc_data = next(
                    (s for s in (all_services.data or []) if s["service_id"] == current), None
                )
                if svc_data:
                    for tid in (svc_data.get("tenant_ids") or []):
                        affected_tenants.add(tid)

                # Add reverse dependencies
                for dependent in reverse_deps.get(current, []):
                    if dependent not in visited:
                        queue.append(dependent)

        except Exception as exc:
            return {"error": str(exc)}

        return {
            "service_id": service_id,
            "affected_services": affected,
            "affected_service_count": len(affected),
            "affected_tenants": list(affected_tenants),
            "affected_tenant_count": len(affected_tenants),
            "severity": "critical" if len(affected) > 5 else "high" if len(affected) > 2 else "medium",
        }

    # -----------------------------------------------------------------------
    # Platform State Snapshot
    # -----------------------------------------------------------------------

    async def get_platform_state(self) -> dict[str, Any]:
        """Get a complete snapshot of the platform's current state."""
        try:
            services = (
                self.db.table("security_digital_twin_services")
                .select("*")
                .execute()
            )

            service_list = services.data or []
            healthy = sum(1 for s in service_list if s.get("health") == "healthy")
            degraded = sum(1 for s in service_list if s.get("health") == "degraded")
            unhealthy = sum(1 for s in service_list if s.get("health") == "unhealthy")

            return {
                "snapshot_at": datetime.now(timezone.utc).isoformat(),
                "total_services": len(service_list),
                "healthy": healthy,
                "degraded": degraded,
                "unhealthy": unhealthy,
                "overall_health": ComponentHealth.HEALTHY.value if unhealthy == 0 and degraded == 0
                    else ComponentHealth.DEGRADED.value if unhealthy == 0
                    else ComponentHealth.UNHEALTHY.value,
                "services": [
                    {
                        "id": s["service_id"],
                        "name": s.get("name"),
                        "health": s.get("health"),
                        "version": s.get("version"),
                        "last_heartbeat": s.get("last_heartbeat"),
                    }
                    for s in service_list
                ],
            }
        except Exception as exc:
            return {"error": str(exc)}

    # -----------------------------------------------------------------------
    # Stale Service Detection
    # -----------------------------------------------------------------------

    async def detect_stale_services(self, threshold_minutes: int = 15) -> list[dict[str, Any]]:
        """Detect services that haven't sent a heartbeat recently."""
        threshold = (datetime.now(timezone.utc) - timedelta(minutes=threshold_minutes)).isoformat()

        try:
            resp = (
                self.db.table("security_digital_twin_services")
                .select("service_id, name, last_heartbeat, health")
                .lt("last_heartbeat", threshold)
                .eq("state", "running")
                .execute()
            )
            return resp.data or []
        except Exception:
            return []
