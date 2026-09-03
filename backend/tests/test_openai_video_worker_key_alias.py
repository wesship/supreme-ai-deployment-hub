"""OpenAI video worker credential alias tests."""

from backend.ai_films.openai_video_worker import OpenAIVideoClient


def test_railway_open_ai_key_alias_is_used_for_video_worker():
    client = OpenAIVideoClient({"OpenAiKey": "railway-project-key"})

    assert client.api_key == "railway-project-key"
    assert client.headers == {"Authorization": "Bearer railway-project-key"}


def test_standard_openai_api_key_remains_supported():
    client = OpenAIVideoClient({"OPENAI_API_KEY": "standard-key"})

    assert client.api_key == "standard-key"


def test_railway_alias_wins_when_both_are_present():
    client = OpenAIVideoClient({
        "OpenAiKey": "preferred-key",
        "OPENAI_API_KEY": "legacy-key",
    })

    assert client.api_key == "preferred-key"
