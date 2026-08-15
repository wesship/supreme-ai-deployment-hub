#!/usr/bin/env python3
"""One-shot source patcher for the PR #908 Python CodeQL baseline.

This file is temporary and is removed after the branch-only repair workflow
commits the source changes. Every replacement is exact and fails closed if the
expected source is not present.
"""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, found {count}: {old[:80]!r}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


def replace_all(path: str, old: str, new: str, expected: int) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != expected:
        raise RuntimeError(f"{path}: expected {expected} matches, found {count}: {old[:80]!r}")
    target.write_text(text.replace(old, new), encoding="utf-8")


# 1. Do not persist provider identifiers that CodeQL classifies as sensitive.
replace_once(
    "scripts/final_voice_activation.py",
    '                    "voice_id": config["ELEVENLABS_DEFAULT_VOICE_ID"],\n',
    '',
)

# 2. The audit may inspect secret-bearing source; never echo arbitrary finding text.
replace_once(
    "scripts/security_audit.py",
    '    def ok(self, msg: str)   -> None: self.passed.append(msg); print(f"  \\033[32m✓\\033[0m {msg}")\n'
    '    def fail(self, msg: str) -> None: self.failed.append(msg); print(f"  \\033[31m✗\\033[0m {msg}")\n'
    '    def warn(self, msg: str) -> None: self.warned.append(msg); print(f"  \\033[33m!\\033[0m {msg}")\n',
    '    def ok(self, msg: str) -> None:\n'
    '        self.passed.append(msg)\n'
    '        print("  \\033[32m✓\\033[0m check passed")\n\n'
    '    def fail(self, msg: str) -> None:\n'
    '        self.failed.append(msg)\n'
    '        print("  \\033[31m✗\\033[0m check failed; details retained in memory only")\n\n'
    '    def warn(self, msg: str) -> None:\n'
    '        self.warned.append(msg)\n'
    '        print("  \\033[33m!\\033[0m check warning; details retained in memory only")\n',
)
replace_once(
    "scripts/security_audit.py",
    '        for f in r.failed:\n            print(f"  ✗ {f}")\n',
    '',
)

# 3. Parse media URLs structurally instead of substring/scheme prefix checks.
replace_once(
    "backend/ai_films/assembly_worker.py",
    'from urllib.parse import quote\n',
    'from urllib.parse import quote, urlparse\n',
)
replace_once(
    "backend/ai_films/assembly_worker.py",
    '    if "drive.google.com" in media_url or source_type == "google_drive":\n'
    '        raise AssemblyBlocked(\n'
    '            f"Asset {row.get(\'id\')} is a private Google Drive source and must be materialized first"\n'
    '        )\n'
    '    if not media_url.startswith(("https://", "http://")):\n'
    '        raise AssemblyBlocked(f"Asset {row.get(\'id\')} does not expose a server-readable media URL")\n',
    '    parsed_media = urlparse(media_url)\n'
    '    media_host = (parsed_media.hostname or "").lower()\n'
    '    is_drive_host = media_host == "drive.google.com" or media_host.endswith(".drive.google.com")\n'
    '    if is_drive_host or source_type == "google_drive":\n'
    '        raise AssemblyBlocked(\n'
    '            f"Asset {row.get(\'id\')} is a private Google Drive source and must be materialized first"\n'
    '        )\n'
    '    if parsed_media.scheme not in {"https", "http"} or not parsed_media.netloc:\n'
    '        raise AssemblyBlocked(f"Asset {row.get(\'id\')} does not expose a server-readable media URL")\n',
)

# 4. Report only exact official D3VONN CORS hosts.
replace_once(
    "backend/railway_app.py",
    'from importlib import import_module\n',
    'from importlib import import_module\nfrom urllib.parse import urlparse\n',
)
replace_once(
    "backend/railway_app.py",
    'logger = logging.getLogger(__name__)\n_base_lifespan = app.router.lifespan_context\n',
    'logger = logging.getLogger(__name__)\n_base_lifespan = app.router.lifespan_context\n_OFFICIAL_D3VONN_HOSTS = {"d3vonn.io", "www.d3vonn.io", "app.d3vonn.io", "api.d3vonn.io"}\n\n\ndef _is_official_d3vonn_origin(origin: str) -> bool:\n'
    '    try:\n'
    '        parsed = urlparse(origin)\n'
    '    except ValueError:\n'
    '        return False\n'
    '    return parsed.scheme == "https" and (parsed.hostname or "").lower() in _OFFICIAL_D3VONN_HOSTS\n',
)
replace_once(
    "backend/railway_app.py",
    '        "official_cors_origins": [origin for origin in RAILWAY_ALLOWED_ORIGINS if origin.endswith("d3vonn.io")],\n',
    '        "official_cors_origins": [origin for origin in RAILWAY_ALLOWED_ORIGINS if _is_official_d3vonn_origin(origin)],\n',
)

