import pytest

from backend.app.services.wearable_hud import build_hud_instruction


def test_build_hud_instruction_from_hermes_summary():
    hud = build_hud_instruction({"summary": "Hermes task complete"})
    assert hud == {
        "action": "display.hud.render",
        "surface": "primary",
        "text": "Hermes task complete",
        "ttl_ms": 8000,
        "priority": "normal",
    }


def test_build_hud_instruction_reads_nested_result():
    hud = build_hud_instruction({"result": {"text": "Nested answer"}})
    assert hud["text"] == "Nested answer"


def test_build_hud_instruction_omits_non_displayable_results():
    assert build_hud_instruction({"status": "queued", "task_id": "abc"}) is None


def test_build_hud_instruction_bounds_ttl():
    with pytest.raises(ValueError):
        build_hud_instruction("hello", ttl_ms=60001)


def test_build_hud_instruction_truncates_large_text():
    hud = build_hud_instruction("x" * 1200)
    assert len(hud["text"]) == 1000
