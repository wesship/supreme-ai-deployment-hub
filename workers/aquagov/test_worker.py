from pathlib import Path

from worker import STAGES, Job, run_dry_job


def test_dry_run_reaches_review_and_emits_manifest(tmp_path: Path):
    job = Job("job-1", "SHO-001", "asset-1", "local://capture.jpg", ["gaussian-splat"])
    result = run_dry_job(job, tmp_path)
    assert result.status == "review"
    assert result.stage == "qa"
    assert result.progress == 1.0
    assert Path(result.outputs["manifest"]).exists()
    assert len(STAGES) == 8


def test_dry_run_never_executes_commands(tmp_path: Path):
    job = Job("job-2", "SHO-002", "asset-2", "local://capture.jpg", ["colmap"])
    result = run_dry_job(job, tmp_path)
    manifest = Path(result.outputs["manifest"]).read_text(encoding="utf-8")
    assert '"mode":"dry-run"' in manifest
    assert '"evidence_state":"reconstructed"' in manifest
