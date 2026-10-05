import pytest

from comfyui_bridge import ComfyUIBridge


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
