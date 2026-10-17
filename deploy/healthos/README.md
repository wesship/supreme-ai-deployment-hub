# D3VONN HealthOS Lab

This directory defines the hospital-simulation deployment boundary for D3VONN HealthOS.

## Purpose

Run a synthetic-only environment with:
- a FHIR server (Medplum or HAPI FHIR)
- OPA-compatible policy service
- Temporal
- optional OpenMRS EHR
- optional Open Integration Engine (OIE)
- D3VONN HealthOS/Hermes

No production PHI is permitted in this lab.

## Required gate conditions

The HealthOS API remains disabled unless `HEALTHOS_ENABLED=true`.
Real-data mode remains blocked unless `HEALTHOS_ALLOW_REAL_DATA=true`, which is not part of this sandbox gate.

The minimum synthetic hospital journey requires:
1. FHIR enabled and reachable
2. Policy enabled and reachable
3. Temporal enabled and configured
4. synthetic workflow envelope
5. audit_event_id present

OpenMRS and OIE are optional in the first lab run, then become required for the full hospital-integration certification gate.

## Container images

Image names are supplied through environment variables instead of hard-coded here so deployments can pin reviewed versions:
- HEALTHOS_FHIR_IMAGE
- HEALTHOS_OPA_IMAGE
- HEALTHOS_TEMPORAL_IMAGE
- HEALTHOS_POSTGRES_IMAGE
- HEALTHOS_OPENMRS_IMAGE
- HEALTHOS_OIE_IMAGE

Pin immutable versions/digests before any shared or externally reachable deployment.
