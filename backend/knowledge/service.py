from __future__ import annotations

import logging
import os
import time

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO").upper())
logger = logging.getLogger(__name__)


def main() -> None:
    interval = int(os.getenv("KNOWLEDGE_SERVICE_INTERVAL", "300"))
    logger.info("knowledge service started")
    while True:
        logger.info("knowledge service heartbeat")
        time.sleep(interval)


if __name__ == "__main__":
    main()
