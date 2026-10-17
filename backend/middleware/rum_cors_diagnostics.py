"""Opt-in, privacy-limited diagnostics for rejected CORS preflight requests.

Install *outside* CORSMiddleware so it can inspect CORS rejections. Never log
request bodies, cookies, authorization values, query strings, or client IPs.
Enable only for short-lived staging diagnosis via RUM_CORS_DIAGNOSTICS=1.
"""
import logging
import os
from urllib.parse import urlsplit

logger = logging.getLogger("d3vonn.cors_diagnostics")


class RumCorsDiagnosticsMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (
            os.getenv("RUM_CORS_DIAGNOSTICS") != "1"
            or scope.get("type") != "http"
            or scope.get("method") != "OPTIONS"
            or scope.get("path") != "/api/assurance/public/rum"
        ):
            return await self.app(scope, receive, send)

        headers = dict(scope.get("headers", []))
        origin = headers.get(b"origin", b"").decode("utf-8", "replace")
        requested_method = headers.get(b"access-control-request-method", b"").decode("ascii", "replace")
        requested_headers = headers.get(b"access-control-request-headers", b"").decode("ascii", "replace")
        # Record only a fixed, allowlisted origin hostname; unknown origins
        # are categorized rather than logged verbatim.
        known_hosts = {
            "d3vonn.io", "www.d3vonn.io", "app.d3vonn.io",
            "hnfportal.one", "www.hnfportal.one",
            "supreme-ai-deployment-hub.vercel.app",
            "supreme-ai-deployment-hub.lovable.app",
        }
        parsed = urlsplit(origin)
        origin_label = parsed.hostname if parsed.scheme == "https" and parsed.hostname in known_hosts else "other"
        method_label = requested_method if requested_method in {"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"} else "other"
        # Log header *names* only, restricted to an explicit safe vocabulary.
        safe_header_names = {"authorization", "content-type", "x-requested-with", "x-request-id", "x-workspace-id"}
        header_names = sorted({h.strip().lower() for h in requested_headers.split(",") if h.strip()})
        header_labels = [h if h in safe_header_names else "other" for h in header_names][:12]

        async def inspect_send(message):
            if message.get("type") == "http.response.start" and message.get("status") == 400:
                logger.warning(
                    "RUM CORS preflight rejected origin=%s method=%s header_names=%s",
                    origin_label, method_label, ",".join(header_labels),
                )
            await send(message)

        await self.app(scope, receive, inspect_send)
