from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class AcquisitionPolicy:
    """Controls the network trust boundary before web content enters DKOS."""

    allowed_domains: frozenset[str]
    max_requests: int = 100
    max_depth: int = 3
    require_https: bool = True

    def validate_url(self, url: str) -> None:
        parsed = urlparse(url)
        if parsed.scheme not in {"https", "http"}:
            raise ValueError("Only HTTP(S) sources are supported")
        if self.require_https and parsed.scheme != "https":
            raise ValueError("HTTPS is required by the acquisition policy")
        host = (parsed.hostname or "").lower().rstrip(".")
        if not host or host not in self.allowed_domains:
            raise PermissionError(f"Domain is not allowlisted: {host or '<missing>'}")
