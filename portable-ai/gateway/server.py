#!/usr/bin/env python3
import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BIND = os.getenv("D3VONN_BIND", "127.0.0.1")
PORT = int(os.getenv("D3VONN_PORT", "8787"))
LLAMA_URL = os.getenv("D3VONN_LLAMA_URL", "http://127.0.0.1:8080").rstrip("/")
OFFLINE = os.getenv("D3VONN_OFFLINE", "1") != "0"
MAX_TOKENS = int(os.getenv("D3VONN_MAX_TOKENS", "512"))
TEMPERATURE = float(os.getenv("D3VONN_TEMPERATURE", "0.2"))


def json_response(handler, status, payload):
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def local_llama(message):
    if OFFLINE and not (LLAMA_URL.startswith("http://127.0.0.1") or LLAMA_URL.startswith("http://localhost")):
        raise RuntimeError("Offline policy rejected a non-local inference endpoint")
    payload = json.dumps({
        "messages": [{"role": "user", "content": message}],
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE,
    }).encode("utf-8")
    request = urllib.request.Request(
        LLAMA_URL + "/v1/chat/completions",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        data = json.loads(response.read().decode("utf-8"))
    return data["choices"][0]["message"]["content"]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        if os.getenv("D3VONN_LOG", "1") != "0":
            super().log_message(fmt, *args)

    def do_GET(self):
        if self.path == "/health":
            json_response(self, 200, {
                "ok": True,
                "service": "d3vonn-portable-ai",
                "offline": OFFLINE,
                "inference": "local-llama",
                "bind": BIND,
                "port": PORT,
            })
            return
        json_response(self, 404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/v1/chat":
            json_response(self, 404, {"error": "not_found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 64 * 1024:
                raise ValueError("request too large")
            payload = json.loads(self.rfile.read(length) or b"{}")
            message = str(payload.get("message", "")).strip()
            if not message:
                raise ValueError("message is required")
            answer = local_llama(message)
            json_response(self, 200, {"message": answer, "offline": OFFLINE})
        except (ValueError, json.JSONDecodeError) as exc:
            json_response(self, 400, {"error": str(exc)})
        except (urllib.error.URLError, TimeoutError, RuntimeError) as exc:
            json_response(self, 503, {"error": "local_inference_unavailable", "detail": str(exc)})
        except Exception as exc:
            json_response(self, 500, {"error": "internal_error", "detail": str(exc)})


if __name__ == "__main__":
    ThreadingHTTPServer((BIND, PORT), Handler).serve_forever()
