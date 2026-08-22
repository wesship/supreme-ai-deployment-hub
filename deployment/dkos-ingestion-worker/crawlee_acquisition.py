"""Safety-gated Crawlee web acquisition for the DKOS ingestion plane.

This connector is deliberately limited to authorized, allowlisted web sources.
It produces acquisition records; it does not grant the crawler access to cloud
accounts, credentials, or private networks. Downstream DKOS ingestion remains
responsible for content scanning, classification, parsing, indexing, and agent
access control.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse
from uuid import uuid4

from crawlee.crawlers import ParselCrawler, ParselCrawlingContext


@dataclass(frozen=True)
class AcquisitionPolicy:
    """Controls the trust boundary before a page enters DKOS."""

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


@dataclass(frozen=True)
class AcquisitionRecord:
    acquisition_id: str
    url: str
    source_type: str = "web"
    trust_state: str = "untrusted"


def build_crawler(policy: AcquisitionPolicy) -> ParselCrawler:
    """Build a crawler that only starts from and follows allowlisted domains."""

    crawler = ParselCrawler(
        max_requests_per_crawl=policy.max_requests,
        max_crawl_depth=policy.max_depth,
    )

    @crawler.router.default_handler
    async def handle_page(context: ParselCrawlingContext) -> None:
        policy.validate_url(context.request.url)

        title = context.selector.xpath("string(//title)").get() or None
        record = AcquisitionRecord(
            acquisition_id=str(uuid4()),
            url=context.request.url,
        )

        # Content remains explicitly untrusted. The DKOS security pipeline must
        # scan/classify it before parsing, indexing, or agent access.
        await context.push_data(
            {
                "acquisition_id": record.acquisition_id,
                "url": record.url,
                "title": title,
                "source_type": record.source_type,
                "trust_state": record.trust_state,
            }
        )

        # Crawlee's enqueue_links is followed by a policy check at each request;
        # therefore a discovered external link cannot silently cross the trust
        # boundary.
        links = context.selector.xpath("//a/@href").getall()
        for link in links:
            try:
                absolute = context.request.construct_absolute_url(link)
                policy.validate_url(absolute)
                await context.add_requests([absolute])
            except (ValueError, PermissionError):
                continue

    return crawler


async def run_acquisition(start_urls: list[str], policy: AcquisitionPolicy) -> None:
    """Run an allowlisted acquisition job.

    This function intentionally has no credential handling and no arbitrary URL
    execution. Callers should create an acquisition run and authorization record
    in DKOS before invoking it.
    """

    for url in start_urls:
        policy.validate_url(url)

    crawler = build_crawler(policy)
    await crawler.run(start_urls)
