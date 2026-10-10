from backend.app.services.token_governor import (
    POLICIES,
    estimate_message_tokens,
    estimate_tokens,
    govern_chat_request,
)


def test_estimate_tokens_rounds_up():
    assert estimate_tokens("") == 0
    assert estimate_tokens("a") == 1
    assert estimate_tokens("abcd") == 1
    assert estimate_tokens("abcde") == 2


def test_output_budget_is_server_capped():
    messages = [{"role": "user", "content": "hello"}]
    governed, decision = govern_chat_request(messages, 99_999)

    assert governed == messages
    assert decision.allowed_output_tokens == POLICIES["interactive"].max_output_tokens
    assert decision.requested_output_tokens == 99_999
    assert decision.trimmed is False


def test_utility_policy_has_small_output_budget():
    messages = [{"role": "user", "content": "classify this"}]
    _, decision = govern_chat_request(messages, 4_000, policy_name="utility")

    assert decision.allowed_output_tokens == 1_536
    assert decision.policy == "utility"


def test_trimming_preserves_system_and_newest_context():
    system = {"role": "system", "content": "Follow the D3VONN operating rules."}
    # At four characters per estimated token, this message alone exceeds the
    # utility policy's 8k prompt-token ceiling and must be trimmed.
    old = {"role": "user", "content": "x" * 40_000}
    newest = {"role": "user", "content": "What should I do next?"}
    messages = [system, old, newest]

    assert estimate_message_tokens(messages) > POLICIES["utility"].max_prompt_tokens

    governed, decision = govern_chat_request(messages, 2_048, policy_name="utility")

    assert system in governed
    assert newest in governed
    assert old not in governed
    assert decision.trimmed is True
    assert decision.messages_before == 3
    assert decision.messages_after == 2
    assert decision.estimated_prompt_tokens_after < decision.estimated_prompt_tokens_before


def test_unknown_policy_falls_back_to_interactive():
    messages = [{"role": "user", "content": "hello"}]
    _, decision = govern_chat_request(messages, 2_048, policy_name="does-not-exist")

    assert decision.policy == "interactive"


def test_message_estimate_includes_framing_overhead():
    messages = [{"role": "user", "content": "abcd"}]
    assert estimate_message_tokens(messages) == 7
