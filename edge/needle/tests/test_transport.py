import json

import pytest

from edge.needle.transport import (
    AutoTransport,
    BluetoothRelayTransport,
    TransportError,
    WifiHttpsTransport,
    decode_envelope,
    encode_envelope,
    fragment_ble,
    reassemble_ble,
)


def _envelope():
    return {
        "device_id": "sg-canary-01",
        "nonce": "nonce-transport-0001",
        "correlation_id": "corr-transport-01",
        "proposal": {
            "route": "d3vonn_gateway",
            "call": {"name": "describe_scene", "arguments": {}},
        },
        "payload": {"image_base64": "YWJj"},
    }


def test_ble_fragment_round_trip():
    payload = encode_envelope(_envelope())
    frames = fragment_ble(payload, chunk_bytes=32)
    assert len(frames) > 1
    assert reassemble_ble(frames) == payload
    assert decode_envelope(reassemble_ble(frames)) == _envelope()


def test_ble_reassembly_fails_closed_on_missing_frame():
    frames = fragment_ble(encode_envelope(_envelope()), chunk_bytes=32)
    with pytest.raises(TransportError, match="incomplete_ble_message"):
        reassemble_ble(frames[:-1])


def test_wifi_transport_adds_device_key_and_request_id():
    captured = {}

    class _Response:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return b'{"status":"completed"}'

        def getcode(self):
            return self.status

    def opener(req, timeout):
        captured["headers"] = dict(req.header_items())
        captured["body"] = json.loads(req.data.decode("utf-8"))
        captured["timeout"] = timeout
        return _Response()

    result = WifiHttpsTransport(device_key="secret", opener=opener).send(_envelope())
    assert result.transport == "wifi"
    assert result.status_code == 200
    assert result.body["status"] == "completed"
    assert captured["headers"]["X-d3vonn-device-key"] == "secret"
    assert captured["headers"]["X-request-id"] == "corr-transport-01"
    assert captured["body"]["device_id"] == "sg-canary-01"


def test_bluetooth_relay_never_needs_server_key_on_glasses():
    request_frames = []

    def send_frame(frame):
        request_frames.append(frame)

    def receive_frames():
        response = encode_envelope({"_http_status": 200, "status": "completed"})
        return fragment_ble(response, chunk_bytes=40)

    result = BluetoothRelayTransport(
        send_frame=send_frame,
        receive_frames=receive_frames,
        chunk_bytes=40,
    ).send(_envelope())

    assert result.transport == "bluetooth"
    assert result.status_code == 200
    request_doc = decode_envelope(reassemble_ble(request_frames))
    assert "device_key" not in request_doc
    assert "X-D3VONN-Device-Key" not in json.dumps(request_doc)


def test_auto_transport_falls_back_to_bluetooth_on_wifi_failure():
    class _Wifi:
        def send(self, envelope):
            raise TransportError("wifi_transport_failed")

    class _Bluetooth:
        def send(self, envelope):
            return type("Result", (), {"transport": "bluetooth", "status_code": 200, "body": {"ok": True}})()

    result = AutoTransport(
        wifi=_Wifi(),
        bluetooth=_Bluetooth(),
        wifi_available=lambda: True,
    ).send(_envelope())
    assert result.transport == "bluetooth"
    assert result.body == {"ok": True}
