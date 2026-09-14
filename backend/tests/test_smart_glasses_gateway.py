import pytest

from backend.app.services.smart_glasses_gateway import authorize_request


class Registry:
    def __init__(self, active=True): self.active = active
    async def is_active(self, device_id): return self.active


class Nonces:
    def __init__(self): self.seen = set()
    async def reserve(self, device_id, nonce, ttl_seconds):
        key = (device_id, nonce)
        if key in self.seen: return False
        self.seen.add(key); return True


class Switch:
    def __init__(self, on=False): self.on = on
    async def enabled(self): return self.on


@pytest.mark.asyncio
async def test_low_risk_route_is_approved_once():
    nonces = Nonces()
    proposal = {"route": "local", "call": {"name": "capture_photo", "arguments": {}}}
    result = await authorize_request(device_id="g1", nonce="n1", correlation_id="c1", proposal=proposal,
                                     nonce_store=nonces, device_registry=Registry(), kill_switch=Switch())
    assert result.route == "approved_route"
    replay = await authorize_request(device_id="g1", nonce="n1", correlation_id="c2", proposal=proposal,
                                     nonce_store=nonces, device_registry=Registry(), kill_switch=Switch())
    assert replay.route == "deny" and replay.reason == "replay_detected"


@pytest.mark.asyncio
async def test_privileged_action_requires_guardian():
    result = await authorize_request(
        device_id="g1", nonce="n2", correlation_id="c2",
        proposal={"route": "local", "call": {"name": "get_location", "arguments": {}}},
        nonce_store=Nonces(), device_registry=Registry(), kill_switch=Switch())
    assert result.route == "guardian_review"


@pytest.mark.asyncio
async def test_kill_switch_and_revocation_fail_closed():
    proposal = {"route": "d3vonn_gateway", "call": {"name": "read_text", "arguments": {}}}
    killed = await authorize_request(device_id="g1", nonce="n3", correlation_id="c3", proposal=proposal,
                                     nonce_store=Nonces(), device_registry=Registry(), kill_switch=Switch(True))
    assert killed.reason == "global_kill_switch"
    revoked = await authorize_request(device_id="g1", nonce="n4", correlation_id="c4", proposal=proposal,
                                      nonce_store=Nonces(), device_registry=Registry(False), kill_switch=Switch())
    assert revoked.reason == "device_revoked_or_unknown"


@pytest.mark.asyncio
async def test_unknown_action_denied():
    result = await authorize_request(
        device_id="g1", nonce="n5", correlation_id="c5",
        proposal={"route": "local", "call": {"name": "unlock_door", "arguments": {}}},
        nonce_store=Nonces(), device_registry=Registry(), kill_switch=Switch())
    assert result.route == "deny"
