import unittest
from benchmark import run


class BenchmarkTests(unittest.TestCase):
    def test_small_benchmark_reports_provenance_checked_hits(self):
        result = run(words=80, repeats=2)
        self.assertEqual(result["backend"], "cpu")
        self.assertTrue(result["synthetic"])
        self.assertGreater(result["hits"], 0)
        self.assertGreaterEqual(result["latency_ms_median"], 0)

    def test_invalid_bounds(self):
        with self.assertRaises(ValueError):
            run(words=0)
        with self.assertRaises(ValueError):
            run(repeats=0)


if __name__ == "__main__":
    unittest.main()
