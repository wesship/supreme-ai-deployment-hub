import unittest
from worker import Worker
from mcp_service import dispatch


class WorkerTests(unittest.TestCase):
    def test_cpu_search(self):
        worker = Worker()
        worker.ingest("doc", "Alpha alpha")
        self.assertEqual([h["start"] for h in worker.search("alpha")["hits"]], [0, 6])

    def test_gpu_rejected(self):
        with self.assertRaises(ValueError):
            Worker("cuda")

    def test_limits(self):
        worker = Worker()
        with self.assertRaises(ValueError):
            worker.ingest("doc", "x" * 1000001)
        with self.assertRaises(ValueError):
            worker.search("x" * 257)

    def test_mcp_allowlist(self):
        worker = Worker()
        request = {"jsonrpc": "2.0", "method": "tools/list", "id": 1}
        self.assertEqual(len(dispatch(request, worker)["tools"]), 2)
        with self.assertRaises(ValueError):
            dispatch({"jsonrpc": "2.0", "method": "tools/execute"}, worker)
        with self.assertRaises(ValueError):
            dispatch({"jsonrpc": "2.0", "method": "tools/call",
                      "params": {"name": "text.search", "arguments": {"query": "a", "extra": 1}}}, worker)


if __name__ == "__main__":
    unittest.main()
