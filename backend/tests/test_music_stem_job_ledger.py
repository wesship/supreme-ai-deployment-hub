import pytest
from backend.music.stem_job_ledger import StemJobLedger, JobDenied

HASH = "a" * 64

@pytest.fixture
def ledger(tmp_path):
    store = StemJobLedger(tmp_path / "jobs.db")
    store.setup()
    return store

def test_disabled_submission_fails_closed(ledger):
    with pytest.raises(JobDenied, match="NOT_QUALIFIED"):
        ledger.submit(owner="alice", idem="once", source_sha=HASH, model="demucs")
    with ledger.connect() as db:
        assert db.execute("SELECT count(*) FROM stem_jobs").fetchone()[0] == 0

def test_idempotent_and_owner_scoped(ledger):
    a = ledger.submit(owner="alice", idem="once", source_sha=HASH, model="demucs", qualified=True)
    same = ledger.submit(owner="alice", idem="once", source_sha=HASH, model="demucs", qualified=True)
    assert a["id"] == same["id"]
    with pytest.raises(JobDenied, match="CONFLICT"):
        ledger.submit(owner="alice", idem="once", source_sha=HASH, model="audio-separator", qualified=True)
    with pytest.raises(JobDenied, match="NOT_FOUND"):
        ledger.get(owner="bob", job_id=a["id"])
    other = ledger.submit(owner="bob", idem="once", source_sha=HASH, model="demucs", qualified=True)
    assert other["id"] != a["id"]

def test_cancellation_is_terminal(ledger):
    job = ledger.submit(owner="alice", idem="once", source_sha=HASH, model="demucs", qualified=True)
    cancelled = ledger.transition(owner="alice", job_id=job["id"], new_status="cancelled", progress=0)
    assert cancelled["status"] == "cancelled"
    with pytest.raises(JobDenied, match="ILLEGAL"):
        ledger.transition(owner="alice", job_id=job["id"], new_status="running", progress=5, worker_authorized=True)

def test_untrusted_progress_and_worker_transitions_rejected(ledger):
    job = ledger.submit(owner="alice", idem="once", source_sha=HASH, model="demucs", qualified=True)
    with pytest.raises(JobDenied, match="WORKER_AUTHORIZATION"):
        ledger.transition(owner="alice", job_id=job["id"], new_status="running", progress=1)
    with pytest.raises(JobDenied, match="INVALID_JOB_TRANSITION"):
        ledger.transition(owner="alice", job_id=job["id"], new_status="running", progress=101, worker_authorized=True)
    running = ledger.transition(owner="alice", job_id=job["id"], new_status="running", progress=10, worker_authorized=True)
    assert running["progress"] == 10

def test_invalid_identity_rejected(ledger):
    with pytest.raises(JobDenied, match="INVALID_JOB_IDENTITY"):
        ledger.submit(owner="../bob", idem="once", source_sha=HASH, model="demucs", qualified=True)
