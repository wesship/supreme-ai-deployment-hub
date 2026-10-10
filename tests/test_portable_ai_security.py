from __future__ import annotations

import http.client
import importlib
import json
import os
import sys
import threading
import unittest
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

GATEWAY_DIR = Path(__file__).resolve().parents[1] / "portable-ai" / "gateway"
sys.path.insert(0, str(GATEWAY_DIR))
config_module = importlib.import_module("config")
server_module = importlib.import_module("server")

RuntimeConfig = config_module.RuntimeConfig
PortableServer = server_module.PortableServer


def runtime_config(*, llama_url: str = "http://127.0.0.1:8080") -> RuntimeConfig:
    return RuntimeConfig(
        bind="127.0.0.1",
        port=8787,
        llama_url=llama_url,
        max_tokens=64,
        temperature=0.2,
        max_chat_bytes=4096,
        max_audio_bytes=4096,
        max_upstream_bytes=4096,
        upstream_timeout_seconds=2,
        whisper_bin="whisper-cli",
        whisper_model="",
        whisper_timeout_seconds=2,
        log_requests=False,
    )


@contextmanager
def running_gateway(config: RuntimeConfig):
    gateway = PortableServer(("127.0.0.1", 0), config)
    thread = threading.Thread(target=gateway.serve_forever, daemon=True)
    thread.start()
    try:
        yield gateway.server_address[1]
    finally:
        gateway.shutdown()
        gateway.server_close()
        thread.join(timeout=2)


class LlamaHandler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_POST(self):
        length = int(self.headers["Content-Length"])
        payload = json.loads(self.rfile.read(length))
        answer = payload["messages"][0]["content"]
        body = json.dumps({"choices": [{"message": {"content": f"local:{answer}"}}]}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


@contextmanager
def running_llama():
    server = ThreadingHTTPServer(("127.0.0.1", 0), LlamaHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_address[1]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


class PortableAISecurityTests(unittest.TestCase):
    def test_bind_rejects_every_non_literal_loopback(self):
        for value in ["0.0.0.0", "192.168.1.4", "localhost", "example.com"]:
            with self.subTest(value=value), self.assertRaisesRegex(ValueError, "loopback IP literal"):
                config_module.validate_bind(value)

    def test_inference_endpoint_rejects_remote_and_ambiguous_urls(self):
        values = [
            "https://example.com",
            "http://127.0.0.1.example.com:8080",
            "http://localhost:8080",
            "ftp://127.0.0.1:8080",
            "http://user@127.0.0.1:8080",
            "http://127.0.0.1:8080?next=https://example.com",
        ]
        for value in values:
            with self.subTest(value=value), self.assertRaises(ValueError):
                config_module.validate_local_endpoint(value)

    def test_environment_cannot_disable_offline_policy(self):
        with mock.patch.dict(os.environ, {"D3VONN_OFFLINE": "0"}):
            with self.assertRaisesRegex(ValueError, "must remain 1"):
                RuntimeConfig.from_environment()

    def test_env_file_is_data_only_and_rejects_non_d3vonn_keys(self):
        with mock.patch.dict(os.environ, {}, clear=True), TemporaryDirectory() as temp_dir:
            safe = Path(temp_dir) / ".env"
            safe.write_text("D3VONN_PORT=$(touch should-not-execute)\n", encoding="utf-8")
            config_module.load_env_file(safe)
            self.assertEqual(os.environ["D3VONN_PORT"], "$(touch should-not-execute)")

            unsafe = Path(temp_dir) / "unsafe.env"
            unsafe.write_text("PATH=/attacker\n", encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "unsupported .env key"):
                config_module.load_env_file(unsafe)

    def test_gateway_rejects_dns_rebinding_host_and_cross_site_origin(self):
        with running_gateway(runtime_config()) as port:
            connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
            connection.request("GET", "/health", headers={"Host": f"attacker.example:{port}"})
            self.assertEqual(connection.getresponse().status, 403)
            connection.close()

    def test_server_constructor_rejects_non_loopback_bind(self):
        with self.assertRaisesRegex(ValueError, "configured loopback"):
            PortableServer(("0.0.0.0", 0), runtime_config())

            connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
            connection.request(
                "GET",
                "/health",
                headers={"Host": f"127.0.0.1:{port}", "Origin": "https://attacker.example"},
            )
            response = connection.getresponse()
            self.assertEqual(response.status, 403)
            self.assertEqual(json.loads(response.read()), {"error": "invalid_origin"})
            connection.close()

    def test_gateway_serves_same_origin_console_with_security_headers(self):
        with running_gateway(runtime_config()) as port:
            connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
            connection.request("GET", "/", headers={"Host": f"127.0.0.1:{port}"})
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(response.getheader("X-Frame-Options"), "DENY")
            self.assertIn("frame-ancestors 'none'", response.getheader("Content-Security-Policy"))
            self.assertIn(b"D3VONN Portable AI", response.read())
            connection.close()

    def test_chat_round_trip_stays_on_loopback(self):
        with running_llama() as llama_port:
            with running_gateway(runtime_config(llama_url=f"http://127.0.0.1:{llama_port}")) as port:
                body = json.dumps({"message": "hello"})
                connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
                connection.request(
                    "POST",
                    "/v1/chat",
                    body=body,
                    headers={
                        "Host": f"127.0.0.1:{port}",
                        "Origin": f"http://127.0.0.1:{port}",
                        "Content-Type": "application/json",
                    },
                )
                response = connection.getresponse()
                self.assertEqual(response.status, 200)
                self.assertEqual(json.loads(response.read()), {"message": "local:hello", "offline": True})
                connection.close()

    def test_chat_rejects_simple_cross_site_content_type(self):
        with running_gateway(runtime_config()) as port:
            connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
            connection.request(
                "POST",
                "/v1/chat",
                body="message=hello",
                headers={"Host": f"127.0.0.1:{port}", "Content-Type": "text/plain"},
            )
            response = connection.getresponse()
            self.assertEqual(response.status, 415)
            self.assertEqual(json.loads(response.read()), {"error": "unsupported_media_type"})
            connection.close()


if __name__ == "__main__":
    unittest.main()
