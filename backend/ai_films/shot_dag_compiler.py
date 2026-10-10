from __future__ import annotations

from typing import Mapping

from backend.ai_films.film_node_contracts import FilmNode, ImagePipelineSpec
from backend.ai_films.generation_dispatcher_impl import dispatch_plan
from backend.ai_films.hermes_film_dag import HermesFilmDAG
from backend.ai_films.production_bible import ProductionBible, ShotManifestItem


def compile_shot_dag(
    shot: ShotManifestItem,
    bible: ProductionBible,
    *,
    image_pipeline: ImagePipelineSpec | None = None,
    environ: Mapping[str, str] | None = None,
) -> HermesFilmDAG:
    pipeline = image_pipeline or ImagePipelineSpec()
    route = dispatch_plan(shot, bible, conform_decision="generate", environ=environ)
    selected_provider = route.get("selected_provider")
    generation_state = "queued" if route.get("action") == "queue" else "blocked"

    def make_node(suffix, kind, task_type, depends_on, **kwargs):
        return FilmNode(
            node_id=f"{shot.shot_id}:{suffix}",
            shot_id=shot.shot_id,
            kind=kind,
            task_type=task_type,
            depends_on=depends_on,
            **kwargs,
        )

    generate = make_node(
        "generate",
        "generation",
        "generate_shot",
        [],
        state=generation_state,
        requires_gpu=True,
        provider=selected_provider,
        inputs={
            "generation_packet": route.get("generation_packet"),
            "selected_model": route.get("selected_model"),
            "route_reason": route.get("reason"),
            "routes": route.get("routes", []),
        },
    )
    continuity = make_node("continuity-qc", "qc", "continuity_qc", [generate.node_id])
    color = make_node(
        "color",
        "color_conform",
        "ocio_aces_conform",
        [continuity.node_id],
        inputs={"image_pipeline": pipeline.model_dump(mode="json")},
    )
    composite = make_node("composite", "composite", "composite_passes", [color.node_id], requires_gpu=True)
    upscale = make_node(
        "upscale",
        "upscale",
        "neural_upscale",
        [composite.node_id],
        requires_gpu=True,
        inputs={
            "upscale_policy": pipeline.upscale_policy,
            "delivery_resolution": pipeline.delivery_resolution.model_dump(mode="json"),
        },
    )
    edit = make_node("edit", "editorial", "otio_conform", [upscale.node_id])
    master = make_node(
        "master",
        "mastering",
        "master_delivery",
        [edit.node_id],
        inputs={
            "display_target": pipeline.display_target,
            "hdr": pipeline.hdr,
            "master_container": pipeline.master_container,
        },
    )
    final_qc = make_node("final-qc", "qc", "master_qc", [master.node_id])

    return HermesFilmDAG(
        project_id=bible.project_id,
        shot_id=shot.shot_id,
        nodes=[generate, continuity, color, composite, upscale, edit, master, final_qc],
        image_pipeline=pipeline,
        metadata={
            "bible_version": bible.version,
            "sequence_id": shot.sequence_id,
            "scene_id": shot.scene_id,
            "provider_dispatch_action": route.get("action"),
            "provider_dispatch_reason": route.get("reason"),
        },
    )
