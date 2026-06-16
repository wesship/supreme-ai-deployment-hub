from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
from typing import Any
from uuid import uuid4

_RECORDS: dict[str, list[dict[str, Any]]] = {}


def command_hash(raw: str) -> str:
    return sha256(raw.encode("utf-8")).hexdigest()


def add_record(raw: str, level: int, reviewer_id: str, reviewer_role: str, decision: str, reason: str = "") -> dict[str, Any]:
    digest = command_hash(raw)
    record = {
        "id": str(uuid4()),
        "commandHash": digest,
        "level": level,
        "reviewerId": reviewer_id,
        "reviewerRole": reviewer_role,
        "decision": decision,
        "reason": reason,
        "createdAt": datetime.now(timezone.utc).isoformat(),
    }
    _RECORDS.setdefault(digest, []).append(record)
    return record


def list_records(raw: str) -> list[dict[str, Any]]:
    return list(_RECORDS.get(command_hash(raw), []))


def is_satisfied(raw: str, required_level: int) -> bool:
    if required_level < 2:
        return True
    return any(
        record["decision"] == "approved" and int(record["level"]) >= required_level
        for record in list_records(raw)
    )
