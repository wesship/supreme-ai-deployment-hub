"""Clock abstraction for deterministic orchestration timestamps."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Protocol, runtime_checkable


@runtime_checkable
class Clock(Protocol):
    """Provides the current UTC time."""

    def now(self) -> datetime:
        """Return a timezone-aware UTC datetime."""
        ...


class SystemClock:
    """Production clock backed by the system UTC clock."""

    def now(self) -> datetime:
        return datetime.now(timezone.utc)
