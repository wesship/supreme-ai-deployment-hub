"""Safety-gated Crawlee web acquisition for the DKOS ingestion plane.

This connector is deliberately limited to authorized, allowlisted web sources.
It produces acquisition records; it does not grant the crawler access to cloud
accounts, credentials, or private networks. Downstream DKOS ingestion remains
responsible for content scanning, classification, parsing, indexing, and agent
access control.
"""

from __future__ import annotations

from dataclasses import dataclass
from uuid import uuid4

from crawlee.crawlers import ParselCrawler, ParselCrawlingContext

from backend.dkos_acquisition.policy import AcquisitionPolicy


@dataclass(frozen=True)
class AcquisitionRecord:
    acquisition_id: str
    url: str
    source_type: str = "web"
    trust_state: str = "untrusted"


def build_crawler(policy: AcquisitionPolicy) -> ParselCrawler:
    """Build a crawler that stays inside the current allowlisted host scope."""

    crawler = ParselCrawler(
        max_requests_per_crawl=policy.max_requests,
        max_crawl_depth=policy.max_depth,
        respect_robots_txt_file=True,
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

        # Crawlee's default link enqueue strategy is same-hostname. This keeps
        # the crawler inside the current source boundary; each processed request
        # is independently checked against the explicit allowlist above.
        await context.enqueue_links()

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
