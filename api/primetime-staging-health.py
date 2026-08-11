import json
import os
from http.server import BaseHTTPRequestHandler
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class handler(BaseHTTPRequestHandler):
    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Robots-Tag", "noindex, nofollow")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        project_url = os.getenv("PRIMETIME_STAGING_SUPABASE_URL", "").strip().rstrip("/")
        anon_key = os.getenv("PRIMETIME_STAGING_SUPABASE_ANON_KEY", "").strip()
        if not project_url or not anon_key:
            self._send(503, {"ok": False, "error": "staging_health_not_configured"})
            return

        request = Request(
            project_url + "/functions/v1/primetime-staging-health",
            headers={
                "Authorization": "Bearer " + anon_key,
                "apikey": anon_key,
                "User-Agent": "D3VONN-PRIMETIME-Staging-Smoke/2.0",
            },
            method="GET",
        )
        try:
            with urlopen(request, timeout=8) as response:
                data = json.loads(response.read().decode("utf-8"))
                safe = {
                    "ok": bool(data.get("ok")),
                    "environment": "staging",
                    "counts": data.get("counts") if isinstance(data.get("counts"), dict) else {},
                    "checks": data.get("checks") if isinstance(data.get("checks"), dict) else {},
                }
                self._send(200 if safe["ok"] else 503, safe)
        except HTTPError as exc:
            self._send(502, {"ok": False, "error": "upstream_http_error", "status": exc.code})
        except (URLError, TimeoutError, ValueError):
            self._send(502, {"ok": False, "error": "upstream_unavailable"})
