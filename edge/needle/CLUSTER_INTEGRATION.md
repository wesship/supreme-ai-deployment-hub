# D3VONN Needle cluster integration

The smart glasses are a first-class human-edge node in the D3VONN cluster. Needle remains the intent proposal layer; authoritative actions stay behind the existing D3VONN gateway and GUARDIAN controls.

## Data path

```text
Smart glasses
  -> Needle intent proposal
  -> signed device envelope
  -> D3VONN gateway
     -> Jetson Orin Nano for vision/inference
     -> Hermes / governed agents for workflow reasoning
     -> D3VONN memory services
     -> GUARDIAN for privileged operations
  -> response to wearable display/audio
```

## Provisioning contract

The committed `cluster-profile.json` is the declarative profile used by the future D3VONN Edge Image / provisioning layer. It records capabilities and routing policy without storing device secrets.

Secrets and per-device credentials must be enrolled after imaging. They must never be baked into a golden Jetson image or committed to this repository.

## Safety state

This integration does **not** enable production device adapters. SG-3 Jetson hardware certification and SG-4 controlled canary approval remain mandatory before any production enablement.
