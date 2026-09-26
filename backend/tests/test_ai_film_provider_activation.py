from backend.ai_films.provider_activation import (
    activation_status,
    certified_executable_video_providers,
    known_video_workers,
)


def test_pollo_is_certified_baseline_when_requested():
    env = {"AI_FILM_EXECUTABLE_VIDEO_PROVIDERS": "pollo"}
    status = activation_status("pollo", env)
    assert status.requested is True
    assert status.worker_available is True
    assert status.canary_passed is True
    assert status.executable is True
    assert certified_executable_video_providers(env) == {"pollo"}


def test_unimplemented_provider_cannot_be_enabled_by_env_alone():
    env = {
        "AI_FILM_EXECUTABLE_VIDEO_PROVIDERS": "xai",
        "AI_FILM_PROVIDER_CANARY_XAI": "pass",
    }
    assert activation_status("xai", env).worker_available is False
    assert certified_executable_video_providers(env) == set()


def test_replicate_worker_exists_but_requires_explicit_canary():
    env = {"AI_FILM_EXECUTABLE_VIDEO_PROVIDERS": "replicate"}
    blocked = activation_status("replicate", env)
    assert blocked.worker_available is True
    assert blocked.canary_passed is False
    assert blocked.executable is False

    env["AI_FILM_PROVIDER_CANARY_REPLICATE"] = "pass"
    allowed = activation_status("replicate", env)
    assert allowed.canary_passed is True
    assert allowed.executable is True
    assert certified_executable_video_providers(env) == {"replicate"}


def test_openai_worker_requires_explicit_canary_before_reactivation():
    env = {"AI_FILM_EXECUTABLE_VIDEO_PROVIDERS": "openai"}
    blocked = activation_status("openai", env)
    assert blocked.worker_available is True
    assert blocked.canary_passed is False
    assert blocked.executable is False

    env["AI_FILM_PROVIDER_CANARY_OPENAI"] = "passed"
    allowed = activation_status("openai", env)
    assert allowed.canary_passed is True
    assert allowed.executable is True


def test_aliases_do_not_bypass_activation_contract():
    env = {
        "AI_FILM_EXECUTABLE_VIDEO_PROVIDERS": "grok,sora",
        "AI_FILM_PROVIDER_CANARY_OPENAI": "pass",
    }
    assert certified_executable_video_providers(env) == {"openai"}


def test_worker_registry_is_explicit():
    workers = known_video_workers()
    assert workers["pollo"].endswith("pollo_video_worker")
    assert workers["openai"].endswith("openai_video_worker")
    assert workers["replicate"].endswith("replicate_video_worker")
    assert "xai" not in workers
