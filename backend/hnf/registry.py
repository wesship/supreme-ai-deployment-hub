"""Allowlisted HNFPORTAL.one capabilities routed through Hermes."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class HNFWorkflow:
    name: str
    surface: str
    description: str
    requires_approval: bool = False
    default_priority: int = 5


@dataclass(frozen=True)
class HNFPersona:
    id: str
    type: str
    display_name: str
    skills: tuple[str, ...]
    policy_profile: str = "hnf-standard"


_WORKFLOWS = (
    HNFWorkflow("hnf.radio.dj.generate", "hnf-radio", "Generate a governed DJ break or station segment."),
    HNFWorkflow("hnf.radio.dj.speak", "hnf-radio", "Render approved DJ copy through the configured voice layer."),
    HNFWorkflow("hnf.radio.schedule", "hnf-radio", "Build or revise the HNF RADIO playout schedule."),
    HNFWorkflow("hnf.radio.intro.select", "hnf-radio", "Select a compatible station intro from the media registry."),
    HNFWorkflow("hnf.radio.broadcast.publish", "hnf-radio", "Publish a broadcast/planned playout change.", True, 7),
    HNFWorkflow("hnf.tv.schedule", "hnf-tv", "Build or revise HNF.TV channel scheduling."),
    HNFWorkflow("hnf.tv.playout.generate", "hnf-tv", "Generate a channel playout plan."),
    HNFWorkflow("hnf.tv.metadata.enrich", "hnf-tv", "Enrich title, episode, rights, and discovery metadata."),
    HNFWorkflow("hnf.tv.stream.health", "hnf-tv", "Check stream health and return structured diagnostics."),
    HNFWorkflow("hnf.tv.clip.create", "hnf-tv", "Create a governed clip-production task."),
    HNFWorkflow("hnf.academy.lesson.generate", "hnf-academy", "Generate a structured lesson."),
    HNFWorkflow("hnf.academy.instructor.spawn", "hnf-academy", "Instantiate an instructor persona for a learning session."),
    HNFWorkflow("hnf.academy.quiz.generate", "hnf-academy", "Generate a lesson-aligned quiz."),
    HNFWorkflow("hnf.academy.student.assist", "hnf-academy", "Provide a governed learning-assistant workflow."),
    HNFWorkflow("hnf.store.product.enrich", "hnf-store", "Generate product metadata and merchandising copy."),
    HNFWorkflow("hnf.store.mockup.generate", "hnf-store", "Create a product mockup production task."),
    HNFWorkflow("hnf.store.inventory.check", "hnf-store", "Check configured inventory/provider availability."),
    HNFWorkflow("hnf.store.order.assist", "hnf-store", "Assist with a commerce order without bypassing payment controls."),
    HNFWorkflow("hnf.lyrics.ingest", "hnf-lyrics", "Ingest lyric-library source material with provenance."),
    HNFWorkflow("hnf.lyrics.annotate", "hnf-lyrics", "Generate structured annotations for lyric-library content."),
    HNFWorkflow("hnf.lyrics.qr.generate", "hnf-lyrics", "Create a QR destination/asset task."),
    HNFWorkflow("hnf.media.transcode", "hnf-media", "Create a media-transcoding task."),
    HNFWorkflow("hnf.media.caption", "hnf-media", "Generate captions/subtitles for an HNF media asset."),
    HNFWorkflow("hnf.media.thumbnail", "hnf-media", "Generate thumbnail-production instructions/assets."),
    HNFWorkflow("hnf.media.archive", "hnf-media", "Archive media with provenance and retention metadata."),
    HNFWorkflow("hnf.creator.package", "hnf-creator", "Assemble a creator publishing package."),
    HNFWorkflow("hnf.support.answer", "hnf-support", "Generate a support response grounded in HNF knowledge."),
    HNFWorkflow("hnf.support.ticket", "hnf-support", "Create or enrich a support ticket."),
    HNFWorkflow("hnf.support.escalate", "hnf-support", "Escalate a support case for human review.", True, 8),
    HNFWorkflow("hnf.marketing.campaign.generate", "hnf-marketing", "Generate a campaign plan and assets."),
    HNFWorkflow("hnf.analytics.report", "hnf-analytics", "Generate a cross-surface HNF analytics report."),
    HNFWorkflow("hnf.admin.operation", "hnf-admin", "Run an explicitly approved administrative workflow.", True, 9),
)

WORKFLOWS = {workflow.name: workflow for workflow in _WORKFLOWS}

_PERSONAS = (
    HNFPersona("hnf-dj-001", "radio_dj", "DJ HNF", ("radio-hosting", "music-context", "station-promos", "voice-generation")),
    HNFPersona("hnf-teacher-001", "teacher", "HNF Teacher", ("instruction", "lesson-planning", "assessment")),
    HNFPersona("hnf-instructor-001", "instructor", "HNF Instructor", ("instruction", "demonstration", "coaching")),
    HNFPersona("hnf-tv-host-001", "tv_host", "HNF.TV Host", ("presenting", "interviewing", "program-context")),
    HNFPersona("hnf-chef-001", "chef", "HNF Chef", ("cooking-instruction", "recipe-formatting", "kitchen-safety")),
    HNFPersona("hnf-support-001", "support", "HNF Support", ("customer-support", "knowledge-retrieval", "escalation")),
)

PERSONAS = {persona.id: persona for persona in _PERSONAS}


def get_workflow(name: str) -> HNFWorkflow:
    key = name.strip().lower()
    if key not in WORKFLOWS:
        raise KeyError(f"unknown HNF workflow: {name}")
    return WORKFLOWS[key]


def list_capabilities() -> dict[str, object]:
    return {
        "workflows": [
            {
                "name": item.name,
                "surface": item.surface,
                "description": item.description,
                "requires_approval": item.requires_approval,
                "default_priority": item.default_priority,
            }
            for item in _WORKFLOWS
        ],
        "personas": [
            {
                "id": item.id,
                "type": item.type,
                "display_name": item.display_name,
                "skills": list(item.skills),
                "policy_profile": item.policy_profile,
            }
            for item in _PERSONAS
        ],
    }
