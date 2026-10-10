from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess

import pytest

from backend.ai_films.canary import (
    PAID_PROVIDER_ENV_VARS,
    _provider_guard,
    _restore_provider_env,
    make_synthetic_clip,
    run_local_mastering_canary,
)


def test_provider_guard_removes_paid_provider_credentials(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in PAID_PROVIDER_ENV_VARS:
        monkeypatch.setenv(key, f"secret-{key.lower()}")

    previous = _provider_guard()
    try:
        assert os.environ.get("AI_FILMS_CANARY_MODE") == "1"
        for key in PAID_PROVIDER_ENV_VARS:
            assert key not in os.environ
            assert previous[key] == f"secret-{key.lower()}"
    finally:
        _restore_provider_env(previous)

    assert "AI_FILMS_CANARY_MODE" not in os.environ
    for key in PAID_PROVIDER_ENV_VARS:
        assert os.environ[key] == f"secret-{key.lower()}"


def test_make_synthetic_clip(tmp_path: Path) -> None:
    target = tmp_path / "canary.mp4"
    result = make_synthetic_clip(target, duration_seconds=0.125)
    assert result == target
    assert target.exists()
    assert target.stat().st_size > 0

    probe = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=color_space,color_transfer,color_primaries",
            "-of",
            "json",
            str(target),
        ],
        check=True,
        capture_output=True,
        text=True,
        timeout=15,
    )
    stream = json.loads(probe.stdout)["streams"][0]
    assert stream["color_space"] == "bt709"
    assert stream["color_transfer"] == "bt709"
    assert stream["color_primaries"] == "bt709"


@pytest.mark.asyncio
async def test_run_local_mastering_canary() -> None:
    result = await run_local_mastering_canary()
    assert result.frame_count > 0
    assert result.conform_path.endswith("editorial_conform.json")
    assert result.otio_path.endswith("editorial_conform.otio")