# 5. Make security tests compare parsed directive tokens / exact list members.
replace_once(
    "backend/tests/test_ai_film_drive_picker.py",
    '    assert "script-src" in csp and "https://apis.google.com" in csp\n'
    '    assert "connect-src" in csp and "https://www.googleapis.com" in csp\n'
    '    assert "frame-src" in csp and "https://docs.google.com" in csp\n'
    '    assert "https://drive.google.com" in csp\n'
    '    assert "https://accounts.google.com" in csp\n',
    '    directives = {}\n'
    '    for raw_directive in csp.split(";"):\n'
    '        tokens = raw_directive.strip().split()\n'
    '        if tokens:\n'
    '            directives[tokens[0]] = set(tokens[1:])\n\n'
    '    assert "https://apis.google.com" in directives.get("script-src", set())\n'
    '    assert "https://www.googleapis.com" in directives.get("connect-src", set())\n'
    '    assert "https://docs.google.com" in directives.get("frame-src", set())\n'
    '    assert "https://drive.google.com" in directives.get("frame-src", set())\n'
    '    assert "https://accounts.google.com" in directives.get("frame-src", set())\n',
)
replace_once(
    "backend/tests/test_cors_config.py",
    '    assert "https://internal.example" in origins\n    assert "http://localhost:5173" in origins\n',
    '    assert {"https://internal.example", "http://localhost:5173"}.issubset(set(origins))\n',
)

# 6. Encode every caller-controlled provider path segment before HTTP dispatch.
replace_once(
    "src/main.py",
    'from datetime import datetime\n',
    'from datetime import datetime\nfrom urllib.parse import quote\n',
)
replace_once(
    "src/main.py",
    '                f"{n8n_base_url}/api/v1/executions/{execution_id}",\n',
    '                f"{n8n_base_url}/api/v1/executions/{quote(execution_id, safe=\'\')}",\n',
)
replace_once(
    "src/main.py",
    '    api_url = f"https://api-inference.huggingface.co/models/{model_id}"\n',
    '    model_parts = model_id.split("/", 1)\n'
    '    if len(model_parts) != 2 or not all(model_parts):\n'
    '        raise HTTPException(status_code=400, detail="Hugging Face model must be owner/model")\n'
    '    encoded_model = "/".join(quote(part, safe="") for part in model_parts)\n'
    '    api_url = f"https://api-inference.huggingface.co/models/{encoded_model}"\n',
)
replace_once(
    "src/main.py",
    '    api_url = f"https://api.elevenlabs.io/v1/text-to-speech/{data.voice_id}"\n',
    '    api_url = f"https://api.elevenlabs.io/v1/text-to-speech/{quote(data.voice_id, safe=\'\')}"\n',
)

replace_once(
    "backend/app/routers/tools.py",
    'from datetime import datetime, timezone\n',
    'from datetime import datetime, timezone\nfrom urllib.parse import quote\n',
)
replace_once(
    "backend/app/routers/tools.py",
    '                f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",\n',
    '                f"https://api.elevenlabs.io/v1/text-to-speech/{quote(voice_id, safe=\'\')}",\n',
)
replace_once(
    "backend/app/routers/tools.py",
    '    url = f"https://api.github.com/repos/{settings.github_repo}/actions/workflows/{request.workflow}/dispatches"\n',
    '    repo_path = "/".join(quote(part, safe="") for part in settings.github_repo.split("/", 1))\n'
    '    workflow_path = quote(request.workflow, safe="")\n'
    '    url = f"https://api.github.com/repos/{repo_path}/actions/workflows/{workflow_path}/dispatches"\n',
)
replace_once(
    "backend/app/routers/tools.py",
    '        f"https://api.github.com/repos/{settings.github_repo}/actions/workflows/{workflow}/runs"\n'
    '        if workflow\n'
    '        else f"https://api.github.com/repos/{settings.github_repo}/actions/runs"\n',
    '        f"https://api.github.com/repos/{repo_path}/actions/workflows/{quote(workflow, safe=\'\')}/runs"\n'
    '        if workflow\n'
    '        else f"https://api.github.com/repos/{repo_path}/actions/runs"\n',
)
replace_once(
    "backend/app/routers/tools.py",
    '    url = (\n',
    '    repo_path = "/".join(quote(part, safe="") for part in settings.github_repo.split("/", 1))\n    url = (\n',
)
replace_once(
    "backend/app/routers/tools.py",
    '                f"{settings.n8n_base_url}/api/v1/workflows/{workflow_id}/execute",\n',
    '                f"{settings.n8n_base_url}/api/v1/workflows/{quote(str(workflow_id), safe=\'\')}/execute",\n',
)

