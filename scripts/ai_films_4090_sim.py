#!/usr/bin/env python3
"""Deterministic RTX 4090 capacity simulation for D3VONN AI Films.

This is a planning/proof gate, not a physical CUDA benchmark. It estimates whether
configured workloads fit inside a 24 GiB RTX 4090 VRAM envelope with a safety
reserve and reports PASS/WARN/FAIL.
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

GPU_VRAM_GIB = 24.0
DEFAULT_RESERVE_GIB = 2.5


@dataclass
class Result:
    name: str
    estimated_peak_gib: float
    usable_vram_gib: float
    headroom_gib: float
    status: str
    notes: str


def estimate_peak(workload: dict[str, Any]) -> float:
    model = float(workload.get("model_gib", 0))
    runtime = float(workload.get("runtime_gib", 0))
    latent = float(workload.get("latent_gib", 0))
    frame_count = max(1, int(workload.get("frames", 1)))
    width = max(1, int(workload.get("width", 1024)))
    height = max(1, int(workload.get("height", 576)))
    batch = max(1, int(workload.get("batch", 1)))
    temporal_factor = max(1.0, frame_count / 81.0)
    pixel_factor = (width * height) / (1024 * 576)
    activation = float(workload.get("activation_gib", 2.0)) * pixel_factor * temporal_factor * batch
    overhead = float(workload.get("overhead_gib", 1.0))
    return round(model + runtime + latent + activation + overhead, 2)


def classify(peak: float, usable: float) -> tuple[str, str]:
    headroom = usable - peak
    if headroom < 0:
        return "FAIL", "Estimated OOM: reduce resolution/frames/batch or enable stronger quantization/offload."
    if headroom < 2.0:
        return "WARN", "Fits narrowly; physical 4090 validation required before production use."
    return "PASS", "Fits simulated 24 GiB envelope with at least 2 GiB operating headroom."


def run(config: dict[str, Any]) -> dict[str, Any]:
    reserve = float(config.get("reserve_gib", DEFAULT_RESERVE_GIB))
    usable = GPU_VRAM_GIB - reserve
    results: list[dict[str, Any]] = []
    overall = "PASS"
    for workload in config.get("workloads", []):
        peak = estimate_peak(workload)
        status, notes = classify(peak, usable)
        if status == "FAIL":
            overall = "FAIL"
        elif status == "WARN" and overall == "PASS":
            overall = "WARN"
        result = Result(
            name=str(workload.get("name", "unnamed")),
            estimated_peak_gib=peak,
            usable_vram_gib=round(usable, 2),
            headroom_gib=round(usable - peak, 2),
            status=status,
            notes=notes,
        )
        results.append(result.__dict__)
    return {
        "gate": "D3VONN AI Films RTX 4090 Simulation",
        "gpu": "NVIDIA GeForce RTX 4090",
        "physical_vram_gib": GPU_VRAM_GIB,
        "reserve_gib": reserve,
        "overall": overall,
        "physical_certification_required": True,
        "results": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config/ai-films-4090-sim.json")
    parser.add_argument("--output", default="artifacts/ai-films-4090-sim.json")
    args = parser.parse_args()

    config = json.loads(Path(args.config).read_text())
    report = run(config)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))
    return 1 if report["overall"] == "FAIL" else 0


if __name__ == "__main__":
    raise SystemExit(main())
