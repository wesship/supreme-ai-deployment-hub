"""Bounded CPU worker facade; GPU is deliberately disabled until parity certification."""
from __future__ import annotations
from engine import TextEngine

MAX_DOCS = 32
MAX_CHARS = 1_000_000
MAX_QUERY = 256
MAX_TOTAL_CHARS = 2_000_000

class Worker:
    def __init__(self, backend: str = "cpu") -> None:
        if backend != "cpu":
            raise ValueError("GPU backend unavailable: hardware and parity gates pending")
        self.engine = TextEngine()
        self.total_chars = 0

    def ingest(self, document_id: str, text: str) -> dict:
        if not isinstance(document_id, str) or not 1 <= len(document_id) <= 128:
            raise ValueError("invalid document id")
        if not isinstance(text, str) or len(text) > MAX_CHARS:
            raise ValueError("document exceeds input limit")
        if self.total_chars + len(text) > MAX_TOTAL_CHARS:
            raise ValueError("total corpus memory budget exceeded")
        if len(self.engine.documents) >= MAX_DOCS:
            raise ValueError("document limit reached")
        self.engine.add(document_id, text)
        self.total_chars += len(text)
        return {"document_id": document_id, "characters": len(text)}

    def search(self, query: str, limit: int = 20) -> dict:
        if not isinstance(query, str) or not 1 <= len(query) <= MAX_QUERY:
            raise ValueError("invalid query")
        if not isinstance(limit, int) or not 1 <= limit <= 100:
            raise ValueError("invalid limit")
        return {"backend": "cpu", "hits": [vars(hit) for hit in self.engine.search(query, limit)]}
