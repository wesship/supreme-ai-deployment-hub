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
                payload = json.loads(self.rfile.read(length))
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
    secret = os.environ.get("D3VONN_TEXT_ENGINE_TOKEN", "")
    if len(secret) < 32:
        raise SystemExit("D3VONN_TEXT_ENGINE_TOKEN must contain at least 32 characters")
    ThreadingHTTPServer(("127.0.0.1", 8765), handler_factory(Worker(), secret)).serve_forever()
