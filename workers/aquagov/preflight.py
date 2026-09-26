"""Hardware/software readiness checks for a local AquaGov worker.

The module is intentionally dependency-light and reports findings without
installing packages or executing reconstruction workloads.
"""
from __future__ import annotations

import json
import os
import platform
import shutil
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Optional


@dataclass
class Check:
    name: str
    ok: bool
    detail: str
    required: bool = True


def _command_version(command: str, args: list[str]) -> Optional[str]:
    try:
        p = subprocess.run([command, *args], capture_output=True, text=True, timeout=10)
    except (FileNotFoundError, OSError, subprocess.TimeoutExpired):
        return None
    if p.returncode != 0:
        return None
    return (p.stdout or p.stderr).strip().splitlines()[0][:300] if (p.stdout or p.stderr).strip() else "available"


def run_preflight(workspace: str | Path = "./workspace") -> dict:
    ws = Path(workspace).expanduser()
    checks: list[Check] = []
    checks.append(Check("linux", platform.system() == "Linux", platform.platform()))

    nvidia = _command_version("nvidia-smi", ["--query-gpu=name,memory.total,driver_version", "--format=csv,noheader"])
    checks.append(Check("nvidia_gpu", nvidia is not None, nvidia or "nvidia-smi unavailable"))

    comfy_url = os.getenv("AQUAGOV_COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")
    try:
        import urllib.request
        with urllib.request.urlopen(comfy_url + "/system_stats", timeout=5) as response:
            checks.append(Check("comfyui", 200 <= response.status < 300, f"HTTP {response.status}"))
    except Exception as exc:
        checks.append(Check("comfyui", False, f"unreachable: {type(exc).__name__}"))

    for command, label in (("colmap", "colmap"), ("git", "git")):
        version = _command_version(command, ["--version"])
        checks.append(Check(label, version is not None, version or f"{command} unavailable"))

    ws.mkdir(parents=True, exist_ok=True)
    usage = shutil.disk_usage(ws)
    free_gb = usage.free / (1024**3)
    checks.append(Check("workspace_disk", free_gb >= 20, f"{free_gb:.1f} GiB free"))

    # Optional metadata checks are reported but do not block until pinned values exist.
    checks.append(Check("workflow_pin", bool(os.getenv("AQUAGOV_WORKFLOW_SHA")), os.getenv("AQUAGOV_WORKFLOW_SHA", "not configured"), required=False))
    checks.append(Check("matrix3d_pin", bool(os.getenv("AQUAGOV_MATRIX3D_COMMIT")), os.getenv("AQUAGOV_MATRIX3D_COMMIT", "not configured"), required=False))

    return {
        "ready": all(c.ok for c in checks if c.required),
        "checks": [asdict(c) for c in checks],
    }


def main() -> int:
    result = run_preflight(os.getenv("AQUAGOV_WORKSPACE", "./workspace"))
    print(json.dumps(result, indent=2))
    return 0 if result["ready"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
