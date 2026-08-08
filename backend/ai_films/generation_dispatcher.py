"""Compatibility export for the multimodel AI Films generation dispatcher."""
from backend.ai_films.generation_dispatcher_impl import VideoRoute, dispatch_plan, rank_video_routes

__all__ = ["VideoRoute", "dispatch_plan", "rank_video_routes"]
