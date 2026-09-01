# D3VONN Apple Vision Pro path

## Goal

Provide an Apple Vision Pro experience while preserving the vendor-neutral Wearable OS architecture used by the display preview and future hardware adapters.

## Delivery stages

### 1. Spatial-web compatibility

Keep D3VONN's public and authenticated web surfaces usable in Safari on visionOS with scalable text, clear focus states, reduced-motion support, semantic controls, and no interaction that depends exclusively on gaze or gesture.

### 2. Native visionOS shell

Use SwiftUI when native windows, volumes, spaces, or deeper platform integration materially improve the experience. Reuse least-privilege D3VONN API sessions; do not embed service-role or provider credentials.

### 3. Spatial features

Add RealityKit, immersive media, or other platform capabilities only behind documented entitlements and device-specific adapters. The vendor-neutral coordinator remains the source of policy, authorization, audit, and action governance.

Apple's current developer material describes SwiftUI windows and RealityKit/Unity volumes for visionOS, as well as Safari-based spatial web experiences:

- <https://developer.apple.com/visionos/>
- <https://developer.apple.com/videos/play/wwdc2023/10279/>

## Certification gate

- current Xcode and visionOS Simulator
- supported physical Apple Vision Pro hardware
- authentication, expiry, and device/session revocation
- accessibility and reduced-motion behavior
- media playback and network/offline behavior
- documented entitlement review
- no privileged secrets in the client bundle

This plan does not claim native visionOS certification or unrestricted device access.
