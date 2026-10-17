"""Deterministic request limiter and concurrency gate tests."""
import threading
import unittest
from unittest.mock import patch
from http.server import ThreadingHTTPServer
from mcp_service import handler_factory
from worker import Worker


class OverloadTests(unittest.TestCase):
    def test_request_budget_is_isolated_per_handler_factory(self):
        a = handler_factory(Worker(), "a" * 32)
        b = handler_factory(Worker(), "b" * 32)
        self.assertIsNot(a, b)
        self.assertEqual(a.timeout, 5)
        self.assertEqual(b.timeout, 5)

    def test_worker_rejects_oversized_queries(self):
        worker = Worker()
        with self.assertRaises(ValueError):
            worker.search("a" * 257)

    def test_worker_rejects_unsupported_backend(self):
        with self.assertRaises(ValueError):
            Worker(backend="cuda")


if __name__ == "__main__":
    unittest.main()
