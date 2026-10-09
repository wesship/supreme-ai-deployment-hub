import urllib.error
import urllib.request

import pytest

from comfyui_bridge import ComfyUIBridge, SafeBearerRedirectHandler
from preflight import _SafeBearerRedirectHandler


def test_valid_api_workflow():
    ComfyUIBridge._validate_workflow({"1": {"class_type": "LoadImage", "inputs": {}}})


def test_rejects_empty_workflow():
    with pytest.raises(ValueError):
        ComfyUIBridge._validate_workflow({})


def test_rejects_missing_class_type():
    with pytest.raises(ValueError):
        ComfyUIBridge._validate_workflow({"1": {"inputs": {}}})


def test_local_headers_have_no_authorization():
    bridge = ComfyUIBridge()
    assert bridge._headers(json_content=True) == {"Content-Type": "application/json"}


def test_managed_headers_include_bearer_token():
    bridge = ComfyUIBridge(token="secret-token")
    assert bridge._headers() == {"Authorization": "Bearer secret-token"}
    assert bridge._headers(json_content=True) == {
        "Content-Type": "application/json",
        "Authorization": "Bearer secret-token",
    }


@pytest.mark.parametrize("handler_cls", [SafeBearerRedirectHandler, _SafeBearerRedirectHandler])
def test_authenticated_cross_origin_redirect_is_blocked(handler_cls):
    handler = handler_cls()
    req = urllib.request.Request(
        "https://comfy.example/system_stats",
        headers={"Authorization": "Bearer secret-token"},
    )
    with pytest.raises(urllib.error.HTTPError):
        handler.redirect_request(
            req,
            None,
            302,
            "Found",
            {},
            "https://evil.example/collect",
        )


@pytest.mark.parametrize("handler_cls", [SafeBearerRedirectHandler, _SafeBearerRedirectHandler])
def test_authenticated_same_origin_redirect_is_allowed(handler_cls):
    handler = handler_cls()
    req = urllib.request.Request(
        "https://comfy.example/system_stats",
        headers={"Authorization": "Bearer secret-token"},
    )
    redirected = handler.redirect_request(
        req,
        None,
        302,
        "Found",
        {},
        "https://comfy.example/v2/system_stats",
    )
    assert redirected.full_url == "https://comfy.example/v2/system_stats"
    assert redirected.get_header("Authorization") == "Bearer secret-token"


@pytest.mark.parametrize("handler_cls", [SafeBearerRedirectHandler, _SafeBearerRedirectHandler])
def test_unauthenticated_cross_origin_redirect_is_allowed(handler_cls):
    handler = handler_cls()
    req = urllib.request.Request("https://comfy.example/system_stats")
    redirected = handler.redirect_request(
        req,
        None,
        302,
        "Found",
        {},
        "https://cdn.example/system_stats",
    )
    assert redirected.full_url == "https://cdn.example/system_stats"
    assert redirected.get_header("Authorization") is None
