from backend.ai_films.manifest_conform_review import _extract_json, build_review_payload


def test_extract_json_accepts_fenced_payload():
    payload = _extract_json('```json\n{"shots":[{"shot_id":"S1","decision":"reuse"}]}\n```')
    assert payload == {"shots": [{"shot_id": "S1", "decision": "reuse"}]}


def test_review_payload_contains_candidates_and_canon():
    manifest = {
        "shots": [{"shot_id": "S1", "purpose": "test", "action": "act", "characters": ["legend"], "continuity_locks": ["lock"], "canon_refs": ["legend.wardrobe"]}],
        "metadata": {"conform_results": {"S1": {"candidates": [{"video_id": "v1"}]}}},
    }
    bible = {"version": 1, "canon_rules": [{"key": "legend.wardrobe"}], "characters": [{"character_id": "legend"}], "events": []}
    payload = build_review_payload(manifest, bible)
    assert payload["shots"][0]["candidates"][0]["video_id"] == "v1"
    assert payload["production_bible"]["version"] == 1
