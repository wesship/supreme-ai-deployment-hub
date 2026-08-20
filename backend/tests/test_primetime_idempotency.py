from backend.app.routers.primetime_governed_idempotency import request_hash


def test_request_hash_is_sha256():
    assert len(request_hash(b"primetime")) == 64
    assert request_hash(b"primetime") == request_hash(b"primetime")
    assert request_hash(b"primetime") != request_hash(b"different")
