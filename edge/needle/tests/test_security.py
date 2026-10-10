import unittest

from edge.needle.security import sign_request, verify_request


class DeviceSecurityTests(unittest.TestCase):
    def setUp(self):
        self.secret = b"test-device-secret"
        self.payload = {"query": "take a picture"}
        self.device_id = "glasses-dev-01"
        self.timestamp = 1_800_000_000
        self.nonce = "nonce-1"
        self.seen = set()

    def _nonce_seen(self, device_id, nonce):
        return (device_id, nonce) in self.seen

    def _mark_nonce(self, device_id, nonce, timestamp):
        self.seen.add((device_id, nonce))

    def test_valid_signed_request(self):
        sig = sign_request(self.secret, self.device_id, self.timestamp, self.nonce, self.payload)
        verified = verify_request(
            secret=self.secret,
            device_id=self.device_id,
            timestamp=self.timestamp,
            nonce=self.nonce,
            payload=self.payload,
            signature=sig,
            nonce_seen=self._nonce_seen,
            mark_nonce=self._mark_nonce,
            now=self.timestamp,
        )
        self.assertEqual(verified.device_id, self.device_id)

    def test_replay_is_rejected(self):
        sig = sign_request(self.secret, self.device_id, self.timestamp, self.nonce, self.payload)
        kwargs = dict(secret=self.secret, device_id=self.device_id, timestamp=self.timestamp,
                      nonce=self.nonce, payload=self.payload, signature=sig,
                      nonce_seen=self._nonce_seen, mark_nonce=self._mark_nonce, now=self.timestamp)
        verify_request(**kwargs)
        with self.assertRaisesRegex(PermissionError, "replayed_device_request"):
            verify_request(**kwargs)

    def test_tamper_and_stale_requests_are_rejected(self):
        sig = sign_request(self.secret, self.device_id, self.timestamp, self.nonce, self.payload)
        with self.assertRaisesRegex(PermissionError, "invalid_device_signature"):
            verify_request(secret=self.secret, device_id=self.device_id, timestamp=self.timestamp,
                           nonce=self.nonce, payload={"query": "different"}, signature=sig,
                           nonce_seen=self._nonce_seen, mark_nonce=self._mark_nonce, now=self.timestamp)
        with self.assertRaisesRegex(PermissionError, "stale_device_request"):
            verify_request(secret=self.secret, device_id=self.device_id, timestamp=self.timestamp,
                           nonce="nonce-2", payload=self.payload, signature=sig,
                           nonce_seen=self._nonce_seen, mark_nonce=self._mark_nonce, now=self.timestamp + 61)


if __name__ == "__main__":
    unittest.main()
