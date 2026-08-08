from backend.ai_films.manifest_conform import build_conform_query, normalize_candidates


def test_build_conform_query_uses_story_fields_and_characters():
    query = build_conform_query({
        "purpose": "Establish Legend",
        "action": "Legend recognizes the signal",
        "generation_prompt": "centered clean frame",
        "characters": ["legend"],
    })
    assert "Establish Legend" in query
    assert "Legend recognizes the signal" in query
    assert "Characters: legend" in query


def test_normalize_candidates_preserves_asset_mapping_metadata():
    payload = {
        "data": [
            {
                "video_id": "vid_1",
                "score": 0.91,
                "start": 12.5,
                "end": 17.0,
                "user_metadata": {
                    "ai_film_asset_id": "asset-uuid",
                    "source_id": "clip.mp4",
                },
            }
        ]
    }
    rows = normalize_candidates(payload)
    assert rows == [{
        "video_id": "vid_1",
        "score": 0.91,
        "start": 12.5,
        "end": 17.0,
        "ai_film_asset_id": "asset-uuid",
        "source_id": "clip.mp4",
    }]
