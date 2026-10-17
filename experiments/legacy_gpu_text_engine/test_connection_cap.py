"""Connection admission regression checks."""
import socket
import threading
import unittest
from mcp_service import BoundedHTTPServer, handler_factory
from worker import Worker


class BoundedConnectionsTests(unittest.TestCase):
    def test_server_caps_active_connections(self):
        server = BoundedHTTPServer(("127.0.0.1", 0),
                                   handler_factory(Worker(), "x" * 40))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        clients = []
        try:
            for _ in range(server.max_active_connections):
                client = socket.create_connection(("127.0.0.1", server.server_port), timeout=3)
                client.sendall(b"POST /mcp HTTP/1.0\r\n")
                clients.append(client)
            # The server must reject additional connections instead of
            # allocating unbounded handler threads.
            extra = socket.create_connection(("127.0.0.1", server.server_port), timeout=3)
            try:
                extra.settimeout(3)
                response = extra.recv(256)
                self.assertIn(b"503 Service Unavailable", response)
            finally:
                extra.close()
        finally:
            for client in clients:
                client.close()
            server.shutdown()
            server.server_close()
            thread.join(timeout=5)


if __name__ == "__main__":
    unittest.main()
