import asyncio

import httpx

from backend.ai_films.bootstrap import (
    PROJECT_ID,
    SupabaseFilmBootstrapClient,
    should_schedule_sovereign_signal_bootstrap,
)


def test_bootstrap_schedules_only_on_production_railway():
    assert should_schedule_sovereign_signal_bootstrap(
        {"RAILWAY_ENVIRONMENT_NAME": "production"}
    )
    assert not should_schedule_sovereign_signal_bootstrap(
        {"RAILWAY_ENVIRONMENT_NAME": "staging"}
    )
    assert not should_schedule_sovereign_signal_bootstrap(
        {"ENVIRONMENT": "production"}
    )
    assert not should_schedule_sovereign_signal_bootstrap(
        {
            "RAILWAY_ENVIRONMENT_NAME": "production",
            "AI_FILM_DISABLE_SOVEREIGN_SIGNAL_BOOTSTRAP": "true",
        }
    )


def test_project_claim_is_compare_and_set_on_ingestion_state():
    observed = {"patch_query": ""}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": PROJECT_ID,
                        "metadata": {"movieflow_ingestion_state": "ready_to_execute"},
                    }
                ],
            )
        if request.method == "PATCH":
            observed["patch_query"] = request.url.query.decode()
            payload = __import__("json").loads(request.content.decode())
            assert payload["metadata"]["movieflow_ingestion_state"] == "in_progress"
            return httpx.Response(200, json=[{"id": PROJECT_ID, "metadata": payload["metadata"]}])
        raise AssertionError(f"unexpected request: {request.method} {request.url}")

    client = SupabaseFilmBootstrapClient(
        environ={
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service-role-test-key",
        },
        transport=httpx.MockTransport(handler),
    )

    assert asyncio.run(client.claim_project()) is True
    assert "metadata-%3E%3Emovieflow_ingestion_state=eq.ready_to_execute" in observed["patch_query"]


def test_completed_project_is_not_claimed():
    calls = {"patch": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        if request.method == "GET":
            return httpx.Response(
                200,
                json=[
                    {
                        "id": PROJECT_ID,
                        "metadata": {"movieflow_ingestion_state": "complete"},
                    }
                ],
            )
        calls["patch"] += 1
        return httpx.Response(500)

    client = SupabaseFilmBootstrapClient(
        environ={
            "SUPABASE_URL": "https://example.supabase.co",
            "SUPABASE_SERVICE_ROLE_KEY": "service-role-test-key",
        },
        transport=httpx.MockTransport(handler),
    )

    assert asyncio.run(client.claim_project()) is False
    assert calls["patch"] == 0
