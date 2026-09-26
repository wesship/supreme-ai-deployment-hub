"""SG-01D client transports for Wi-Fi HTTPS and Bluetooth LE phone relay.

The transport layer never changes Needle policy. It only carries an already-built
smart-glasses envelope to the existing D3VONN.IO SG gateway.

Wi-Fi:
    glasses/phone -> HTTPS -> /api/smart-glasses/v1/execute

Bluetooth LE:
    glasses -> BLE GATT relay -> paired phone/edge gateway -> HTTPS -> D3VONN.IO

The server device key is intentionally NOT included in BLE frames. A trusted phone
relay adds the credential when forwarding to D3VONN.IO.
"""
from __future__ import annotations

import json
import struct
from dataclasses import dataclass
from typing import Callable, Iterable
from urllib import request

DEFAULT_ENDPOINT = "https://api.d3vonn.io/api/smart-glasses/v1/execute"

BLE_SERVICE_UUID = "d3v00001-4e45-4544-4c45-535347303144"
BLE_TX_UUID = "d3v00002-4e45-4544-4c45-535347303144"
BLE_RX_UUID = "d3v00003-4e45-4544-4c45-535347303144"

_FRAME_HEADER = struct.Struct(">HH")
DEFAULT_BLE_CHUNK_BYTES = 180
MAX_BLE_MESSAGE_BYTES = 64 * 1024


class TransportError(RuntimeError):
    pass


@dataclass(frozen=True)
class TransportResult:
    transport: str
    status_code: int
    body: dict


def encode_envelope(envelope: dict) -> bytes:
    payload = json.dumps(envelope, separators=(",", ":"), sort_keys=True).encode("utf-8")
    if len(payload) > MAX_BLE_MESSAGE_BYTES:
        raise TransportError("envelope_too_large")
    return payload


def decode_envelope(payload: bytes) -> dict:
    try:
        decoded = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise TransportError("invalid_envelope") from exc
    if not isinstance(decoded, dict):
        raise TransportError("invalid_envelope")
    return decoded


def fragment_ble(payload: bytes, *, chunk_bytes: int = DEFAULT_BLE_CHUNK_BYTES) -> list[bytes]:
    if chunk_bytes <= _FRAME_HEADER.size:
        raise ValueError("chunk_bytes too small")
    if len(payload) > MAX_BLE_MESSAGE_BYTES:
        raise TransportError("envelope_too_large")
    data_bytes = chunk_bytes - _FRAME_HEADER.size
    total = max(1, (len(payload) + data_bytes - 1) // data_bytes)
    if total > 0xFFFF:
        raise TransportError("too_many_ble_frames")
    return [
        _FRAME_HEADER.pack(index, total) + payload[index * data_bytes:(index + 1) * data_bytes]
        for index in range(total)
    ]


def reassemble_ble(frames: Iterable[bytes]) -> bytes:
    parts: dict[int, bytes] = {}
    expected_total: int | None = None
    for frame in frames:
        if len(frame) < _FRAME_HEADER.size:
            raise TransportError("invalid_ble_frame")
        index, total = _FRAME_HEADER.unpack(frame[:_FRAME_HEADER.size])
        if total == 0 or index >= total:
            raise TransportError("invalid_ble_frame")
        if expected_total is None:
            expected_total = total
        elif total != expected_total:
            raise TransportError("inconsistent_ble_frames")
        if index in parts:
            raise TransportError("duplicate_ble_frame")
        parts[index] = frame[_FRAME_HEADER.size:]

    if expected_total is None or len(parts) != expected_total:
        raise TransportError("incomplete_ble_message")
    try:
        return b"".join(parts[index] for index in range(expected_total))
    except KeyError as exc:
        raise TransportError("incomplete_ble_message") from exc


class WifiHttpsTransport:
    """Direct HTTPS transport for Wi-Fi capable clients."""

    def __init__(
        self,
        *,
        device_key: str,
        endpoint: str = DEFAULT_ENDPOINT,
        timeout_seconds: float = 20.0,
        opener: Callable = request.urlopen,
    ):
        if not device_key:
            raise ValueError("device_key is required")
        if not endpoint.startswith("https://"):
            raise ValueError("endpoint must use https")
        self.device_key = device_key
        self.endpoint = endpoint
        self.timeout_seconds = timeout_seconds
        self.opener = opener

    def send(self, envelope: dict) -> TransportResult:
        body = encode_envelope(envelope)
        req = request.Request(
            self.endpoint,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-D3VONN-Device-Key": self.device_key,
                "X-Request-ID": str(envelope.get("correlation_id", "")),
            },
        )
        try:
            with self.opener(req, timeout=self.timeout_seconds) as response:
                status = int(getattr(response, "status", response.getcode()))
                raw = response.read()
        except Exception as exc:  # network/platform exceptions are normalized at boundary
            raise TransportError("wifi_transport_failed") from exc

        try:
            decoded = json.loads(raw.decode("utf-8")) if raw else {}
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise TransportError("invalid_gateway_response") from exc
        if not isinstance(decoded, dict):
            raise TransportError("invalid_gateway_response")
        return TransportResult("wifi", status, decoded)


class BluetoothRelayTransport:
    """BLE transport to a trusted phone/edge relay.

    send_frame writes one GATT TX characteristic frame.
    receive_frames returns the complete RX response frame sequence.
    """

    def __init__(
        self,
        *,
        send_frame: Callable[[bytes], None],
        receive_frames: Callable[[], Iterable[bytes]],
        chunk_bytes: int = DEFAULT_BLE_CHUNK_BYTES,
    ):
        self.send_frame = send_frame
        self.receive_frames = receive_frames
        self.chunk_bytes = chunk_bytes

    def send(self, envelope: dict) -> TransportResult:
        payload = encode_envelope(envelope)
        for frame in fragment_ble(payload, chunk_bytes=self.chunk_bytes):
            self.send_frame(frame)

        response_payload = reassemble_ble(self.receive_frames())
        response = decode_envelope(response_payload)
        status_code = response.pop("_http_status", None)
        if isinstance(status_code, bool) or not isinstance(status_code, int):
            raise TransportError("relay_missing_http_status")
        return TransportResult("bluetooth", status_code, response)


class AutoTransport:
    """Prefer Wi-Fi; fail over to the paired BLE relay only on transport failure."""

    def __init__(
        self,
        *,
        wifi: WifiHttpsTransport | None = None,
        bluetooth: BluetoothRelayTransport | None = None,
        wifi_available: Callable[[], bool] = lambda: True,
    ):
        if wifi is None and bluetooth is None:
            raise ValueError("at least one transport is required")
        self.wifi = wifi
        self.bluetooth = bluetooth
        self.wifi_available = wifi_available

    def send(self, envelope: dict) -> TransportResult:
        if self.wifi is not None and self.wifi_available():
            try:
                return self.wifi.send(envelope)
            except TransportError:
                if self.bluetooth is None:
                    raise
        if self.bluetooth is not None:
            return self.bluetooth.send(envelope)
        raise TransportError("no_available_transport")


def relay_forward(
    envelope_payload: bytes,
    *,
    device_key: str,
    endpoint: str = DEFAULT_ENDPOINT,
    opener: Callable = request.urlopen,
) -> bytes:
    """Phone/edge relay helper: add server credential only at the HTTPS boundary."""
    envelope = decode_envelope(envelope_payload)
    result = WifiHttpsTransport(
        device_key=device_key,
        endpoint=endpoint,
        opener=opener,
    ).send(envelope)
    response = dict(result.body)
    response["_http_status"] = result.status_code
    return encode_envelope(response)
