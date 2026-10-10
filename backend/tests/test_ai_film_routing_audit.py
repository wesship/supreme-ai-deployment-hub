from backend.ai_films.generation_dispatch_startup import _routing_decision_snapshot
from backend.ai_films.generation_dispatcher_impl import VideoRoute, route_snapshot


def test_route_snapshot_records_structured_evidence_without_credentials():
    route = VideoRoute(
        provider="replicate",
        configured=True,
        score=84,
        reasons=("preferred_by_manifest", "observed_provider_performance:4:+4", "activation_certified"),
        model="bytedance/seedance-1-lite",
        base_score=72,
        performance_adjustment=4,
        activation_requested=True,
        worker_available=True,
        canary_passed=True,
        activation_certified=True,
    )

    snapshot = route_snapshot(route)

    assert snapshot["provider"] == "replicate"
    assert snapshot["base_score"] == 72
    assert snapshot["performance_adjustment"] == 4
    assert snapshot["final_score"] == 84
    assert snapshot["activation"] == {
        "requested": True,
        "worker_available": True,
        "canary_passed": True,
        "certified": True,
    }
    assert "api_key" not in snapshot
    assert "token" not in snapshot


def test_job_routing_decision_keeps_ranked_alternatives_and_style_evidence():
    plan = {
        "reason": "provider_selected",
        "selected_provider": "pollo",
        "selected_model": "pollo-v2-5",
        "routes": [
            {
                "provider": "pollo",
                "model": "pollo-v2-5",
                "configured": True,
                "base_score": 110,
                "performance_adjustment": 5,
                "final_score": 123,
                "activation": {
                    "requested": True,
                    "worker_available": True,
                    "canary_passed": True,
                    "certified": True,
                },
                "reasons": ["anchor_frame_fit", "observed_style_performance:5:+5"],
            },
            {
                "provider": "replicate",
                "model": "bytedance/seedance-1-lite",
                "configured": False,
                "base_score": 72,
                "performance_adjustment": 0,
                "final_score": -920,
                "activation": {
                    "requested": False,
                    "worker_available": True,
                    "canary_passed": False,
                    "certified": False,
                },
                "reasons": ["activation:not_requested", "activation:canary_not_passed"],
            },
        ],
    }
    packet = {
        "visual_intelligence": {
            "style_id": "cinematic-storyboard",
            "source": "d3vonn",
        }
    }

    snapshot = _routing_decision_snapshot(
        plan,
        packet,
        decided_at="2026-09-12T20:10:00+00:00",
    )

    assert snapshot["schema"] == "d3vonn.ai-films.routing-decision/v1"
    assert snapshot["selected_provider"] == "pollo"
    assert snapshot["selected_route"]["final_score"] == 123
    assert len(snapshot["ranked_routes"]) == 2
    assert snapshot["ranked_routes"][1]["provider"] == "replicate"
    assert snapshot["style_evidence"] == {
        "style_id": "cinematic-storyboard",
        "style_source": "d3vonn",
    }
    assert snapshot["dispatcher"] == "multimodel-v1"


def test_job_routing_decision_is_stable_when_no_style_is_applied():
    snapshot = _routing_decision_snapshot(
        {
            "reason": "provider_selected",
            "selected_provider": "pollo",
            "selected_model": "pollo-v2-5",
            "routes": [],
        },
        {},
        decided_at="2026-09-12T20:10:00+00:00",
    )

    assert snapshot["selected_route"] is None
    assert snapshot["ranked_routes"] == []
    assert snapshot["style_evidence"] == {"style_id": None, "style_source": None}
