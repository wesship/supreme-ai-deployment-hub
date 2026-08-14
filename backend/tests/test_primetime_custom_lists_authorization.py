import asyncio

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from backend.app.routers import primetime_custom_lists as router

WORKSPACE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
USER_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
LIST_ID = "11111111-1111-4111-8111-111111111111"
PERSON_ID = "22222222-2222-4222-8222-222222222222"


def run(coro):
    return asyncio.run(coro)


def test_nonmember_cannot_list_custom_lists(monkeypatch):
    async def deny_membership(workspace_id: str, user_id: str):
        raise HTTPException(status_code=403, detail="Workspace access required")

    monkeypatch.setattr(router, "_membership_required", deny_membership)

    with pytest.raises(HTTPException) as exc:
        run(router.list_custom_lists(WORKSPACE_ID, False, USER_ID))

    assert exc.value.status_code == 403


def test_representative_cannot_archive_custom_list(monkeypatch):
    async def representative_context(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "representative"}

    monkeypatch.setattr(router, "_membership_required", representative_context)

    with pytest.raises(HTTPException) as exc:
        run(router.archive_custom_list(LIST_ID, router._WorkspaceBody(workspace_id=WORKSPACE_ID), USER_ID))

    assert exc.value.status_code == 403
    assert exc.value.detail == "Insufficient PRIMETIME role"


def test_add_member_uses_authenticated_workspace_and_actor(monkeypatch):
    async def manager_context(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "manager"}

    captured = {}

    async def capture_rpc(name: str, payload: dict):
        captured["name"] = name
        captured["payload"] = payload
        return {"id": "33333333-3333-4333-8333-333333333333"}

    monkeypatch.setattr(router, "_membership_required", manager_context)
    monkeypatch.setattr(router, "_rpc", capture_rpc)

    body = router.CustomListMemberChange(workspace_id=WORKSPACE_ID, person_id=PERSON_ID)
    run(router.add_custom_list_member(LIST_ID, body, USER_ID))

    assert captured["name"] == "primetime_add_custom_list_member"
    assert captured["payload"] == {
        "p_workspace_id": WORKSPACE_ID,
        "p_actor_id": USER_ID,
        "p_list_id": LIST_ID,
        "p_person_id": PERSON_ID,
    }


def test_whitespace_only_display_name_is_rejected_before_storage():
    with pytest.raises(ValidationError):
        router.CustomListCreate(workspace_id=WORKSPACE_ID, display_name="   ")


def test_empty_update_is_rejected_before_rpc(monkeypatch):
    async def manager_context(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "manager"}

    async def must_not_rpc(*args, **kwargs):
        raise AssertionError("Empty updates must not reach storage")

    monkeypatch.setattr(router, "_membership_required", manager_context)
    monkeypatch.setattr(router, "_rpc", must_not_rpc)

    body = router.CustomListUpdate(workspace_id=WORKSPACE_ID)
    with pytest.raises(HTTPException) as exc:
        run(router.update_custom_list(LIST_ID, body, USER_ID))

    assert exc.value.status_code == 422


def test_duplicate_storage_violation_maps_to_conflict(monkeypatch):
    class Response:
        status_code = 409
        content = b'{}'

        def json(self):
            return {"code": "23505", "message": "duplicate key"}

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

        async def post(self, *args, **kwargs):
            return Response()

    monkeypatch.setattr(router.httpx, "AsyncClient", lambda timeout=10: Client())
    monkeypatch.setattr(router, "_get_supabase_base", lambda: "https://example.supabase.co")
    monkeypatch.setattr(router, "_headers", lambda: {})

    with pytest.raises(HTTPException) as exc:
        run(router._rpc("primetime_create_custom_list", {}))

    assert exc.value.status_code == 409
