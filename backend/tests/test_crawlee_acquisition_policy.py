import pytest

from backend.dkos_acquisition.policy import AcquisitionPolicy


def test_allowlisted_https_url_is_accepted() -> None:
    policy = AcquisitionPolicy(allowed_domains=frozenset({"example.com"}))
    policy.validate_url("https://example.com/path")


def test_non_allowlisted_domain_is_rejected() -> None:
    policy = AcquisitionPolicy(allowed_domains=frozenset({"example.com"}))
    with pytest.raises(PermissionError):
        policy.validate_url("https://evil.example/path")


def test_http_is_rejected_by_default() -> None:
    policy = AcquisitionPolicy(allowed_domains=frozenset({"example.com"}))
    with pytest.raises(ValueError):
        policy.validate_url("http://example.com/path")


def test_non_http_scheme_is_rejected() -> None:
    policy = AcquisitionPolicy(allowed_domains=frozenset({"example.com"}))
    with pytest.raises(ValueError):
        policy.validate_url("file:///etc/passwd")
