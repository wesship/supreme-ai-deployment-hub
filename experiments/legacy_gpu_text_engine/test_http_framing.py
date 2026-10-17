"""HTTP request framing regression tests."""
import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from mcp_service import handler_factory
from worker import Worker


class FramingTests(unittest.TestCase):
    def test_truncated_body_is_rejected(self):
        token = "t" * 40
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler_factory(Worker(), token))
        server.daemon_threads = True
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            conn = http.client.HTTPConnection("127.0.0.1", server.server_port, timeout=8)
            conn.putrequest("POST", "/mcp")
            conn.putheader("Authorization", "Bearer " + token)
            conn.putheader("Content-Length", "50")
            conn.endheaders()
            conn.send(b'{"jsonrpc":"2.0"}')
            conn.sock.shutdown(1)
            response = conn.getresponse()
            self.assertEqual(response.status, 400)
            data = json.loads(response.read())
            self.assertIn("incomplete request body", data["error"]["message"])
            conn.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
