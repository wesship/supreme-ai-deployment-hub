from admission import admit_worker, evaluate_preflight


def test_admission_passes_only_when_ready():
    result = {"ready": True, "checks": [{"name": "gpu", "ok": True, "required": True}]}
    decision = evaluate_preflight(result)
    assert decision.admitted is True
    assert decision.reason == "preflight_passed"


def test_required_failure_blocks_admission():
    result = {"ready": False, "checks": [{"name": "gpu", "ok": False, "required": True}]}
    decision = evaluate_preflight(result)
    assert decision.admitted is False
    assert "gpu" in decision.reason


def test_optional_failure_does_not_block_ready_worker():
    result = {"ready": True, "checks": [{"name": "workflow_pin", "ok": False, "required": False}]}
    assert evaluate_preflight(result).admitted is True


def test_preflight_exception_blocks():
    decision = admit_worker(lambda: (_ for _ in ()).throw(RuntimeError("boom")))
    assert decision.admitted is False
    assert decision.reason.startswith("preflight_error:")
