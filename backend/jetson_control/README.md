# Jetson Control safety core

This package is an inert, transport-neutral safety foundation. It defines device/command contracts and deny-by-default policy decisions only.

It does **not** register API routes, talk to a Jetson, smart-glasses device, companion phone, robotics hardware, or vendor transport, and it does not claim live device connectivity.

Before any physical-device command path is enabled, the surrounding service must provide authenticated actor identity, server-side device identity/capability resolution, command persistence and idempotency/replay protection, explicit approval for sensitive/high-impact actions, device credential rotation/revocation, durable audit events, privacy-lock enforcement, authenticated adapter transport, and hardware-in-the-loop verification.

Browser code must never dispatch directly to a physical device adapter. Any later gateway/runtime layer should consume these pure decisions as one gate in a larger authorization and audit path.
