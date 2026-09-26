from pathlib import Path

import pytest

from backend.ai_films.local_video_worker import LocalVideoJob, LocalVideoWorker


def test_command_maps_wan_runner_and_generation_options() -> None:
    worker = LocalVideoWorker({"D3VONN_WAN_VIDEO_RUNNER": "/opt/wan/run"})
    job = LocalVideoJob(
        provider="wan2.2",
        model="Wan2.2-TI2V-5B",
        prompt="A cinematic night city",
        output_path=Path("/tmp/shot.mp4"),
        seed=42,
    )
    assert worker.command(job) == [
        "/opt/wan/run", "--model", "Wan2.2-TI2V-5B", "--prompt", "A cinematic night city",
        "--output", "/tmp/shot.mp4", "--width", "1280", "--height", "720",
        "--fps", "24", "--duration", "5.0", "--seed", "42",
    ]


def test_command_rejects_unregistered_provider() -> None:
    worker = LocalVideoWorker({"D3VONN_WAN_VIDEO_RUNNER": "/opt/wan/run"})
    job = LocalVideoJob("hunyuan", "x", "y", Path("/tmp/x.mp4"))
    with pytest.raises(ValueError, match="unsupported local video provider"):
        worker.command(job)


def test_command_requires_runner() -> None:
    worker = LocalVideoWorker({})
    job = LocalVideoJob("ltx-2.5", "LTX-2.5", "x", Path("/tmp/x.mp4"))
    with pytest.raises(RuntimeError, match="local video runner is not configured"):
        worker.command(job)
