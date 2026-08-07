"""AI Director / Movie Assembly planning for D3VONN.IO AI Films."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from backend.ai_films.twelvelabs import TwelveLabsClient, TwelveLabsError

DIRECTOR_INSTRUCTIONS = (
    "You are the D3VONN.IO AI Director and senior film editor. Ground editorial decisions "
    "in the configured corpus. Preserve character identity, wardrobe, location, screen "
    "direction, emotional state, dialogue causality, chronology, and canon. Prefer coherent "
    "dramatic escalation over flashy unrelated shots. Return only valid JSON."
)

@dataclass(frozen=True)
class ClipSpec:
    asset_id: str
    label: str
    duration_seconds: float
    source_in: float = 0.0
    source_out: float | None = None
    summary: str | None = None
    characters: tuple[str, ...] = ()
    dialogue: str | None = None
    tags: tuple[str, ...] = ()

    @property
    def effective_out(self) -> float:
        return self.source_out if self.source_out is not None else self.duration_seconds


def _extract_text(response: dict[str, Any]) -> str:
    for key in ("output_text", "text", "response", "content"):
        value = response.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    output = response.get("output")
    if isinstance(output, list):
        chunks: list[str] = []
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content")
            if isinstance(content, str):
                chunks.append(content)
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict):
                        value = part.get("text") or part.get("content")
                        if isinstance(value, str):
                            chunks.append(value)
        return "\n".join(chunks).strip()
    return ""


def _parse_json(text: str) -> dict[str, Any] | None:
    if not text:
        return None
    fenced = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    candidate = fenced.group(1) if fenced else text[text.find("{"):text.rfind("}") + 1]
    try:
        payload = json.loads(candidate)
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def fallback_plan(clips: list[ClipSpec], title: str) -> dict[str, Any]:
    return {
        "title": title,
        "editorial_intent": "Conservative source-order assembly.",
        "sequence": [
            {
                "asset_id": c.asset_id,
                "source_in": c.source_in,
                "source_out": c.effective_out,
                "transition_in": "cut",
                "transition_out": "cut",
                "reason": "Preserve supplied source order.",
            }
            for c in clips if c.effective_out > c.source_in
        ],
        "continuity_flags": [],
        "missing_shots": [],
        "audio_cues": [],
        "fallback": True,
    }


async def build_director_plan(
    clips: list[ClipSpec], *, title: str, target_runtime_seconds: float | None = None,
    tone: str | None = None, structure: str = "narrative"
) -> tuple[dict[str, Any], dict[str, Any]]:
    manifest = [
        {
            "asset_id": c.asset_id, "label": c.label,
            "duration_seconds": c.duration_seconds, "source_in": c.source_in,
            "source_out": c.effective_out, "summary": c.summary,
            "characters": list(c.characters), "dialogue": c.dialogue, "tags": list(c.tags),
        } for c in clips
    ]
    prompt = {
        "task": "Create a coherent movie assembly edit decision plan.",
        "title": title, "structure": structure, "tone": tone,
        "target_runtime_seconds": target_runtime_seconds, "clips": manifest,
        "required_schema": {
            "title": "string", "editorial_intent": "string",
            "sequence": [{"asset_id":"supplied id","source_in":0,"source_out":1,
                "transition_in":"cut|dissolve|fade|match_cut|audio_pre_lap|audio_post_lap",
                "transition_out":"same enum","reason":"string"}],
            "continuity_flags":["string"], "missing_shots":["string"],
            "audio_cues":[{"at_asset_id":"id","type":"dialogue|music|sfx|ambience|silence","instruction":"string"}],
        },
        "rules": ["Use only supplied asset_ids.", "Do not exceed supplied source ranges.",
                  "Avoid duplicate shots unless justified.", "Flag continuity conflicts.",
                  "Use missing_shots for coverage needed to make the edit intelligible."],
    }
    try:
        raw = await TwelveLabsClient().reason(json.dumps(prompt, separators=(",", ":")), instructions=DIRECTOR_INSTRUCTIONS)
    except TwelveLabsError:
        return fallback_plan(clips, title), {"status":"fallback","reason":"jockey_error"}
    parsed = _parse_json(_extract_text(raw))
    if not parsed:
        return fallback_plan(clips, title), {"status":"fallback","reason":"unparseable_jockey_response","response_id":raw.get("id") or raw.get("_id")}
    return parsed, {"status":"jockey","response_id":raw.get("id") or raw.get("_id")}


def normalize_timeline(plan: dict[str, Any], clips: list[ClipSpec]) -> list[dict[str, Any]]:
    by_id = {c.asset_id: c for c in clips}
    sequence = plan.get("sequence") if isinstance(plan.get("sequence"), list) else []
    out: list[dict[str, Any]] = []
    cursor = 0.0
    used: set[str] = set()
    for item in sequence:
        if not isinstance(item, dict): continue
        asset_id = str(item.get("asset_id") or "")
        clip = by_id.get(asset_id)
        if not clip or asset_id in used: continue
        try:
            source_in = max(clip.source_in, float(item.get("source_in", clip.source_in)))
            source_out = min(clip.effective_out, float(item.get("source_out", clip.effective_out)))
        except Exception:
            source_in, source_out = clip.source_in, clip.effective_out
        if source_out <= source_in: continue
        dur = source_out - source_in
        out.append({"order":len(out)+1,"asset_id":asset_id,"label":clip.label,
            "source_in":round(source_in,3),"source_out":round(source_out,3),
            "record_in":round(cursor,3),"record_out":round(cursor+dur,3),"duration":round(dur,3),
            "transition_in":item.get("transition_in") or "cut","transition_out":item.get("transition_out") or "cut",
            "reason":item.get("reason") or ""})
        cursor += dur
        used.add(asset_id)
    return out or normalize_timeline(fallback_plan(clips, "Fallback"), clips)


def _tc(seconds: float, fps: int = 24) -> str:
    frames = max(0, round(seconds * fps)); ff = frames % fps; total = frames // fps
    return f"{total//3600:02d}:{(total//60)%60:02d}:{total%60:02d}:{ff:02d}"


def generate_cmx_edl(timeline: list[dict[str, Any]], title: str, fps: int = 24) -> str:
    lines = [f"TITLE: {title}", "FCM: NON-DROP FRAME", ""]
    for n, item in enumerate(timeline, start=1):
        reel = f"A{n:05d}"[-6:]
        lines += [
            f"{n:03d}  {reel:<8} V     C        {_tc(float(item['source_in']),fps)} {_tc(float(item['source_out']),fps)} {_tc(float(item['record_in']),fps)} {_tc(float(item['record_out']),fps)}",
            f"* FROM CLIP NAME: {item['label']}",
            f"* D3VONN ASSET ID: {item['asset_id']}", ""
        ]
    return "\n".join(lines).rstrip() + "\n"
