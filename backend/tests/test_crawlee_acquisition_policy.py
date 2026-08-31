import pytest

from backend.dkos_acquisition.policy import AcquisitionPolicy


def test_allowlisted_https_url_is_accepted() -> None:
    policy = AcquisitionPolicy(allowed_domains=frozenset({"example.com"}))
    policy.validate_url("https://example.com/path")


@pytest.mark.parametrize(
    "url",
    [
        "https://evil.example/path",
        "https://127.0.0.1/private",
        "https://10.0.0.1/private",
        "https://localhost/private",
    ],
)
def test_non_allowlisted_or_private_destination_is_rejected(url: str) -> None:
    policy = AcquisitionPolicy(allowed_domains=frozenset({"example.com"}))
    with pytest.raises(PermissionError):
        policy.validate_url(url)


def test_http_is_rejected_by_default() -> None:
    policy = AcquisitionPolicy(allowed_domains=frozenset({"example.com"}))
    with pytest.raises(ValueError):
        policy.validate_url("http://example.com/path")


def test_non_http_scheme_is_rejected() -> None:
    policy = AcquisitionPolicy(allowed_domains=frozenset({"example.com"}))
    with pytest.raises(ValueError):
        policy.validate_url("file:///etc/passwd")


def test_url_credentials_are_rejected() -> None:
    policy = AcquisitionPolicy(allowed_domains=frozenset({"example.com"}))
    with pytest.raises(ValueError):
        policy.validate_url("https://user:password@example.com/path")


@pytest.mark.parametrize(
    "kwargs",
    [
        {"max_requests": 0},
        {"max_requests": 1001},
        {"max_depth": -1},
        {"max_depth": 11},
    ],
)
def test_resource_limits_are_bounded(kwargs: dict[str, int]) -> None:
    with pytest.raises(ValueError):
        AcquisitionPolicy(allowed_domains=frozenset({"example.com"}), **kwargs)
