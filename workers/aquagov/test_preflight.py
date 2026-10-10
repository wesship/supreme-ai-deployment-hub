from pathlib import Path

import preflight


def test_preflight_blocks_missing_required_gpu(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(preflight, "_command_version", lambda *args: None)
    monkeypatch.setenv("AQUAGOV_COMFYUI_URL", "http://127.0.0.1:1")
    result = preflight.run_preflight(tmp_path)
    assert result["ready"] is False
    names = {item["name"] for item in result["checks"]}
    assert {"linux", "nvidia_gpu", "comfyui", "colmap", "workspace_disk"} <= names


def test_preflight_optional_pins_do_not_block(monkeypatch, tmp_path: Path):
    monkeypatch.setattr(preflight, "_command_version", lambda *args: "ok")
    monkeypatch.setenv("AQUAGOV_COMFYUI_URL", "http://127.0.0.1:1")
    result = preflight.run_preflight(tmp_path)
    workflow = next(item for item in result["checks"] if item["name"] == "workflow_pin")
    assert workflow["required"] is False
