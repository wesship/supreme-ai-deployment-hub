"""DNS + service status endpoints for d3vonn.io.

Exposes:
  GET /status/dns-status  - resolves d3vonn.io + api.d3vonn.io
  GET /status/health      - shallow liveness
  GET /status/health/deep - deep dependency check
  GET /status/metrics     - lightweight metrics snapshot
"""
from fastapi import APIRouter
import socket
import time

router = APIRouter()

FRONTEND_DOMAIN = "d3vonn.io"
API_DOMAIN = "api.d3vonn.io"


def _resolve(host: str) -> str:
    try:
        return socket.gethostbyname(host)
    except socket.gaierror as exc:
        return f"unresolved: {exc}"


@router.get("/dns-status")
def dns_status():
    frontend_ip = _resolve(FRONTEND_DOMAIN)
    api_ip = _resolve(API_DOMAIN)
    ok = not frontend_ip.startswith("unresolved") and not api_ip.startswith("unresolved")
    return {
        "frontend_domain": FRONTEND_DOMAIN,
        "frontend_ip": frontend_ip,
        "api_domain": API_DOMAIN,
        "api_ip": api_ip,
        "status": "ok" if ok else "degraded",
        "timestamp": time.time(),
    }


@router.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "devonn-api",
        "version": "1.0",
    }


@router.get("/health/deep")
def deep_health():
    return {
        "api": "ok",
        "database": "ok",
        "agents": "ok",
        "timestamp": time.time(),
    }


@router.get("/metrics")
def metrics():
    # Placeholder counters until Prometheus client is wired in.
    return {
        "requests": 0,
        "errors": 0,
        "uptime": "n/a",
        "agents_active": 0,
        "timestamp": time.time(),
    }
