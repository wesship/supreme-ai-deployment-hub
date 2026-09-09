from backend.occ_operator.market_intelligence_router import summarize_market_handoffs


def test_occ_market_intelligence_summary_is_read_only_and_preserves_provenance():
    rows = [
        {
            "id": "event-1",
            "created_at": "2026-09-09T16:00:00Z",
            "task_id": "task-1",
            "correlation_id": "corr-1",
            "agent_name": "ION",
            "data": {
                "providers": ["messari"],
                "signal_count": 3,
                "confidence": {"min": 0.61, "max": 0.91, "avg": 0.78},
                "provider_errors": {},
                "analysis_only": True,
                "execution_allowed": False,
            },
        },
        {
            "id": "event-2",
            "created_at": "2026-09-09T16:01:00Z",
            "task_id": "task-2",
            "correlation_id": "corr-2",
            "agent_name": "ION",
            "data": {
                "providers": ["messari", "finviz"],
                "signal_count": 2,
                "confidence": {"min": 0.55, "max": 0.85, "avg": 0.70},
                "provider_errors": {"finviz": "upstream unavailable"},
                "analysis_only": True,
                "execution_allowed": False,
            },
        },
    ]

    result = summarize_market_handoffs(rows)

    assert result["event_type"] == "hermes.market_analysis.handoff"
    assert result["summary"]["handoffs"] == 2
    assert result["summary"]["providers"] == ["finviz", "messari"]
    assert result["summary"]["provider_error_count"] == 1
    assert result["summary"]["average_confidence"] == 0.74
    assert result["summary"]["analysis_only"] is True
    assert result["summary"]["execution_allowed"] is False
    assert result["events"][0]["task_id"] == "task-1"
    assert result["events"][0]["confidence"]["avg"] == 0.78


def test_occ_market_intelligence_flags_any_execution_permission():
    result = summarize_market_handoffs(
        [
            {
                "data": {
                    "providers": ["messari"],
                    "signal_count": 1,
                    "confidence": {"avg": 0.8},
                    "analysis_only": False,
                    "execution_allowed": True,
                }
            }
        ]
    )

    assert result["summary"]["analysis_only"] is False
    assert result["summary"]["execution_allowed"] is True
