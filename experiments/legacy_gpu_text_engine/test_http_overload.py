"""End-to-end HTTP rate limiting and busy-worker behavior."""
import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from mcp_service import handler_factory
from worker import Worker


class BlockingWorker(Worker):
    def __init__(self):
        super().__init__()
        self.entered = threading.Event()
        self.release = threading.Event()

    def search(self, query, limit=20):
        self.entered.set()
        if not self.release.wait(3):
            raise TimeoutError("test worker timed out")
        return super().search(query, limit)


class OverloadHTTPTests(unittest.TestCase):
    def setUp(self):
        self.worker = BlockingWorker()
        self.token = "test-token-" + "z" * 40
        self.server = ThreadingHTTPServer(("127.0.0.1", 0),
                                          handler_factory(self.worker, self.token))
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self):
        self.worker.release.set()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)

    def request(self, method="tools/list", params=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=5)
        body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method,
                           "params": params or {}})
        conn.request("POST", "/mcp", body, {"Authorization": "Bearer " + self.token,
                                            "Content-Type": "application/json"})
        response = conn.getresponse()
        status = response.status
        response.read()
        conn.close()
        return status

    def test_rate_limit_returns_429(self):
        self.assertEqual([self.request() for _ in range(60)], [200] * 60)
        self.assertEqual(self.request(), 429)

    def test_busy_worker_returns_503(self):
        outcome = []
        first = threading.Thread(target=lambda: outcome.append(self.request(
            "tools/call", {"name": "text.search", "arguments": {"query": "x"}})))
        first.start()
        try:
            self.assertTrue(self.worker.entered.wait(2))
            self.assertEqual(self.request(), 503)
        finally:
            self.worker.release.set()
            first.join(timeout=5)
        self.assertEqual(outcome, [200])


if __name__ == "__main__":
    unittest.main()