# 7. Remove user-controlled strings from security/operations log records.
replace_once(
    "backend/app/routers/chat.py",
    '    logger.info("chat_proxy user=%s model=%s stream=%s", user_id, request.model, request.stream)\n',
    '    logger.info("chat_proxy request accepted stream=%s", request.stream)\n',
)
replace_once(
    "backend/intelligence/workflows/engine.py",
    '            logger.error("Workflow %s timed out", workflow_name)\n',
    '            logger.error("Workflow execution timed out")\n',
)
replace_once(
    "backend/intelligence/workflows/engine.py",
    '            logger.exception("Workflow %s failed: %s", workflow_name, exc)\n',
    '            logger.error("Workflow execution failed")\n',
)
replace_once(
    "backend/intelligence/memory/memory.py",
    '            logger.debug("Long-term memory stored locally: %s", key)\n',
    '            logger.debug("Long-term memory stored locally")\n',
)
replace_once(
    "backend/intelligence/orchestration/orchestrator.py",
    '            logger.exception("Orchestration failed for goal: %s", goal)\n',
    '            logger.error("Orchestration execution failed")\n',
)
replace_once(
    "backend/app/routers/proxy_vault.py",
    '        logger.warning(\n'
    '            "API_KEY_VAULT_SECRET not set — storing key %s in plaintext. "\n'
    '            "Set API_KEY_VAULT_SECRET in Railway to enable encryption.",\n'
    '            body.name,\n'
    '        )\n',
    '        logger.warning(\n'
    '            "API_KEY_VAULT_SECRET not set — storing requested key in plaintext. "\n'
    '            "Set API_KEY_VAULT_SECRET in Railway to enable encryption."\n'
    '        )\n',
)
replace_once(
    "backend/app/routers/rag.py",
    '        logger.info(\n'
    '            "rag_ingest user=%s filename=%s chunks=%d dimension=%d",\n'
    '            user_id,\n'
    '            request.filename,\n'
    '            len(request.chunks),\n'
    '            pinecone_dimension,\n'
    '        )\n',
    '        logger.info("rag_ingest chunks=%d dimension=%d", len(request.chunks), pinecone_dimension)\n',
)
replace_all(
    "backend/app/routers/rag.py",
    '        logger.exception("rag_ingest error: %s", exc)\n',
    '        logger.error("rag_ingest failed")\n',
    1,
)
replace_once(
    "backend/app/routers/rag.py",
    '        logger.info("rag_retrieve user=%s results=%d", user_id, len(results))\n',
    '        logger.info("rag_retrieve results=%d", len(results))\n',
)
replace_once(
    "backend/app/routers/rag.py",
    '        logger.exception("rag_retrieve error: %s", exc)\n',
    '        logger.error("rag_retrieve failed")\n',
)
replace_once(
    "backend/app/routers/rag.py",
    '    logger.info("rag_delete user=%s filename=%s", user_id, request.filename)\n',
    '    logger.info("rag_delete completed")\n',
)
replace_once(
    "backend/hermes/task_engine.py",
    '        logger.debug("[hermes_log] %s %s", event, message)\n',
    '        logger.debug("Hermes event skipped because persistence is not configured")\n',
)

# tools.py log records: keep provider/status metadata, remove caller strings.
replace_once(
    "backend/app/routers/tools.py",
    '        logger.info("voice_tts provider=elevenlabs user=%s chars=%d", user_id, len(request.text))\n',
    '        logger.info("voice_tts provider=elevenlabs chars=%d", len(request.text))\n',
)
replace_once(
    "backend/app/routers/tools.py",
    '            "voice_tts provider=openai user=%s chars=%d voice=%s",\n'
    '            user_id,\n'
    '            len(request.text),\n'
    '            openai_voice,\n',
    '            "voice_tts provider=openai chars=%d voice=%s",\n'
    '            len(request.text),\n'
    '            openai_voice,\n',
)
replace_once(
    "backend/app/routers/tools.py",
    '    logger.info("voice_stt_token provider=assemblyai_v3 user=%s expires_in=%d", user_id, expires_in_seconds)\n',
    '    logger.info("voice_stt_token provider=assemblyai_v3 expires_in=%d", expires_in_seconds)\n',
)
replace_once(
    "backend/app/routers/tools.py",
    '    logger.info("github_trigger user=%s workflow=%s branch=%s", user_id, request.workflow, request.branch)\n',
    '    logger.info("github_trigger dispatched")\n',
)
replace_once(
    "backend/app/routers/tools.py",
    '        logger.info("n8n_execute user=%s workflow=%s id=%s", user_id, request.workflow_name, workflow_id)\n',
    '        logger.info("n8n_execute completed")\n',
)
replace_once(
    "backend/app/routers/tools.py",
    '        logger.exception("n8n_execute error: %s", exc)\n',
    '        logger.error("n8n_execute failed")\n',
)

replace_once(
    "backend/app/routers/voice_orchestration.py",
    '        logger.exception("Internal Hermes voice event recording failed event=%s id=%s", event_type, event_id)\n',
    '        logger.error("Internal Hermes voice event recording failed")\n',
)
replace_once(
    "backend/app/routers/voice_orchestration.py",
    '                logger.exception("Hermes task creation failed tool_call_id=%s", tool_call_id)\n',
    '                logger.error("Hermes task creation failed")\n',
)
replace_once(
    "backend/app/routers/voice_orchestration.py",
    '        logger.exception("Optional external Hermes voice relay failed event=%s id=%s", event_type, event_id)\n',
    '        logger.error("Optional external Hermes voice relay failed")\n',
)

print("Applied targeted Python CodeQL repairs.")
