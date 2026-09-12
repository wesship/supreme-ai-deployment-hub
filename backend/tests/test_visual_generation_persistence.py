from backend.ai_films.generation_dispatch_startup import _visual_context
from backend.ai_films.generation_lifecycle import (
    provider_cost_metadata,
    quality_metadata,
    regeneration_allowed,
    regeneration_packet,
)
from backend.ai_films.provider_performance import (
    routing_adjustment,
    summarize_provider_intelligence,
    summarize_provider_performance,
)


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


def test_provider_metadata_does_not_infer_missing_price():
    metadata = provider_cost_metadata(
        {"id": "video_1"},
        {"usage": {"seconds": 8}},
        provider="openai",
        model="sora-2",
        seconds=8,
        size="1280x720",
    )
    assert metadata["usage"] == {"seconds": 8}
    assert metadata["cost_source"] == "not_reported"
    assert "cost_usd" not in metadata


def test_quality_metadata_bounds_confidence_and_tracks_revision():
    metadata = quality_metadata(
        {
            "confidence": 1.4,
            "reasons": ["wardrobe drift"],
            "canon_violations": ["logo visible"],
            "revision_prompt": "Remove the logo and preserve centered framing.",
        },
        decision="revise",
    )
    assert metadata["confidence"] == 1.0
    assert metadata["regeneration_requested"] is True
    assert metadata["revision_prompt"].startswith("Remove the logo")


def test_regeneration_requires_explicit_execution_and_auto_regen_gates():
    job = {"regeneration_count": 0}
    quality = {"decision": "revise", "revision_prompt": "fix framing"}
    assert regeneration_allowed(job, quality, {}) is False
    assert regeneration_allowed(
        job,
        quality,
        {"AI_FILM_AUTO_REGEN_ENABLED": "true", "AI_FILM_GENERATION_EXECUTION_ENABLED": "false"},
    ) is False
    assert regeneration_allowed(
        job,
        quality,
        {"AI_FILM_AUTO_REGEN_ENABLED": "true", "AI_FILM_GENERATION_EXECUTION_ENABLED": "true"},
    ) is True


def test_regeneration_respects_depth_and_preserves_lineage():
    quality = {"decision": "revise", "revision_prompt": "Keep wardrobe logo-free"}
    env = {
        "AI_FILM_AUTO_REGEN_ENABLED": "true",
        "AI_FILM_GENERATION_EXECUTION_ENABLED": "true",
        "AI_FILM_AUTO_REGEN_MAX": "1",
    }
    assert regeneration_allowed({"regeneration_count": 1}, quality, env) is False

    packet = regeneration_packet(
        {
            "id": "job-parent",
            "regeneration_count": 0,
            "input": {"generation_packet": {"generation_prompt": "Centered cinematic hero frame", "negative_prompt": "visual clutter"}},
        },
        quality,
    )
    assert "Centered cinematic hero frame" in packet["generation_prompt"]
    assert "Keep wardrobe logo-free" in packet["generation_prompt"]
    assert packet["negative_prompt"] == "visual clutter"
    assert packet["parent_render_job_id"] == "job-parent"
    assert packet["regeneration_count"] == 1


def test_provider_performance_requires_samples_and_is_bounded():
    rows = [
        {"provider": "pollo", "quality_metadata": {"decision": "pass", "confidence": 0.9}, "visual_context": {"style_id": "cinematic-storyboard"}},
        {"provider": "pollo", "quality_metadata": {"decision": "pass", "confidence": 0.8}, "visual_context": {"style_id": "cinematic-storyboard"}},
        {"provider": "pollo", "quality_metadata": {"decision": "revise", "confidence": 0.7}, "visual_context": {"style_id": "cinematic-storyboard"}},
    ]
    performance = summarize_provider_performance(rows)
    adjustment, reasons = routing_adjustment(performance, provider="pollo", style_id="cinematic-storyboard")
    assert performance["pollo"]["samples"] == 3
    assert performance["pollo|cinematic-storyboard"]["samples"] == 3
    assert -15 <= adjustment <= 15
    assert reasons and reasons[0].startswith("observed_style_performance:3:")


def test_provider_performance_does_not_nudge_with_insufficient_history():
    performance = summarize_provider_performance([
        {"provider": "pollo", "quality_metadata": {"decision": "pass", "confidence": 1.0}, "visual_context": {}}
    ])
    assert routing_adjustment(performance, provider="pollo") == (0, ())


def test_provider_intelligence_reports_latency_cost_failures_and_regeneration():
    rows = [
        {
            "provider": "pollo",
            "status": "completed",
            "started_at": "2026-09-12T18:00:00+00:00",
            "completed_at": "2026-09-12T18:01:00+00:00",
            "cost_metadata": {"cost_usd": 0.42},
            "quality_metadata": {"decision": "pass", "confidence": 0.9},
            "visual_context": {"style_id": "cinematic-storyboard"},
            "parent_job_id": None,
            "regeneration_count": 0,
        },
        {
            "provider": "pollo",
            "status": "failed",
            "started_at": "2026-09-12T18:02:00+00:00",
            "completed_at": "2026-09-12T18:02:30+00:00",
            "cost_metadata": {},
            "quality_metadata": {},
            "visual_context": {"style_id": "cinematic-storyboard"},
            "parent_job_id": "parent",
            "regeneration_count": 1,
        },
    ]
    result = summarize_provider_intelligence(rows)
    provider = result["providers"][0]
    assert result["sampled_jobs"] == 2
    assert provider["jobs"] == 2
    assert provider["failed"] == 1
    assert provider["failure_rate"] == 0.5
    assert provider["regeneration_rate"] == 0.5
    assert provider["mean_latency_seconds"] == 45.0
    assert provider["reported_cost_usd_total"] == 0.42
    assert provider["reported_cost_samples"] == 1
