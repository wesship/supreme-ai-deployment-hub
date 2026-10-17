import unittest
from engine import TextEngine


class TextEngineTests(unittest.TestCase):
    def test_source_offsets_and_casefold(self):
        e = TextEngine()
        e.add("book-a", "Alpha beta ALPHA.")
        hits = e.search("alpha")
        self.assertEqual([(h.document_id, h.start, h.end) for h in hits],
                         [("book-a", 0, 5), ("book-a", 11, 16)])
        self.assertEqual([e.documents[h.document_id][h.start:h.end] for h in hits],
                         [h.passage for h in hits])

    def test_transitions_no_cross_document_leak(self):
        e = TextEngine()
        e.add("a", "one two")
        e.add("b", "three four")
        self.assertEqual(e.transitions()["one"]["two"], 1)
        self.assertNotIn("three", e.transitions().get("two", {}))

    def test_vocabulary_and_extraction(self):
        e = TextEngine()
        e.add("a", "Hello hello in 2026. https://example.org")
        self.assertEqual(e.vocabulary()["hello"], 2)
        self.assertEqual(e.extract()["years"], ["2026"])
        self.assertEqual(e.extract()["urls"], ["https://example.org"])

    def test_seeded_generation_and_provenance(self):
        e = TextEngine()
        e.add("a", "alpha beta gamma alpha delta")
        e.add("b", "alpha epsilon")
        a = e.generate("alpha", steps=8, seed=42)
        b = e.generate("alpha", steps=8, seed=42)
        self.assertEqual(a, b)
        self.assertTrue(a)
        for hit in a:
            self.assertEqual(e.documents[hit.document_id][hit.start:hit.end], hit.passage)

    def test_generate_missing_token_and_bounds(self):
        e = TextEngine()
        e.add("a", "hello world")
        with self.assertRaises(ValueError):
            e.generate("absent")
        with self.assertRaises(ValueError):
            e.generate("hello", steps=10001)

    def test_duplicate_document_rejected(self):
        e = TextEngine()
        e.add("x", "one")
        with self.assertRaises(ValueError):
            e.add("x", "two")


if __name__ == "__main__":
    unittest.main()
