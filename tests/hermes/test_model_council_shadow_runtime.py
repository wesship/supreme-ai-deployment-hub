from __future__ import annotations

import pytest

from backend.hermes.model_council.shadow_runtime import (
    _candidate_specs_from_env,
    _prompt_from_input,
    build_shadow_step_observer,
)
from backend.hermes.testing import InMemoryEventSink


def test_candidate_specs_require_explicit_provider_model_pairs(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(
        "HERMES_MODEL_COUNCIL_CANDIDATES",
        "openai:model-a, invalid, openai:model-b",
    )
    specs = _candidate_specs_from_env()
    assert [(spec.provider, spec.model) for spec in specs] == [
        ("openai", "model-a"),
        ("openai", "model-b"),
    ]


def test_prompt_extraction_is_limited_to_explicit_text_fields() -> None:
    assert _prompt_from_input({"query": "Assess this workflow"}) == "Assess this workflow"
    assert _prompt_from_input({"payload": {"secret": "do-not-serialize"}}) is None


@pytest.mark.asyncio
async def test_shadow_observer_is_inert_when_feature_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("HERMES_MODEL_COUNCIL_ENABLED", raising=False)
    monkeypatch.setenv("HERMES_MODEL_COUNCIL_SHADOW_MODE", "true")
    events = InMemoryEventSink()

    await build_shadow_step_observer(events)(
        execution_id="exec-1",
        workflow_id="wf-1",
        step_id="step-1",
        agent_name="AGENT",
        input_data={"prompt": "test"},
    )

    assert events.events == []


@pytest.mark.asyncio
async def test_shadow_observer_skips_without_candidate_configuration(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("HERMES_MODEL_COUNCIL_ENABLED", "true")
    monkeypatch.setenv("HERMES_MODEL_COUNCIL_SHADOW_MODE", "true")
    monkeypatch.delenv("HERMES_MODEL_COUNCIL_CANDIDATES", raising=False)
    events = InMemoryEventSink()

    await build_shadow_step_observer(events)(
        execution_id="exec-1",
        workflow_id="wf-1",
        step_id="step-1",
        agent_name="AGENT",
        input_data={"prompt": "test"},
    )

    assert events.events[-1]["event"] == "model_council.shadow.skipped"
    assert events.events[-1]["reason"] == "no_candidates_configured"
    assert "prompt" not in events.events[-1]
