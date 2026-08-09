import asyncio
import os
import re
import secrets
import time
from contextlib import asynccontextmanager
from typing import Dict

from fastapi import Depends, FastAPI, Header, HTTPException, status
from jupyter_client import AsyncKernelManager
from pydantic import BaseModel, Field

API_TOKEN = os.environ.get("KERNEL_GATEWAY_API_TOKEN", "")
MAX_SESSIONS = int(os.environ.get("KERNEL_MAX_SESSIONS", "8"))
SESSION_TTL_SECONDS = int(os.environ.get("KERNEL_SESSION_TTL_SECONDS", "1800"))
EXECUTION_TIMEOUT_SECONDS = float(os.environ.get("KERNEL_EXECUTION_TIMEOUT_SECONDS", "15"))
MAX_CODE_BYTES = int(os.environ.get("KERNEL_MAX_CODE_BYTES", "65536"))
MAX_OUTPUT_BYTES = int(os.environ.get("KERNEL_MAX_OUTPUT_BYTES", "1048576"))
SESSION_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


class KernelInstance:
    def __init__(self, manager: AsyncKernelManager, client):
        self.manager = manager
        self.client = client
        self.last_accessed = time.monotonic()
        self.lock = asyncio.Lock()


class SessionStore:
    def __init__(self):
        self.sessions: Dict[str, KernelInstance] = {}
        self.lock = asyncio.Lock()


sessions = SessionStore()


class ExecuteRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=128)
    code: str = Field(min_length=1)


def require_auth(authorization: str | None = Header(default=None)) -> None:
    if not API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Kernel gateway is not configured with an API token.",
        )
    expected = f"Bearer {API_TOKEN}"
    if authorization is None or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


def validate_session_id(session_id: str) -> str:
    if not SESSION_ID_RE.fullmatch(session_id):
        raise HTTPException(status_code=400, detail="Invalid session_id format")
    return session_id


def bounded_append(parts: list[str], text: str, current_size: int) -> int:
    encoded = text.encode("utf-8", errors="replace")
    remaining = MAX_OUTPUT_BYTES - current_size
    if remaining <= 0:
        return current_size
    chunk = encoded[:remaining].decode("utf-8", errors="replace")
    parts.append(chunk)
    return current_size + len(chunk.encode("utf-8"))


async def shutdown_instance(instance: KernelInstance) -> None:
    try:
        instance.client.stop_channels()
    finally:
        await instance.manager.shutdown_kernel(now=True)


async def cleanup_loop() -> None:
    while True:
        await asyncio.sleep(300)
        now = time.monotonic()
        stale: list[tuple[str, KernelInstance]] = []
        async with sessions.lock:
            for sid, instance in list(sessions.sessions.items()):
                if now - instance.last_accessed > SESSION_TTL_SECONDS and not instance.lock.locked():
                    stale.append((sid, sessions.sessions.pop(sid)))
        for _, instance in stale:
            try:
                await shutdown_instance(instance)
            except Exception:
                pass


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = asyncio.create_task(cleanup_loop())
    try:
        yield
    finally:
        task.cancel()
        async with sessions.lock:
            active = list(sessions.sessions.values())
            sessions.sessions.clear()
        await asyncio.gather(*(shutdown_instance(i) for i in active), return_exceptions=True)


app = FastAPI(title="D3VONN Persistent Agent Kernel Gateway", lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/sessions/create/{session_id}", dependencies=[Depends(require_auth)])
async def create_session(session_id: str):
    session_id = validate_session_id(session_id)
    async with sessions.lock:
        existing = sessions.sessions.get(session_id)
        if existing:
            existing.last_accessed = time.monotonic()
            return {"status": "exists", "session_id": session_id}
        if len(sessions.sessions) >= MAX_SESSIONS:
            raise HTTPException(status_code=429, detail="Maximum kernel sessions reached")

        km = AsyncKernelManager(kernel_name="python3")
        await km.start_kernel()
        client = km.client()
        client.start_channels()
        try:
            await client.wait_for_ready(timeout=10)
        except Exception:
            client.stop_channels()
            await km.shutdown_kernel(now=True)
            raise HTTPException(status_code=503, detail="Kernel failed readiness check")

        sessions.sessions[session_id] = KernelInstance(manager=km, client=client)
    return {"status": "created", "session_id": session_id}


@app.post("/execute", dependencies=[Depends(require_auth)])
async def execute_code(req: ExecuteRequest):
    validate_session_id(req.session_id)
    if len(req.code.encode("utf-8")) > MAX_CODE_BYTES:
        raise HTTPException(status_code=413, detail="Code payload exceeds configured limit")

    async with sessions.lock:
        instance = sessions.sessions.get(req.session_id)
    if instance is None:
        raise HTTPException(status_code=404, detail="Session context not found")

    async with instance.lock:
        instance.last_accessed = time.monotonic()
        msg_id = instance.client.execute(req.code, allow_stdin=False, stop_on_error=True)
        stdout_parts: list[str] = []
        stderr_parts: list[str] = []
        output_size = 0
        deadline = time.monotonic() + EXECUTION_TIMEOUT_SECONDS

        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                await instance.manager.interrupt_kernel()
                raise HTTPException(status_code=408, detail="Kernel execution timed out")
            try:
                msg = await asyncio.to_thread(
                    instance.client.get_iopub_msg,
                    timeout=min(1.0, remaining),
                )
            except Exception:
                continue

            if msg.get("parent_header", {}).get("msg_id") != msg_id:
                continue

            msg_type = msg.get("header", {}).get("msg_type")
            content = msg.get("content", {})
            if msg_type == "stream":
                text = str(content.get("text", ""))
                if content.get("name") == "stderr":
                    output_size = bounded_append(stderr_parts, text, output_size)
                else:
                    output_size = bounded_append(stdout_parts, text, output_size)
            elif msg_type in {"execute_result", "display_data"}:
                text = content.get("data", {}).get("text/plain")
                if text:
                    output_size = bounded_append(stdout_parts, str(text), output_size)
            elif msg_type == "error":
                traceback = "\n".join(content.get("traceback", []))
                output_size = bounded_append(stderr_parts, traceback, output_size)
            elif msg_type == "status" and content.get("execution_state") == "idle":
                break

        return {
            "session_id": req.session_id,
            "stdout": "".join(stdout_parts),
            "stderr": "".join(stderr_parts),
            "success": not stderr_parts,
            "output_truncated": output_size >= MAX_OUTPUT_BYTES,
        }


@app.delete("/sessions/{session_id}", dependencies=[Depends(require_auth)])
async def destroy_session(session_id: str):
    session_id = validate_session_id(session_id)
    async with sessions.lock:
        instance = sessions.sessions.pop(session_id, None)
    if instance is None:
        raise HTTPException(status_code=404, detail="Session not found")
    async with instance.lock:
        await shutdown_instance(instance)
    return {"status": "destroyed", "session_id": session_id}
