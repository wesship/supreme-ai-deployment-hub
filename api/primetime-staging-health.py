import json
from http.server import BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

PROJECT_URL = "https://hyeqzvkmwayohmuukups.supabase.co"
ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5ZXF6dmttd2F5b2htdXVrdXBzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzk3NTcsImV4cCI6MjEwMTcxNTc1N30.qMFBPRZkl3OkDpQJJ5pyJKvhXidK20UGGs0_ykuH1xw"

class handler(BaseHTTPRequestHandler):
    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Robots-Tag", "noindex")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        req = Request(
            PROJECT_URL + "/functions/v1/primetime-staging-health",
            headers={
                "Authorization": "Bearer " + ANON_JWT,
                "apikey": ANON_JWT,
                "User-Agent": "PRIMETIME-Staging-Smoke/1.0",
            },
            method="GET",
        )
        try:
            with urlopen(req, timeout=8) as response:
                data = json.loads(response.read().decode("utf-8"))
                self._send(200 if data.get("ok") else 503, {
                    "ok": bool(data.get("ok")),
                    "source": "vercel->supabase-edge",
                    "staging": data,
                })
        except HTTPError as exc:
            self._send(502, {"ok": False, "source": "vercel->supabase-edge", "error": "upstream_http_error", "status": exc.code})
        except (URLError, TimeoutError, ValueError):
            self._send(502, {"ok": False, "source": "vercel->supabase-edge", "error": "upstream_unavailable"})
