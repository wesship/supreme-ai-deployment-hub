from __future__ import annotations

import pytest

from backend.hermes.adapters import SupabaseCheckpointStore
from backend.hermes.ports import CheckpointStore
from backend.hermes.testing import InMemoryTaskRepository


@pytest.mark.asyncio
async def test_supabase_checkpoint_store_uses_existing_table_contract() -> None:
    repository = InMemoryTaskRepository()
    store = SupabaseCheckpointStore(repository)  # type: ignore[arg-type]

    first = {"schema_version": "1.0", "sequence": 1, "snapshot": {"value": "first"}}
    second = {"schema_version": "1.0", "sequence": 2, "snapshot": {"value": "second"}}

    await store.save(
        user_id="user-1",
        goal_id="goal-1",
        execution_id="exec-1",
        sequence=1,
        envelope=first,
    )
    await store.save(
        user_id="user-1",
        goal_id="goal-1",
        execution_id="exec-1",
        sequence=2,
        envelope=second,
    )

    rows = repository.tables["hermes_checkpoints"]
    assert rows[0]["title"] == "workflow:exec-1:checkpoint:00000000000000000001"
    assert rows[1]["title"] == "workflow:exec-1:checkpoint:00000000000000000002"
    assert isinstance(rows[0]["content"], str)
    assert await store.latest(goal_id="goal-1", execution_id="exec-1") == second
    assert await store.get(goal_id="goal-1", execution_id="exec-1", sequence=1) == first
    assert isinstance(store, CheckpointStore)
