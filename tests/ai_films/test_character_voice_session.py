"""Character preview sessions pin a released identity and cannot outlive ten minutes."""
import base64
import json
import os
import unittest
from unittest.mock import patch

from backend.app.voice_session import issue_voice_session, verify_voice_session

BINDING = {
    "project_id": "fa6b7a0a-c3a8-4df5-bae3-079d03e64b0e",
    "character_id": "b8c29442-1e7e-426a-b5e6-2d55bbcfb39d",
    "role_id": "teacher",
    "version": 2,
    "profile_hash": "a" * 64,
}


class CharacterVoiceSessionTests(unittest.TestCase):
    def setUp(self):
        env = patch.dict(os.environ, {"VOICE_SESSION_SIGNING_SECRET": "local-test-only-character-voice-secret"})
        env.start()
        self.addCleanup(env.stop)

    def test_character_binding_and_ten_minute_lifetime(self):
        token, expires = issue_voice_session("owner-id", ttl_seconds=7200, character_binding=BINDING)
        claims = verify_voice_session(token)
        self.assertEqual(claims["scope"], "character-preview")
        self.assertEqual(claims["character"], BINDING)
        self.assertEqual(expires - claims["iat"], 600)

    def test_rejects_invalid_identity_and_unsigned_edits(self):
        with self.assertRaises(ValueError):
            issue_voice_session("owner-id", character_binding={**BINDING, "role_id": "mental_health"})
        with self.assertRaises(ValueError):
            issue_voice_session("owner-id", character_binding={**BINDING, "character_id": "other"})
        token, _ = issue_voice_session("owner-id", character_binding=BINDING)
        body, signature = token.split(".")
        claims = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        claims["character"]["version"] = 3
        forged = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode() + "." + signature
        self.assertIsNone(verify_voice_session(forged))

    def test_general_voice_session_has_no_character_scope(self):
        token, _ = issue_voice_session("owner-id")
        claims = verify_voice_session(token)
        self.assertNotIn("character", claims)
        self.assertNotIn("scope", claims)


if __name__ == "__main__":
    unittest.main()
