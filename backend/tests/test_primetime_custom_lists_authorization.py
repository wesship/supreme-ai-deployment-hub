import asyncio

import pytest
from fastapi import HTTPException

from backend.app.routers import primetime_custom_lists as router

WORKSPACE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
OTHER_WORKSPACE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
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
    assert exc.value.detail == "Workspace access required"


def test_representative_cannot_archive_custom_list(monkeypatch):
    async def representative_context(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "representative"}

    monkeypatch.setattr(router, "_membership_required", representative_context)

    with pytest.raises(HTTPException) as exc:
        run(router.archive_custom_list(LIST_ID, router.CustomListArchive(workspace_id=WORKSPACE_ID), USER_ID))

    assert exc.value.status_code == 403
    assert exc.value.detail == "Insufficient PRIMETIME role"


def test_person_from_another_workspace_cannot_be_added(monkeypatch):
    async def no_person(table: str, params: dict[str, str]):
        assert table == "people"
        assert params["workspace_id"] == f"eq.{WORKSPACE_ID}"
        assert OTHER_WORKSPACE_ID not in params.values()
        return []

    monkeypatch.setattr(router, "_query", no_person)

    with pytest.raises(HTTPException) as exc:
        run(router._person_required(PERSON_ID, WORKSPACE_ID))

    assert exc.value.status_code == 404
    assert exc.value.detail == "Person not found in workspace"


def test_archived_list_cannot_accept_new_members(monkeypatch):
    async def manager_context(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "manager"}

    async def archived_list(list_id: str, workspace_id: str):
        return {"id": list_id, "workspace_id": workspace_id, "archived_at": "2026-07-25T12:00:00Z"}

    async def must_not_insert(*args, **kwargs):
        raise AssertionError("Archived list membership must not be inserted")

    monkeypatch.setattr(router, "_membership_required", manager_context)
    monkeypatch.setattr(router, "_list_required", archived_list)
    monkeypatch.setattr(router, "_insert", must_not_insert)

    body = router.CustomListMemberChange(workspace_id=WORKSPACE_ID, person_id=PERSON_ID)
    with pytest.raises(HTTPException) as exc:
        run(router.add_custom_list_member(LIST_ID, body, USER_ID))

    assert exc.value.status_code == 409
    assert exc.value.detail == "Archived custom lists cannot change membership"


def test_archived_list_cannot_remove_members(monkeypatch):
    async def representative_context(workspace_id: str, user_id: str):
        return {"workspace_id": workspace_id, "role": "representative"}

    async def archived_list(list_id: str, workspace_id: str):
        return {"id": list_id, "workspace_id": workspace_id, "archived_at": "2026-07-25T12:00:00Z"}

    async def must_not_patch(*args, **kwargs):
        raise AssertionError("Archived list membership must not be changed")

    monkeypatch.setattr(router, "_membership_required", representative_context)
    monkeypatch.setattr(router, "_list_required", archived_list)
    monkeypatch.setattr(router, "_patch", must_not_patch)

    body = router.CustomListArchive(workspace_id=WORKSPACE_ID)
    with pytest.raises(HTTPException) as exc:
        run(router.remove_custom_list_member(LIST_ID, PERSON_ID, body, USER_ID))

    assert exc.value.status_code == 409
    assert exc.value.detail == "Archived custom lists cannot change membership"
