from pathlib import Path
import hashlib
import subprocess
import pytest

from backend.music.stem_worker_gate9 import (
    SeparationBlocked, SeparationRequest, WorkerQualification,
    prepare_request, require_qualified, run_private_worker,
)


def test_unapproved_worker_fails_before_file_access(tmp_path: Path):
    with pytest.raises(SeparationBlocked, match="NOT_APPROVED"):
        require_qualified(WorkerQualification(), executable=tmp_path / "missing", checkpoint=tmp_path / "missing")


def test_job_must_be_inside_private_storage(tmp_path: Path):
    root = tmp_path / "private"
    root.mkdir()
    output = root / "out"
    output.mkdir()
    external = tmp_path / "external.wav"
    external.write_bytes(b"audio")
    with pytest.raises(SeparationBlocked, match="STORAGE_SCOPE"):
        prepare_request(SeparationRequest("job1", "owner1", external, output), private_root=root)


def test_rejects_empty_audio_source(tmp_path: Path):
    root = tmp_path / "private"
    root.mkdir()
    source = root / "audio.wav"
    source.touch()
    with pytest.raises(SeparationBlocked, match="SOURCE_SIZE"):
        prepare_request(SeparationRequest("job1", "owner1", source, root), private_root=root)


def test_approved_test_adapter_uses_argument_array_never_shell(tmp_path: Path):
    root = tmp_path / "private"
    root.mkdir()
    owner = root / "owner1"
    owner.mkdir()
    source = owner / "source.wav"
    source.write_bytes(b"test-payload")
    binary = root / "fake-worker"
    binary.write_bytes(b"fake-binary")
    checkpoint = root / "checkpoint"
    checkpoint.write_bytes(b"fake-checkpoint")
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    config = WorkerQualification(
        enabled=True, operator_approved=True, license_approved=True,
        gpu_qa_passed=True, weights_sha256=digest(checkpoint),
        expected_binary_sha256=digest(binary),
    )
    calls = []
    def fake_execute(cmd, **kwargs):
        calls.append((cmd, kwargs))
        return subprocess.CompletedProcess(cmd, 0, "", "")
    run_private_worker(
        SeparationRequest("job1", "owner1", source, owner),
        qualification=config, executable=binary, checkpoint=checkpoint,
        private_root=root, execute=fake_execute,
    )
    assert len(calls) == 1
    assert calls[0][0][0] == str(binary)
    assert calls[0][1]["timeout"] == 900
    assert "shell" not in calls[0][1]
    assert "PATH" in calls[0][1]["env"]
