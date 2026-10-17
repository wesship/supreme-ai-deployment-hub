"""Loopback HTTP integration checks for the experimental endpoint."""
import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from mcp_service import handler_factory
from worker import Worker


class HttpSecurityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.token = "test-only-token-" + "x" * 40
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0),
                                         handler_factory(Worker(), cls.token))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def request(self, payload, token=None, path="/mcp"):
        conn = http.client.HTTPConnection("127.0.0.1", self.server.server_port, timeout=3)
        headers = {"Content-Type": "application/json"}
        if token is not None:
            headers["Authorization"] = "Bearer " + token
        conn.request("POST", path, body=json.dumps(payload), headers=headers)
        response = conn.getresponse()
        status, data = response.status, response.read()
        conn.close()
        return status, data

    def test_unauthenticated_rejected(self):
        status, _ = self.request({"jsonrpc": "2.0", "method": "tools/list", "id": 1})
        self.assertEqual(status, 401)

    def test_wrong_token_rejected(self):
        status, _ = self.request({"jsonrpc": "2.0", "method": "tools/list", "id": 1},
                                 "incorrect")
        self.assertEqual(status, 401)

    def test_authenticated_tools_list(self):
        status, body = self.request({"jsonrpc": "2.0", "method": "tools/list", "id": 1},
                                    self.token)
        self.assertEqual(status, 200)
        self.assertEqual(len(json.loads(body)["result"]["tools"]), 2)

    def test_invalid_method_rejected(self):
        status, _ = self.request({"jsonrpc": "2.0", "method": "not/allowed", "id": 1},
                                 self.token)
        self.assertEqual(status, 400)

    def test_wrong_path_rejected(self):
        status, _ = self.request({"jsonrpc": "2.0", "method": "tools/list", "id": 1},
                                 self.token, "/other")
        self.assertEqual(status, 404)


if __name__ == "__main__":
    unittest.main()
