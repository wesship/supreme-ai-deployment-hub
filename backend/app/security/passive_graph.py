"""Strict persistence of passive threat-intelligence findings into the existing Security Knowledge Graph."""
from __future__ import annotations

import hashlib
from typing import Any


class PassiveGraphError(RuntimeError):
    pass


def indicator_fingerprint(indicator: str) -> str:
    return hashlib.sha256(indicator.encode("utf-8")).hexdigest()


def _node_type(indicator_type: str) -> str:
    return "ip" if indicator_type == "ip" else "ioc"


def persist_passive_finding(db: Any, result: Any) -> dict[str, str]:
    """Persist a normalized passive finding and provider relationship.

    The raw indicator is used only as the graph entity identifier required by the
    existing graph model. Audit/event records continue to store only its SHA-256
    fingerprint. This function performs no network activity and raises on any
    persistence failure so callers cannot report enrichment success without graph
    durability.
    """
    indicator = str(result.indicator)
    fingerprint = indicator_fingerprint(indicator)
    entity_type = _node_type(str(result.indicator_type))
    entity_id = indicator
    provider_id = f"threat-intel-provider:{result.provider}"

    entity = {
        "node_type": entity_type,
        "node_id": entity_id,
        "label": indicator,
        "properties": {
            "indicator_type": result.indicator_type,
            "indicator_sha256": fingerprint,
            "provider": result.provider,
            "provider_object_id": result.raw_id,
            "reputation": result.reputation,
            "malicious": result.malicious,
            "suspicious": result.suspicious,
            "harmless": result.harmless,
            "undetected": result.undetected,
            "tags": list(result.tags),
            "source_class": "passive_threat_intelligence",
            "active_scan": False,
        },
        "risk_score": min(100, (int(result.malicious) * 20) + (int(result.suspicious) * 10)),
    }
    provider = {
        "node_type": "organization",
        "node_id": provider_id,
        "label": result.provider,
        "properties": {
            "role": "threat_intelligence_provider",
            "source_class": "passive_threat_intelligence",
        },
    }

    try:
        entity_resp = db.table("security_graph_nodes").upsert(
            entity, on_conflict="node_type,node_id"
        ).execute()
        provider_resp = db.table("security_graph_nodes").upsert(
            provider, on_conflict="node_type,node_id"
        ).execute()
        entity_row = (entity_resp.data or [None])[0]
        provider_row = (provider_resp.data or [None])[0]
        if not isinstance(entity_row, dict) or not entity_row.get("id"):
            raise PassiveGraphError("graph_entity_persist_failed")
        if not isinstance(provider_row, dict) or not provider_row.get("id"):
            raise PassiveGraphError("graph_provider_persist_failed")

        existing = (
            db.table("security_graph_edges")
            .select("id")
            .eq("source_node_id", str(entity_row["id"]))
            .eq("target_node_id", str(provider_row["id"]))
            .eq("relationship", "enriched_by")
            .limit(1)
            .execute()
        )
        if not existing.data:
            edge_resp = db.table("security_graph_edges").insert(
                {
                    "source_node_id": str(entity_row["id"]),
                    "target_node_id": str(provider_row["id"]),
                    "relationship": "enriched_by",
                    "weight": 1.0,
                    "properties": {
                        "indicator_sha256": fingerprint,
                        "activity_class": "passive",
                        "active_scan": False,
                    },
                }
            ).execute()
            if not edge_resp.data:
                raise PassiveGraphError("graph_edge_persist_failed")

        return {
            "node_type": entity_type,
            "node_id": entity_id,
            "indicator_sha256": fingerprint,
            "provider_node_id": provider_id,
        }
    except PassiveGraphError:
        raise
    except Exception as exc:
        raise PassiveGraphError("graph_persist_failed") from exc
