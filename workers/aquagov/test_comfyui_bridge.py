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
