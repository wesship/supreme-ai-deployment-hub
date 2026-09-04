import json

from backend.game_dev.godmod3_location_router import (
    LocationIdeasRequest,
    _extract_json,
    _user_prompt,
)


def test_extract_json_accepts_plain_object():
    payload = {"ideas": [{"id": "LOC_CH01_001"}]}
    assert _extract_json(json.dumps(payload)) == payload


def test_extract_json_accepts_markdown_fence():
    payload = {"ideas": [{"id": "LOC_CH01_001"}]}
    text = f"```json\n{json.dumps(payload)}\n```"
    assert _extract_json(text) == payload


def test_user_prompt_includes_requested_count_and_constraints():
    request = LocationIdeasRequest(
        chapter_id="CH01",
        reality="Echo",
        location_type="impossible-space",
        count=4,
        constraints=["60 FPS target"],
        required_elements=["Door threshold", "Foresight reveal"],
        forbidden_elements=["random topology"],
    )
    prompt = _user_prompt(request)
    assert '"count": 4' in prompt
    assert '"reality": "Echo"' in prompt
    assert "60 FPS target" in prompt
    assert "Foresight reveal" in prompt
    assert "random topology" in prompt
