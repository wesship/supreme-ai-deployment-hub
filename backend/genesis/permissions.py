"""Role-based authorization policy for governed Genesis project actions."""
from __future__ import annotations

CANON_PROPOSE_ROLES = frozenset({"owner", "executive_producer", "director", "writer"})
CANON_LOCK_ROLES = frozenset({"owner", "executive_producer", "director"})
PLANNING_ROLES = frozenset({"owner", "executive_producer", "director", "developer"})
TASK_MUTATION_ROLES = frozenset({"owner", "executive_producer", "director", "developer"})
RENDER_REQUEST_ROLES = frozenset(
    {"owner", "executive_producer", "director", "visual_director", "audio_director"}
)
APPROVAL_DECISION_ROLES = frozenset({"owner", "executive_producer"})
EVALUATION_ROLES = frozenset({"owner", "executive_producer", "director", "reviewer", "developer"})
