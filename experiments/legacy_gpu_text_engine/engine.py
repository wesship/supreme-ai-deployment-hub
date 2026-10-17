"""Deterministic CPU reference engine; no GPU or network dependencies."""
from __future__ import annotations
from collections import Counter, defaultdict
from dataclasses import dataclass
import re
from typing import Iterable

TOKEN = re.compile(r"\b[\w']+\b", re.UNICODE)
URL = re.compile(r"https?://[^\s<>]+")
YEAR = re.compile(r"\b(?:1[5-9]\d{2}|20\d{2}|21\d{2})\b")


@dataclass(frozen=True)
class Hit:
    document_id: str
    start: int
    end: int
    passage: str


class TextEngine:
    def __init__(self) -> None:
        self.documents: dict[str, str] = {}

    def add(self, document_id: str, text: str) -> None:
        if not document_id or document_id in self.documents:
            raise ValueError("document_id must be unique and nonempty")
        self.documents[document_id] = text

    def search(self, query: str, limit: int = 100) -> list[Hit]:
        if not query.strip() or limit < 1:
            return []
        pattern = re.compile(re.escape(query), re.IGNORECASE)
        return [Hit(doc_id, m.start(), m.end(), text[m.start():m.end()])
                for doc_id, text in self.documents.items()
                for m in pattern.finditer(text)][:limit]

    def vocabulary(self) -> Counter[str]:
        return Counter(m.group().casefold() for text in self.documents.values()
                       for m in TOKEN.finditer(text))

    def transitions(self) -> dict[str, Counter[str]]:
        edges: dict[str, Counter[str]] = defaultdict(Counter)
        for text in self.documents.values():
            words = [m.group().casefold() for m in TOKEN.finditer(text)]
            for a, b in zip(words, words[1:]):
                edges[a][b] += 1
        return dict(edges)

    def extract(self) -> dict[str, list[str]]:
        texts = list(self.documents.values())
        return {"urls": [x.group() for t in texts for x in URL.finditer(t)],
                "years": [x.group() for t in texts for x in YEAR.finditer(t)]}
