import asyncio

from backend.app.routers import d3vonn_events as event_router


WORKSPACE_ID = "b7c0ccda-88d3-48cf-ab91-811fd73a3d79"
USER_ID = "01efde25-7c02-4bda-bcec-1c07f18b95e7"


def test_lists_workspace_scoped_domain_events(monkeypatch):
    calls: dict[str, object] = {}

    async def fake_membership(workspace_id: str, user_id: str):
        calls["membership"] = (workspace_id, user_id)
        return {"workspace_id": workspace_id, "role": "representative"}

    async def fake_query(table: str, params: dict[str, str]):
        calls["query"] = (table, params)
        return [
            {
                "id": "a24c8194-10f8-41a4-9248-3fbc48ec23c0",
                "workspace_id": WORKSPACE_ID,
                "actor_id": USER_ID,
                "action": "lead.created",
                "entity_type": "lead",
                "entity_id": "d25e523c-5829-4508-aefd-c61794967371",
                "metadata": {"source": "referral"},
                "created_at": "2026-08-06T20:00:00+00:00",
            }
        ]

    monkeypatch.setattr(event_router, "_membership_required", fake_membership)
    monkeypatch.setattr(event_router, "_query", fake_query)

    page = asyncio.run(
        event_router.list_domain_events(
            workspace_id=WORKSPACE_ID,
            limit=50,
            offset=0,
            event_type=None,
            aggregate_type=None,
            user_id=USER_ID,
        )
    )

    assert calls["membership"] == (WORKSPACE_ID, USER_ID)
    table, params = calls["query"]
    assert table == "audit_events"
    assert params["workspace_id"] == f"eq.{WORKSPACE_ID}"
    assert params["order"] == "created_at.desc,id.desc"
    assert page.items[0].eventType == "lead.created"
    assert page.nextOffset is None


def test_applies_filters_and_pagination(monkeypatch):
    captured: dict[str, str] = {}

    async def fake_membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "representative"}

    async def fake_query(table: str, params: dict[str, str]):
        captured.update(params)
        return []

    monkeypatch.setattr(event_router, "_membership_required", fake_membership)
    monkeypatch.setattr(event_router, "_query", fake_query)

    page = asyncio.run(
        event_router.list_domain_events(
            workspace_id=WORKSPACE_ID,
            limit=25,
            offset=50,
            event_type="lead.created",
            aggregate_type="lead",
            user_id=USER_ID,
        )
    )

    assert captured["action"] == "eq.lead.created"
    assert captured["entity_type"] == "eq.lead"
    assert captured["limit"] == "25"
    assert captured["offset"] == "50"
    assert page.offset == 50
    assert page.nextOffset is None


def test_next_offset_when_page_is_full(monkeypatch):
    async def fake_membership(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "representative"}

    row = {
        "id": "a24c8194-10f8-41a4-9248-3fbc48ec23c0",
        "workspace_id": WORKSPACE_ID,
        "actor_id": USER_ID,
        "action": "lead.created",
        "entity_type": "lead",
        "entity_id": "d25e523c-5829-4508-aefd-c61794967371",
        "metadata": {},
        "created_at": "2026-08-06T20:00:00+00:00",
    }

    async def fake_query(table: str, params: dict[str, str]):
        return [row, {**row, "id": "b24c8194-10f8-41a4-9248-3fbc48ec23c0"}]

    monkeypatch.setattr(event_router, "_membership_required", fake_membership)
    monkeypatch.setattr(event_router, "_query", fake_query)

    page = asyncio.run(
        event_router.list_domain_events(
            workspace_id=WORKSPACE_ID,
            limit=2,
            offset=4,
            event_type=None,
            aggregate_type=None,
            user_id=USER_ID,
        )
    )

    assert page.nextOffset == 6
