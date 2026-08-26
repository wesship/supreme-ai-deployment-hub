from backend.ai_films.provider_benchmark import ProviderBenchmark, rank_providers


def test_benchmark_prefers_quality_and_reliability():
    results = rank_providers([
        ProviderBenchmark("slow", visual_quality=8, reliability=5, artifact_rate=2),
        ProviderBenchmark("strong", visual_quality=9, reliability=9, artifact_rate=0),
    ])
    assert results[0].provider == "strong"


def test_benchmark_does_not_enable_provider():
    result = ProviderBenchmark("unverified", visual_quality=10, reliability=10)
    assert result.provider == "unverified"
    assert result.weighted_score() > 0
