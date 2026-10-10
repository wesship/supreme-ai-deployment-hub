"""Compatibility export for the multimodel AI Films generation dispatcher."""
from backend.ai_films.generation_dispatcher_impl import (
    VideoRoute,
    dispatch_plan,
    rank_video_routes,
    route_snapshot,
)

__all__ = ["VideoRoute", "dispatch_plan", "rank_video_routes", "route_snapshot"]
