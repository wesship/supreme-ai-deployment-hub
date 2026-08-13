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
        for node in self.nodes:
            if any(dep not in ids for dep in node.depends_on):
                raise ValueError("unknown film node dependency")
        return self
