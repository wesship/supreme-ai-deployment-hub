import unittest
from worker import Worker
from mcp_service import handler_factory, dispatch


class SecurityTests(unittest.TestCase):
    def test_handler_security_configuration(self):
        handler = handler_factory(Worker(), "s" * 32)
        self.assertEqual(handler.timeout, 5)

    def test_disallowed_tool_and_arguments(self):
        worker = Worker()
        with self.assertRaises(ValueError):
            dispatch({"jsonrpc": "2.0", "method": "tools/call",
                      "params": {"name": "text.ingest", "arguments": {
                          "document_id": "x", "text": "a", "unexpected": True}}}, worker)

    def test_worker_rejects_gpu(self):
        with self.assertRaises(ValueError):
            Worker("cuda")


if __name__ == "__main__":
    unittest.main()
