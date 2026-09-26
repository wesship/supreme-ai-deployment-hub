import asyncio
import os
import unittest
from unittest.mock import patch

from backend.ai_films.role_authoring import RoleAuthoring
from backend.ai_films.role_policy_attestation import InvalidAttestation, issue_policy_attestation
from backend.ai_films.role_runtime import RoleProfileUnavailable, profile_hash

PROJECT = "fa6b7a0a-c3a8-4df5-bae3-079d03e64b0e"
PROFILE = {"avatar_version": "avatar-v1", "voice_version": "voice-v1", "introduction": "Welcome",
           "sources": ["lesson:approved"], "tools": ["lesson_search"],
           "memory_scope": "session", "handoff": "Ask a human"}


class Store:
    def __init__(self, row):
        self.row = row
        self.calls = []

    async def _request(self, method, table, *, params):
        self.calls.append(("read", method, table, params))
        return [self.row] if self.row else []

    async def role_rpc(self, payload):
        self.calls.append(("rpc", payload))
        return {"status": payload["p_action"]}


class RoleAuthoringTests(unittest.TestCase):
    def setUp(self):
        self.patch = patch.dict(os.environ, {"AI_FILMS_ROLE_ATTESTATION_SECRET": "only-for-local-tests-please-do-not-use-in-production"})
        self.patch.start(); self.addCleanup(self.patch.stop)

    def test_save_sends_validated_canonical_hash_and_expected_revision(self):
        store = Store(None)
        asyncio.run(RoleAuthoring(store).save(PROJECT, "teacher", "editor-id", 0, PROFILE))
        payload = store.calls[0][1]
        self.assertEqual(payload["p_profile_hash"], profile_hash(PROFILE))
        self.assertEqual(payload["p_expected_revision"], 0)
        with self.assertRaises(RoleProfileUnavailable):
            asyncio.run(RoleAuthoring(store).save(PROJECT, "teacher", "editor-id", 0,
                                                  {**PROFILE, "tools": ["cleared_catalog"]}))
        self.assertEqual(len(store.calls), 1)

    def test_test_requires_exact_saved_draft_and_attestation(self):
        token = issue_policy_attestation(PROJECT, "teacher", 2, PROFILE)
        row = {"revision": 2, "profile": PROFILE, "profile_hash": profile_hash(PROFILE), "status": "draft"}
        store = Store(row)
        asyncio.run(RoleAuthoring(store).mark_tested(PROJECT, "teacher", "editor-id", 2, token))
        self.assertEqual(store.calls[-1][1]["p_profile_hash"], profile_hash(PROFILE))
        self.assertEqual(store.calls[-1][1]["p_action"], "test")
        altered = Store({**row, "profile": {**PROFILE, "voice_version": "voice-v2"}})
        with self.assertRaises(RoleProfileUnavailable):
            asyncio.run(RoleAuthoring(altered).mark_tested(PROJECT, "teacher", "editor-id", 2, token))
        self.assertFalse(any(c[0] == "rpc" for c in altered.calls))
        stale = Store({**row, "revision": 3})
        with self.assertRaises(RoleProfileUnavailable):
            asyncio.run(RoleAuthoring(stale).mark_tested(PROJECT, "teacher", "editor-id", 2, token))
        with self.assertRaises(InvalidAttestation):
            asyncio.run(RoleAuthoring(Store(row)).mark_tested("different", "teacher", "editor-id", 2, token))

    def test_character_drafts_use_independent_storage_and_policy(self):
        first = "b8c29442-1e7e-426a-b5e6-2d55bbcfb39d"
        second = "0e0b77be-f840-46d1-a68e-781d489528c8"
        saved = Store(None)
        asyncio.run(RoleAuthoring(saved).save(PROJECT, "teacher", "editor-id", 0, PROFILE, character_id=first))
        self.assertEqual(saved.calls[0][1]["p_character_id"], first)
        row = {"revision": 1, "profile": PROFILE, "profile_hash": profile_hash(PROFILE), "status": "draft"}
        token = issue_policy_attestation(PROJECT, "teacher", 1, PROFILE, character_id=first)
        store = Store(row)
        asyncio.run(RoleAuthoring(store).mark_tested(PROJECT, "teacher", "editor-id", 1, token,
                                                     character_id=first))
        self.assertEqual(store.calls[0][2], "ai_film_character_role_drafts")
        self.assertEqual(store.calls[0][3]["character_id"], f"eq.{first}")
        self.assertEqual(store.calls[-1][1]["p_character_id"], first)
        different = Store(row)
        with self.assertRaises(InvalidAttestation):
            asyncio.run(RoleAuthoring(different).mark_tested(PROJECT, "teacher", "editor-id", 1, token,
                                                              character_id=second))
        self.assertFalse(any(call[0] == "rpc" for call in different.calls))


if __name__ == "__main__":
    unittest.main()
