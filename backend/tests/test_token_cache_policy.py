from backend.app.services.token_cache_policy import cache_key, cache_policy, is_cacheable


def test_cache_key_is_stable_and_does_not_embed_payload():
    payload = {"query": "secret data", "top_k": 5}
    first = cache_key("rag", payload)
    second = cache_key("rag", {"top_k": 5, "query": "secret data"})
    assert first == second
    assert "secret data" not in first


def test_rag_and_utility_are_cacheable_reads():
    assert is_cacheable(policy_name="rag") is True
    assert is_cacheable(policy_name="utility") is True


def test_interactive_streams_and_mutations_fail_closed():
    assert is_cacheable(policy_name="interactive") is False
    assert is_cacheable(policy_name="rag", streaming=True) is False
    assert is_cacheable(policy_name="rag", mutating=True) is False
    assert is_cacheable(policy_name="rag", sensitive=True) is False


def test_unknown_policy_falls_back_to_disabled_interactive():
    assert cache_policy("unknown").enabled is False
    assert is_cacheable(policy_name="unknown") is False
