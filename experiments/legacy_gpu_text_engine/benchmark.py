"""Reproducible CPU baseline; results depend on host hardware."""
from __future__ import annotations
import argparse
import json
from statistics import median
from time import perf_counter
from engine import TextEngine


def run(words: int = 200000, repeats: int = 10) -> dict:
    if words < 1 or repeats < 1 or words > 2000000 or repeats > 1000:
        raise ValueError("invalid benchmark bounds")
    corpus = ("alpha beta gamma delta provenance vector search " * ((words + 7) // 8)).split()[:words]
    engine = TextEngine()
    engine.add("synthetic", " ".join(corpus))
    timings = []
    for _ in range(repeats):
        start = perf_counter()
        hits = engine.search("provenance", limit=100)
        timings.append((perf_counter() - start) * 1000)
        assert hits and all(engine.documents[h.document_id][h.start:h.end] == h.passage for h in hits)
    return {"backend": "cpu", "synthetic": True, "words": words, "repeats": repeats,
            "query": "provenance", "limit": 100, "hits": len(hits),
            "latency_ms_median": median(timings), "latency_ms_min": min(timings),
            "latency_ms_max": max(timings)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--words", type=int, default=200000)
    parser.add_argument("--repeats", type=int, default=10)
    args = parser.parse_args()
    print(json.dumps(run(args.words, args.repeats), indent=2))
