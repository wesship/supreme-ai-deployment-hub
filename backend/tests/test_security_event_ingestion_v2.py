from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from backend.app.security import correlation, detection, knowledge_graph, router_v2, soar, threat_intel


@pytest.mark.parametrize("matched", [False, True])
async def test_ingestion_uses_detection_evaluator_and_correlates_only_alerts(monkeypatch, matched):
    stored = {"id": "event-1", "event_type": "login_failed"}
    alert = {"id": "alert-1", "actor": "user-1"} if matched else None
    db = Mock()
    db.table.return_value.insert.return_value.execute.return_value = SimpleNamespace(data=[stored])
    monkeypatch.setattr(router_v2, "get_db", lambda: db)
    evaluate = AsyncMock(return_value=alert)
    monkeypatch.setattr(detection, "evaluate_event", evaluate)
    correlate = AsyncMock(return_value=[{"id": "correlation-1"}])
    monkeypatch.setattr(correlation.CorrelationEngine, "correlate_alert", correlate)
    enrich = AsyncMock(return_value={"threat_level": "low"})
    monkeypatch.setattr(threat_intel.ThreatIntelligenceLayer, "enrich_event", enrich)
    ingest = AsyncMock()
    monkeypatch.setattr(knowledge_graph.SecurityKnowledgeGraph, "ingest_event", ingest)
    handle = AsyncMock(return_value={"status": "approval_required"})
    monkeypatch.setattr(soar.SOAREngine, "handle_alert", handle)

    result = await router_v2.ingest_event_v2(router_v2.SecurityEventV2(source="auth", event_type="login_failed"))

    evaluate.assert_awaited_once_with(db, stored)
    ingest.assert_awaited_once_with(stored)
    enrich.assert_awaited_once_with(stored)
    assert result["event_id"] == "event-1"
    assert result["alerts_generated"] == result["correlations_found"] == result["soar_executed"] == int(matched)
    if matched:
        correlate.assert_awaited_once_with(alert)
        handle.assert_awaited_once_with(alert)
    else:
        correlate.assert_not_awaited()
        handle.assert_not_awaited()
