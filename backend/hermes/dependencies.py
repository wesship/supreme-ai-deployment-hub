"""Composition root for Hermes orchestration dependencies."""

from __future__ import annotations

from dataclasses import dataclass

from backend.hermes.adapters import (
    EdgeFunctionAgentDispatcher,
    RepositoryEventSink,
    SupabaseTaskRepository,
)
from backend.hermes.infrastructure import (
    HermesDispatchClient,
    HermesInfrastructureConfig,
    SupabaseRestClient,
)
from backend.hermes.ports import AgentDispatcher, Clock, EventSink, SystemClock, TaskRepository


@dataclass(frozen=True, slots=True)
class HermesDependencies:
    repository: TaskRepository
    dispatcher: AgentDispatcher
    event_sink: EventSink
    clock: Clock


def build_default_dependencies() -> HermesDependencies:
    config = HermesInfrastructureConfig.from_env()
    repository = SupabaseTaskRepository(SupabaseRestClient(config))
    fallback_dispatcher = EdgeFunctionAgentDispatcher(HermesDispatchClient(config))
    from backend.ai_films.hermes_mastering_bridge import HermesMasteringDispatcher

    dispatcher = HermesMasteringDispatcher(repository, fallback_dispatcher)
    return HermesDependencies(
        repository=repository,
        dispatcher=dispatcher,
        event_sink=RepositoryEventSink(repository),
        clock=SystemClock(),
    )


_DEPENDENCIES = build_default_dependencies()


def get_dependencies() -> HermesDependencies:
    return _DEPENDENCIES


def configure_dependencies(dependencies: HermesDependencies) -> None:
    """Replace runtime dependencies, primarily for tests and alternate deployments."""
    global _DEPENDENCIES
    _DEPENDENCIES = dependencies


def reset_dependencies() -> None:
    """Restore environment-backed production adapters."""
    configure_dependencies(build_default_dependencies())
