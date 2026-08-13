"""Adapt AI Films DAGs to Hermes durable workflows."""
from __future__ import annotations

from backend.ai_films.hermes_film_dag import HermesFilmDAG
from backend.hermes.workflows.models import RetryPolicy, WorkflowDefinition, WorkflowStepDefinition

_AGENT_BY_KIND = {
    "generation": "ai-films-generation",
    "qc": "ai-films-qc",
    "color_conform": "ai-films-color",
    "composite": "ai-films-composite",
    "upscale": "ai-films-upscale",
    "editorial": "ai-films-editorial",
    "mastering": "ai-films-mastering",
}


def film_dag_to_workflow(dag: HermesFilmDAG) -> WorkflowDefinition:
    steps = tuple(
        WorkflowStepDefinition(
            id=node.node_id.replace(":", "."),
            agent=node.provider or _AGENT_BY_KIND.get(node.kind, "ai-films-worker"),
            depends_on=tuple(dep.replace(":", ".") for dep in node.depends_on),
            input={
                "film_node": node.model_dump(mode="json"),
                "project_id": dag.project_id,
                "shot_id": dag.shot_id,
                "image_pipeline": dag.image_pipeline.model_dump(mode="json"),
            },
            retry=RetryPolicy(max_attempts=3, backoff_seconds=5.0),
        )
        for node in dag.nodes
    )
    return WorkflowDefinition(
        id=f"ai-films.{dag.shot_id}".replace(":", "."),
        version="1.0.0",
        steps=steps,
        metadata={
            "source": "ai_films",
            "film_schema": dag.schema,
            "project_id": dag.project_id,
            "shot_id": dag.shot_id,
            **dag.metadata,
        },
    )
