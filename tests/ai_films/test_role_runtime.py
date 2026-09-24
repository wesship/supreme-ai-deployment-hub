"""Role runtime rejects invalid, revoked and unapproved profiles before a session starts."""
import asyncio
import unittest

from backend.ai_films.role_runtime import RoleProfileUnavailable, load_published_role, profile_hash

PROJECT = "fa6b7a0a-c3a8-4df5-bae3-079d03e64b0e"


class Store:
    def __init__(self, rows):
        self.rows = rows
        self.params = None

    async def _request(self, method, table, *, params):
        assert (method, table) == ("GET", "ai_film_role_releases")
        self.params = params
        return self.rows


def profile(role="teacher"):
    return {"avatar_version": "avatar-v1", "voice_version": "voice-v1", "introduction": "Welcome",
            "sources": ["lesson:approved"], "tools": ["cleared_catalog"] if role == "radio_dj" else ["lesson_search"],
            "memory_scope": "session", "handoff": "Ask a human"}


def run(store, role="teacher"):
    return asyncio.run(load_published_role(store, PROJECT, role))


class RoleRuntimeTests(unittest.TestCase):
    def test_loads_and_pins_valid_profile(self):
        p = profile()
        store = Store([{"version": 2, "profile": p, "profile_hash": profile_hash(p)}])
        self.assertEqual(run(store)["version"], 2)
        self.assertEqual(store.params["revoked_at"], "is.null")
        self.assertEqual(store.params["order"], "version.desc")

    def test_rejects_missing_or_tampered(self):
        cases = [[], [{"version": 1, "profile": profile(), "profile_hash": "0" * 64}],
                 [{"version": True, "profile": profile(), "profile_hash": profile_hash(profile())}]]
        for rows in cases:
            with self.subTest(rows=rows), self.assertRaises(RoleProfileUnavailable):
                run(Store(rows))

    def test_rejects_tool_crossing_and_locked_role(self):
        p = profile(); p["tools"] = ["cleared_catalog"]
        with self.assertRaises(RoleProfileUnavailable):
            run(Store([{"version": 1, "profile": p, "profile_hash": profile_hash(p)}]))
        with self.assertRaises(RoleProfileUnavailable):
            run(Store([]), "mental_health")


if __name__ == "__main__":
    unittest.main()
