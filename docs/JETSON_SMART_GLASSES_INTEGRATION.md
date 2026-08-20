# Jetson Control — Smart Glasses Integration

Smart glasses are a first-class device class in Jetson Control. The initial target is the Ray-Ban Meta / Meta smart-glasses family, with capability discovery determining which functions are actually available for a specific generation and approved integration path.

## Architecture

```text
D3VONN.IO
   |
   v
Authenticated Control Plane
   |
   +-- Device Registry
   +-- Capability Registry
   +-- Privacy/Safety Policy
   +-- Telemetry
   +-- Audit Trail
   |
   +--> Approved Meta/companion integration
   |
   +--> Jetson edge node
```

The system must not assume that the glasses themselves are a general-purpose Jetson compute target. Where a companion phone or approved Meta interface is required, that relationship is represented explicitly by `companion_device_id`.

## Device capabilities

The registry supports capability discovery for:

- camera
- microphone
- audio output
- display
- notifications
- voice input
- image capture
- video capture
- location
- edge inference
- actuation

A command is rejected when the device does not advertise the capability required by that command.

## Privacy states

Smart-glasses devices support an explicit `privacy_locked` lifecycle state. Privacy-sensitive commands include camera capture, video capture and related sensor operations. These require an explicit backend approval decision in addition to normal authentication and authorization.

The browser cannot directly activate a glasses sensor.

## Companion model

The control plane supports a companion relationship because a smart-glasses product may rely on a paired phone or vendor-supported runtime for transport and device services.

The adapter boundary is intentionally vendor-neutral:

```text
D3VONN command
    -> authorization
    -> capability gate
    -> privacy gate
    -> vendor/companion adapter
    -> device
    -> telemetry/result
    -> audit
```

## Display and AI pipeline

For display-capable devices, an approved pipeline can be represented as:

```text
sensor/input
   -> Jetson edge inference
   -> policy/safety evaluation
   -> approved visual/audio result
   -> glasses adapter
   -> display/audio
```

The pipeline composer produces a versioned deployment specification. It does not execute arbitrary code on the glasses.

## Initial product surface

The dashboard should expose a Smart Glasses Fleet view with:

- enrollment state
- device/model family
- firmware version
- companion relationship
- connectivity
- battery
- capability manifest
- privacy state
- last-seen time
- model/pipeline version
- audit status

Live controls remain locked until the corresponding official/approved device integration has been verified.

## Certification gate

Before enabling a production smart-glasses command:

1. Verify the exact glasses generation and official integration mechanism.
2. Enroll a test device through the approved path.
3. Verify capability discovery.
4. Verify telemetry and last-seen state.
5. Verify unauthorized command denial.
6. Verify privacy-sensitive command denial without explicit approval.
7. Verify privacy-lock denial.
8. Verify approved display/audio operation where supported.
9. Verify sensor capture only through the approved API and user-visible permission model.
10. Verify the complete audit record for every action.
11. Verify device revocation prevents subsequent commands.

No undocumented/private vendor API should be used as a production dependency.
