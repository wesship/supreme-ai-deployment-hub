import unittest
from worker import Worker, MAX_TOTAL_CHARS


class CorpusBudgetTests(unittest.TestCase):
    def test_aggregate_budget_rejected_without_mutation(self):
        w = Worker()
        w.ingest("first", "a" * 1000000)
        w.ingest("second", "b" * 1000000)
        self.assertEqual(w.total_chars, MAX_TOTAL_CHARS)
        with self.assertRaises(ValueError):
            w.ingest("third", "c")
        self.assertEqual(len(w.engine.documents), 2)
        self.assertEqual(w.total_chars, MAX_TOTAL_CHARS)

    def test_duplicate_does_not_change_accounting(self):
        w = Worker()
        w.ingest("a", "hi")
        with self.assertRaises(ValueError):
            w.ingest("a", "new")
        self.assertEqual(w.total_chars, 2)


if __name__ == "__main__":
    unittest.main()
