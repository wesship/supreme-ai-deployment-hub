# Implementation status

## Completed in foundation branch

- Provider-neutral capability and job contracts
- Provider capability registry and routing
- Secret redaction helper
- Sovereign Signal canon fixture and validation helper
- Core Supabase schema for projects, characters, canon, scenes, shots, references, jobs, outputs, QA, provider metadata, and timeline items
- Owner-scoped RLS policies
- Routing and redaction tests
- Secure provider setup documentation

## Next code milestones

- Backend job service with mock provider
- Grok Imagine adapter
- ElevenLabs adapter
- Poll/cancel/approve/reject endpoints
- Signed storage asset workflow
- Film workspace UI: project, scene, shot, provider, comparison, QA, and timeline
- Higgsfield authenticated bridge
- Runway and Luma adapters
- Automated visual QA

## External configuration required

Real provider calls remain disabled until the corresponding server-side secret is configured. Higgsfield direct API access must be verified for the account before implementing a direct adapter.
