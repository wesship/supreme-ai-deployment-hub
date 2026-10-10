# SG-01D Wi-Fi + Bluetooth transport

SG-01D adds two network paths for the same Needle → D3VONN.IO gateway contract.

## Wi-Fi direct

A Wi-Fi capable glasses client or paired phone sends HTTPS directly to:

`POST https://api.d3vonn.io/api/smart-glasses/v1/execute`

Required client state:

- `device_id` (current canary: `sg-canary-01`)
- unique nonce per request
- correlation ID
- Needle proposal and payload
- `X-D3VONN-Device-Key` from secure storage

TLS certificate verification must remain enabled. The device key must never be placed in query strings, logs, analytics, or BLE frames.

## Bluetooth LE relay

BLE is a local radio link, not the Internet connection. The supported SG-01D Bluetooth design is:

```
glasses
  ↓ BLE GATT
paired phone / edge relay
  ↓ HTTPS + X-D3VONN-Device-Key
api.d3vonn.io
```

The glasses transmit only the SG envelope over BLE. The paired relay owns the server credential and adds it at the HTTPS boundary.

GATT contract:

- Service UUID: `d3v00001-4e45-4544-4c45-535347303144`
- TX characteristic: `d3v00002-4e45-4544-4c45-535347303144`
- RX characteristic: `d3v00003-4e45-4544-4c45-535347303144`

Messages are JSON UTF-8 and use ordered length-safe frames with a 4-byte frame header. Default frame size is 180 bytes. The current protocol rejects incomplete, duplicate, inconsistent, malformed, or oversized messages.

## Transport priority

`AutoTransport` prefers Wi-Fi and falls back to BLE only when the Wi-Fi transport itself fails. A valid server response (including 401/403/5xx) is not a reason to bypass policy using another transport.

## Safety boundary

Transport selection does not change authorization:

```
Needle proposal
  ↓
Wi-Fi or BLE relay
  ↓
SG gateway
  ↓
device auth
  ↓
allowlist
  ↓
Redis replay protection
  ↓
global kill switch
  ↓
D3VONN vision / HERMES / GUARDIAN policy
```

The production kill switch remains authoritative for both transports.

## Physical canary order

1. Keep `SMART_GLASSES_KILL_SWITCH=true`.
2. Pair the phone relay over BLE and verify GATT discovery.
3. Verify Wi-Fi HTTPS connectivity.
4. Send one request on Wi-Fi and confirm kill-switch denial.
5. Send one request over BLE relay and confirm the same denial.
6. Temporarily open the canary only after both denial paths pass.
7. Execute exactly one `describe_scene` request.
8. Reuse its nonce and verify replay rejection.
9. Restore the kill switch to `true`.
