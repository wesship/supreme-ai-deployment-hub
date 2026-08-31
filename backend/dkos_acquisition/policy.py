from __future__ import annotations

from dataclasses import dataclass
from ipaddress import ip_address
from urllib.parse import urlparse


@dataclass(frozen=True)
class AcquisitionPolicy:
    """Controls the network trust boundary before web content enters DKOS."""

    allowed_domains: frozenset[str]
    max_requests: int = 100
    max_depth: int = 3
    require_https: bool = True

    def __post_init__(self) -> None:
        if not self.allowed_domains:
            raise ValueError("At least one acquisition domain must be allowlisted")
        if not 1 <= self.max_requests <= 1000:
            raise ValueError("max_requests must be between 1 and 1000")
        if not 0 <= self.max_depth <= 10:
            raise ValueError("max_depth must be between 0 and 10")
        for domain in self.allowed_domains:
            normalized = domain.lower().rstrip(".")
            if domain != normalized or not normalized:
                raise ValueError("Allowlisted domains must be normalized hostnames")
            self._reject_private_host(normalized)

    @staticmethod
    def _reject_private_host(host: str) -> None:
        if host == "localhost" or host.endswith(".localhost"):
            raise PermissionError("Localhost is outside the acquisition boundary")
        try:
            address = ip_address(host)
        except ValueError:
            return
        if not address.is_global:
            raise PermissionError("Private or reserved IP addresses are not allowed")

    def validate_url(self, url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme not in {"https", "http"}:
            raise ValueError("Only HTTP(S) sources are supported")
        if self.require_https and parsed.scheme != "https":
            raise ValueError("HTTPS is required by the acquisition policy")
        if parsed.username is not None or parsed.password is not None:
            raise ValueError("Credentials are not allowed in acquisition URLs")
        host = (parsed.hostname or "").lower().rstrip(".")
        self._reject_private_host(host)
        if not host or host not in self.allowed_domains:
            raise PermissionError(f"Domain is not allowlisted: {host or '<missing>'}")
