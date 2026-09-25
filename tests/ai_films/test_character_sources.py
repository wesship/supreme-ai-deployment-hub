"""The source boundary must reject partial, cross-project, or altered releases."""
import asyncio
import unittest

from backend.ai_films.character_sources import (
    SourceUnavailable, load_approved_sources, search_sources, source_hash,
)

PROJECT = "fa6b7a0a-c3a8-4df5-bae3-079d03e64b0e"
SOURCE = "509551d7-d09b-4549-ac78-b0c0eb856883"
OTHER = "ffb91aa6-e2d2-452f-aa16-a12aac40b3f7"
CONTENT = "A lens changes the framing of a scene. The camera records light from the subject."
RELEASE = {"character_id": OTHER, "profile_hash": "a" * 64,
           "profile": {"sources": [SOURCE]}}


class Store:
    def __init__(self, rows):
        self.rows = rows
        self.params = None

    async def _request(self, method, table, *, params):
        self.params = params
        return self.rows


def row(**overrides):
    return {"id": SOURCE, "title": "Camera manual", "content": CONTENT,
            "content_hash": source_hash(CONTENT), "approved_by": OTHER,
            "rights_basis": "Owned training text", **overrides}


class CharacterSourceTests(unittest.TestCase):
    def test_scoped_approved_snapshot_returns_cited_original_excerpt(self):
        store = Store([row()])
        sources = asyncio.run(load_approved_sources(store, PROJECT, RELEASE))
        self.assertEqual(store.params["project_id"], f"eq.{PROJECT}")
        self.assertEqual(store.params["status"], "eq.approved")
        matches = search_sources(sources, "How does a lens change framing?")
        self.assertEqual(matches[0]["source_id"], SOURCE)
        self.assertEqual(matches[0]["source_hash"], source_hash(CONTENT))
        self.assertIn("lens changes the framing", matches[0]["excerpt"])

    def test_missing_revoked_or_tampered_content_fails_closed(self):
        for rows in ([], [row(content="Altered source")], [row(approved_by=None)]):
            with self.subTest(rows=rows), self.assertRaises(SourceUnavailable):
                asyncio.run(load_approved_sources(Store(rows), PROJECT, RELEASE))

    def test_legacy_or_duplicate_source_ids_cannot_be_grounded(self):
        for ids in (["unregistered:manual"], [SOURCE, SOURCE], []):
            with self.subTest(ids=ids), self.assertRaises(SourceUnavailable):
                asyncio.run(load_approved_sources(Store([row()]), PROJECT,
                                                  {**RELEASE, "profile": {"sources": ids}}))

    def test_no_matching_excerpt_is_not_an_answer(self):
        self.assertEqual(search_sources([row()], "What is the station schedule?"), [])


if __name__ == "__main__":
    unittest.main()
