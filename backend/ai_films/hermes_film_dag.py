from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field, model_validator
from backend.ai_films.film_node_contracts import FilmNode, ImagePipelineSpec


class HermesFilmDAG(BaseModel):
    schema: str = "d3vonn.ai-films.hermes-dag/v1"
    project_id: str
    shot_id: str
    nodes: list[FilmNode] = Field(..., min_length=1, max_length=100)
    image_pipeline: ImagePipelineSpec = Field(default_factory=ImagePipelineSpec)
    metadata: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def validate_dependencies(self):
        ids = {node.node_id for node in self.nodes}
        if len(ids) != len(self.nodes):
            raise ValueError("duplicate film node id")

        graph: dict[str, list[str]] = {}
        for node in self.nodes:
            if node.node_id in node.depends_on:
                raise ValueError("film node cannot depend on itself")
            if any(dep not in ids for dep in node.depends_on):
                raise ValueError("unknown film node dependency")
            graph[node.node_id] = list(node.depends_on)

        visiting: set[str] = set()
        visited: set[str] = set()

        def visit(node_id: str) -> None:
            if node_id in visiting:
                raise ValueError("film node dependency cycle")
            if node_id in visited:
                return
            visiting.add(node_id)
            for dependency in graph[node_id]:
                visit(dependency)
            visiting.remove(node_id)
            visited.add(node_id)

        for node_id in graph:
            visit(node_id)
        return self
