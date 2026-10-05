"""Safe ComfyUI execution bridge.

Uses ComfyUI's API-format workflow over HTTP. The bridge only submits an
already-approved workflow graph; it never accepts shell commands. Local ComfyUI
works without authentication; managed providers may supply a bearer token.
"""
from __future__ import annotations

import json
import time
import uuid
from dataclasses import dataclass
from urllib import request


@dataclass
class ComfyResult:
    prompt_id: str
    status: str
    history: dict


class ComfyUIBridge:
    def __init__(
        self,
        base_url: str = "http://127.0.0.1:8188",
        timeout: float = 1800,
        token: str | None = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.token = token.strip() if token else None

    def _headers(self, *, json_content: bool = False) -> dict[str, str]:
        headers: dict[str, str] = {}
        if json_content:
            headers["Content-Type"] = "application/json"
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers

    def submit(self, workflow: dict, client_id: str | None = None) -> str:
        self._validate_workflow(workflow)
        prompt_id = str(uuid.uuid4())
        payload = {"prompt": workflow, "prompt_id": prompt_id}
        if client_id:
            payload["client_id"] = client_id
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
            f"{self.base_url}/prompt",
            data=data,
            headers=self._headers(json_content=True),
            method="POST",
        )
        with request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read())
        if result.get("node_errors"):
            raise ValueError(f"ComfyUI workflow validation failed: {result['node_errors']}")
        return result["prompt_id"]

    def history(self, prompt_id: str) -> dict:
        req = request.Request(
            f"{self.base_url}/history/{prompt_id}",
            headers=self._headers(),
            method="GET",
        )
        with request.urlopen(req, timeout=30) as response:
            return json.loads(response.read())

    def wait(self, prompt_id: str, poll_seconds: float = 2.0) -> ComfyResult:
        deadline = time.monotonic() + self.timeout
        while time.monotonic() < deadline:
            history = self.history(prompt_id)
            item = history.get(prompt_id)
            if item:
                status = item.get("status", {}).get("status_str", "unknown")
                if status in {"success", "error"}:
                    return ComfyResult(prompt_id, status, item)
            time.sleep(poll_seconds)
        raise TimeoutError(f"ComfyUI job {prompt_id} exceeded timeout")

    @staticmethod
    def _validate_workflow(workflow: dict) -> None:
        if not isinstance(workflow, dict) or not workflow:
            raise ValueError("workflow must be a non-empty API-format graph")
        for node_id, node in workflow.items():
            if not isinstance(node_id, str) or not isinstance(node, dict):
                raise ValueError("workflow nodes must be string IDs mapped to objects")
            if not isinstance(node.get("class_type"), str):
                raise ValueError(f"node {node_id} missing class_type")
            if not isinstance(node.get("inputs", {}), dict):
                raise ValueError(f"node {node_id} inputs must be an object")
