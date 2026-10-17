"""Minimal stdlib JSON-RPC MCP-shaped HTTP endpoint for private staging.

Not a complete MCP transport implementation. Binds to loopback only.
"""
from __future__ import annotations
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import hmac
import json
import os
import threading
import time
from collections import deque
from worker import Worker
from staging_config import StagingConfig



class BoundedHTTPServer(ThreadingHTTPServer):
    """Reject excess connections before allocating a handler thread."""
    daemon_threads = True
    max_active_connections = 8

    def __init__(self, server_address, RequestHandlerClass):
        self._slots = threading.BoundedSemaphore(self.max_active_connections)
        super().__init__(server_address, RequestHandlerClass)

    def process_request(self, request, client_address):
        if not self._slots.acquire(blocking=False):
            try:
                request.sendall(
                    b"HTTP/1.0 503 Service Unavailable\\r\\n"
                    b"Connection: close\\r\\nContent-Length: 0\\r\\n\\r\\n"
                )
            except OSError:
                pass
            self.shutdown_request(request)
            return
        try:
            super().process_request(request, client_address)
        except BaseException:
            self._slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._slots.release()

MAX_BODY = 16384
TOOLS = [
    {"name": "text.ingest", "description": "Ingest a bounded document into volatile memory",
     "inputSchema": {"type": "object", "properties": {
         "document_id": {"type": "string"}, "text": {"type": "string"}},
         "required": ["document_id", "text"], "additionalProperties": False}},
    {"name": "text.search", "description": "Search ingested documents with source offsets",
     "inputSchema": {"type": "object", "properties": {
         "query": {"type": "string"}, "limit": {"type": "integer"}},
         "required": ["query"], "additionalProperties": False}},
]


def dispatch(payload: dict, worker: Worker) -> dict:
    if not isinstance(payload, dict) or payload.get("jsonrpc") != "2.0":
        raise ValueError("invalid JSON-RPC request")
    method = payload.get("method")
    if method == "tools/list":
        return {"tools": TOOLS}
    if method != "tools/call":
        raise ValueError("method not allowlisted")
    params = payload.get("params", {})
    if not isinstance(params, dict) or not isinstance(params.get("arguments", {}), dict):
        raise ValueError("invalid params")
    args = params.get("arguments", {})
    name = params.get("name")
    if name == "text.ingest" and set(args) == {"document_id", "text"}:
        return {"content": [{"type": "text", "text": json.dumps(worker.ingest(**args))}]}
    if name == "text.search" and set(args).issubset({"query", "limit"}) and "query" in args:
        return {"content": [{"type": "text", "text": json.dumps(worker.search(**args))}]}
    raise ValueError("tool or arguments not allowlisted")


def handler_factory(worker: Worker, secret: str):
    # Fixed-window limiter shared by loopback requests; cap parallel work.
    timestamps = deque()
    rate_lock = threading.Lock()
    worker_lock = threading.Lock()

    def admitted(now: float) -> bool:
        with rate_lock:
            while timestamps and now - timestamps[0] >= 60:
                timestamps.popleft()
            if len(timestamps) >= 60:
                return False
            timestamps.append(now)
            return True

    class Handler(BaseHTTPRequestHandler):
        timeout = 5
        protocol_version = "HTTP/1.0"

        def setup(self):
            super().setup()
            self.connection.settimeout(self.timeout)

        def do_POST(self):
            if self.path != "/mcp":
                self.send_error(404)
                return
            if not hmac.compare_digest(self.headers.get("Authorization", ""), "Bearer " + secret):
                self.send_error(401)
                return
            if not admitted(time.monotonic()):
                self.send_error(429, "request rate exceeded")
                return
            if not worker_lock.acquire(blocking=False):
                self.send_error(503, "worker busy")
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 1 <= length <= MAX_BODY:
                    self.send_error(413)
                    return
                raw = self.rfile.read(length)
                if len(raw) != length:
                    raise ValueError("incomplete request body")
                payload = json.loads(raw)
                result = dispatch(payload, worker)
                response = {"jsonrpc": "2.0", "id": payload.get("id"), "result": result}
                encoded = json.dumps(response).encode()
                self.send_response(200)
            except (ValueError, TypeError, json.JSONDecodeError) as exc:
                encoded = json.dumps({"jsonrpc": "2.0", "id": None, "error": {
                    "code": -32602, "message": str(exc)}}).encode()
                self.send_response(400)
            except TimeoutError:
                encoded = b'{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"request timeout"}}'
                self.send_response(408)
            finally:
                worker_lock.release()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)

    return Handler


if __name__ == "__main__":
    config = StagingConfig.from_environment()
    server = BoundedHTTPServer((config.host, config.port),
                                 handler_factory(Worker(), config.token))
    server.daemon_threads = True
    server.serve_forever()
