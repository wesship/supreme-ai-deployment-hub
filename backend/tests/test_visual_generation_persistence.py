from backend.ai_films.generation_dispatch_startup import _visual_context


def test_visual_context_preserves_original_and_compiled_prompts():
    packet = {
        "schema": "d3vonn.ai-films.generation-packet/v1",
        "original_generation_prompt": "A simple hero frame",
        "generation_prompt": "A simple hero frame, cinematic composition, motivated lighting",
        "negative_prompt": "flat lighting, visual clutter",
        "visual_intelligence": {
            "style_id": "cinematic-storyboard",
            "source": "d3vonn",
            "compiler": "d3vonn.visual_intelligence.v1",
            "metadata": {"shot_id": "SH001"},
            "warnings": [],
        },
    }

    context = _visual_context(packet, selected_model="pollo-v2-5")

    assert context["original_prompt"] == "A simple hero frame"
    assert "cinematic composition" in context["compiled_prompt"]
    assert context["negative_prompt"] == "flat lighting, visual clutter"
    assert context["style_id"] == "cinematic-storyboard"
    assert context["style_source"] == "d3vonn"
    assert context["compiler"] == "d3vonn.visual_intelligence.v1"
    assert context["compiler_metadata"] == {"shot_id": "SH001"}
    assert context["selected_model"] == "pollo-v2-5"
    assert context["packet_schema"] == "d3vonn.ai-films.generation-packet/v1"


def test_visual_context_degrades_safely_without_visual_metadata():
    context = _visual_context(
        {
            "schema": "d3vonn.ai-films.generation-packet/v1",
            "generation_prompt": "legacy prompt",
        },
        selected_model=None,
    )

    assert context["compiled_prompt"] == "legacy prompt"
    assert context["style_id"] is None
    assert context["style_source"] is None
    assert context["warnings"] == []
    assert context["selected_model"] is None
