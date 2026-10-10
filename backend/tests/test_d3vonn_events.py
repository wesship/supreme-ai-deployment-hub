from backend.app.platform.d3vonn_events import audit_row_to_domain_event


def test_adapts_primetime_audit_row_to_domain_event():
    event = audit_row_to_domain_event(
        {
            "id": "a24c8194-10f8-41a4-9248-3fbc48ec23c0",
            "workspace_id": "b7c0ccda-88d3-48cf-ab91-811fd73a3d79",
            "actor_id": "01efde25-7c02-4bda-bcec-1c07f18b95e7",
            "action": "lead.created",
            "entity_type": "lead",
            "entity_id": "d25e523c-5829-4508-aefd-c61794967371",
            "created_at": "2026-08-06T20:00:00+00:00",
            "metadata": {"source": "referral"},
        }
    )

    assert event.id == "a24c8194-10f8-41a4-9248-3fbc48ec23c0"
    assert event.workspaceId == "b7c0ccda-88d3-48cf-ab91-811fd73a3d79"
    assert event.eventType == "lead.created"
    assert event.aggregateType == "lead"
    assert event.aggregateId == "d25e523c-5829-4508-aefd-c61794967371"
    assert event.eventVersion == 1
    assert event.idempotencyKey == "primetime-audit:a24c8194-10f8-41a4-9248-3fbc48ec23c0"
    assert event.metadata["actorId"] == "01efde25-7c02-4bda-bcec-1c07f18b95e7"
    assert event.payload["metadata"] == {"source": "referral"}


def test_generates_stable_id_when_source_id_is_missing():
    row = {
        "workspace_id": "b7c0ccda-88d3-48cf-ab91-811fd73a3d79",
        "action": "person.created",
        "entity_type": "person",
        "entity_id": "514ce3b4-02c0-4460-8b4c-df1d7ab1db11",
        "created_at": "2026-08-06T20:01:00+00:00",
    }

    first = audit_row_to_domain_event(row)
    second = audit_row_to_domain_event(row)

    assert first.id == second.id
    assert first.idempotencyKey == second.idempotencyKey


def test_rejects_unscoped_audit_row():
    try:
        audit_row_to_domain_event(
            {
                "action": "lead.created",
                "entity_type": "lead",
                "entity_id": "d25e523c-5829-4508-aefd-c61794967371",
            }
        )
    except ValueError as error:
        assert "workspace_id" in str(error)
    else:
        raise AssertionError("expected unscoped audit row to be rejected")
