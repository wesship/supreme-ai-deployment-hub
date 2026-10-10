"""
backend/app/security/digital_twin/ — Platform Digital Twin

Continuously updated model of the platform that tracks:
- Service health and availability
- Topology and service dependencies
- Deployment versions
- Dependency graph
- Attack paths and exposure
- Blast radius for each component
- Tenant impact analysis

Complements the knowledge graph by representing the live operational state.
"""

from .twin import DigitalTwin, ServiceState, ComponentHealth

__all__ = ["DigitalTwin", "ServiceState", "ComponentHealth"]
