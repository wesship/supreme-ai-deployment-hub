"""Canonical Production Bible + Shot Manifest contracts for D3VONN.IO AI Films."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class CanonRule(BaseModel):
    key: str = Field(..., min_length=1, max_length=120)
    value: Any
    immutable: bool = True
    scope: Literal["universe", "project", "character", "location", "sound", "event", "shot"] = "project"
    notes: str | None = Field(default=None, max_length=2000)


class CharacterLock(BaseModel):
    character_id: str = Field(..., min_length=1, max_length=120)
    name: str = Field(..., min_length=1, max_length=160)
    role: str | None = Field(default=None, max_length=240)
    visual_identity: dict[str, Any] = Field(default_factory=dict)
    wardrobe_lock: dict[str, Any] = Field(default_factory=dict)
    voice: dict[str, Any] = Field(default_factory=dict)
    performance: dict[str, Any] = Field(default_factory=dict)
    anchor_asset_ids: list[str] = Field(default_factory=list, max_length=50)
    forbidden_changes: list[str] = Field(default_factory=list, max_length=100)


class LocationLock(BaseModel):
    location_id: str = Field(..., min_length=1, max_length=120)
    name: str = Field(..., min_length=1, max_length=200)
    visual_language: dict[str, Any] = Field(default_factory=dict)
    anchor_asset_ids: list[str] = Field(default_factory=list, max_length=50)
    continuity_rules: list[str] = Field(default_factory=list, max_length=100)


class SoundRule(BaseModel):
    sound_id: str = Field(..., min_length=1, max_length=120)
    name: str = Field(..., min_length=1, max_length=200)
    frequency_hz: float | None = Field(default=None, ge=0, le=40000)
    mode: str | None = Field(default=None, max_length=120)
    rules: dict[str, Any] = Field(default_factory=dict)


class ProductionBible(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=100)
    universe: str = Field(..., min_length=1, max_length=200)
    title: str = Field(..., min_length=1, max_length=240)
    version: int = Field(default=1, ge=1)
    canon_rules: list[CanonRule] = Field(default_factory=list, max_length=1000)
    characters: list[CharacterLock] = Field(default_factory=list, max_length=200)
    locations: list[LocationLock] = Field(default_factory=list, max_length=300)
    props: list[dict[str, Any]] = Field(default_factory=list, max_length=500)
    cinematography: dict[str, Any] = Field(default_factory=dict)
    sound_rules: list[SoundRule] = Field(default_factory=list, max_length=300)
    events: list[dict[str, Any]] = Field(default_factory=list, max_length=500)
    generation_policy: dict[str, Any] = Field(default_factory=dict)
    distribution_policy: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ShotAudioSpec(BaseModel):
    dialogue: str | None = Field(default=None, max_length=8000)
    voice_id: str | None = Field(default=None, max_length=200)
    music_cue: str | None = Field(default=None, max_length=500)
    sfx: list[str] = Field(default_factory=list, max_length=100)
    frequency_hz: float | None = Field(default=None, ge=0, le=40000)


class ShotManifestItem(BaseModel):
    shot_id: str = Field(..., min_length=1, max_length=120)
    sequence_id: str = Field(..., min_length=1, max_length=120)
    scene_id: str = Field(..., min_length=1, max_length=120)
    order: int = Field(..., ge=1)
    purpose: str = Field(..., min_length=1, max_length=1000)
    duration_target_seconds: float = Field(..., gt=0, le=600)
    characters: list[str] = Field(default_factory=list, max_length=50)
    location_id: str | None = Field(default=None, max_length=120)
    wardrobe_state: dict[str, Any] = Field(default_factory=dict)
    props: list[str] = Field(default_factory=list, max_length=100)
    action: str = Field(..., min_length=1, max_length=4000)
    camera: dict[str, Any] = Field(default_factory=dict)
    lighting: dict[str, Any] = Field(default_factory=dict)
    visual_effects: dict[str, Any] = Field(default_factory=dict)
    anchor_frame_asset_ids: list[str] = Field(default_factory=list, max_length=50)
    start_frame_prompt: str | None = Field(default=None, max_length=8000)
    generation_prompt: str = Field(..., min_length=1, max_length=12000)
    negative_prompt: str | None = Field(default=None, max_length=4000)
    preferred_providers: list[str] = Field(default_factory=list, max_length=20)
    audio: ShotAudioSpec = Field(default_factory=ShotAudioSpec)
    continuity_locks: list[str] = Field(default_factory=list, max_length=200)
    canon_refs: list[str] = Field(default_factory=list, max_length=200)
    source_asset_ids: list[str] = Field(default_factory=list, max_length=100)
    generated_asset_ids: list[str] = Field(default_factory=list, max_length=100)
    qa_state: Literal["planned", "generated", "analyzed", "pass", "revise", "block"] = "planned"
    qa_notes: list[str] = Field(default_factory=list, max_length=200)


class ShotManifest(BaseModel):
    project_id: str = Field(..., min_length=1, max_length=100)
    bible_version: int = Field(..., ge=1)
    manifest_version: int = Field(default=1, ge=1)
    title: str = Field(..., min_length=1, max_length=240)
    structure: Literal["feature", "episode", "trailer", "teaser", "sequence", "scene"] = "feature"
    shots: list[ShotManifestItem] = Field(..., min_length=1, max_length=5000)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_unique_ids(self):
        ids = [shot.shot_id for shot in self.shots]
        if len(ids) != len(set(ids)):
            raise ValueError("shot_id values must be unique within a manifest")
        return self


SOVEREIGN_SIGNAL_SEED = ProductionBible(
    project_id="b2979e7c-1d28-4024-bf4f-8db90c174d5a",
    universe="Genesis / Sovereign Signal",
    title="The Sovereign Signal",
    version=1,
    canon_rules=[
        CanonRule(key="legend.wardrobe", value="white T-shirt only; no logos/colors/evolution", scope="character"),
        CanonRule(key="legend.camera", value="centered, clean framing", scope="character"),
        CanonRule(key="nana.visual", value="matriarch anchor; white garments; altar/candles", scope="character"),
        CanonRule(key="instance_event", value="SS-IE-J/L-001", scope="event"),
        CanonRule(key="frequency.autonomy", value=128, scope="sound"),
        CanonRule(key="frequency.discernment", value=256, scope="sound"),
        CanonRule(key="frequency.creative_authority", value=432, scope="sound"),
        CanonRule(key="genesis_mode", value="master sonic DNA", scope="sound"),
    ],
    characters=[
        CharacterLock(character_id="legend", name="Legend", role="Signal Carrier", wardrobe_lock={"top":"white T-shirt only","logos":False,"color_changes":False}, performance={"camera":"centered/clean"}),
        CharacterLock(character_id="nana", name="Nana", role="Matriarch Anchor", wardrobe_lock={"palette":"white garments"}, visual_identity={"altar":True,"candles":True}),
        CharacterLock(character_id="jahid", name="Jahid", role="Grounded counterpart"),
        CharacterLock(character_id="bisa_fuse", name="Bisa Fuse", role="FBI agent"),
        CharacterLock(character_id="detective_smith", name="Detective Smith", role="Detective"),
    ],
    sound_rules=[
        SoundRule(sound_id="autonomy", name="Autonomy", frequency_hz=128),
        SoundRule(sound_id="discernment", name="Discernment", frequency_hz=256),
        SoundRule(sound_id="creative_authority", name="Creative Authority", frequency_hz=432),
    ],
    events=[{"event_id":"SS-IE-J/L-001","immutable":True,"rule":"ritual fails; no second rescue; no physical defeat"}],
    generation_policy={"multimodel":True,"providers":["sora","higgsfield","grok","movieflow","replicate"],"require_anchor_frames":True},
)
