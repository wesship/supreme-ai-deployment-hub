# Coding-Agent Independence

## Decision

D3VONN.IO is coding-agent neutral. Repository operation, review, CI/CD,
security enforcement, database migrations, and deployment do not require a
GitHub Copilot subscription, token, workflow, or service.

Coding assistants are optional operator tools. They do not replace repository
policy or protected checks.

## Supported operator choices

- **Codex** may be used for repository work through its normal authenticated
  environment and GitHub controls.
- **Cline** may be used as an open-source IDE or terminal coding agent.
- **Ollama** may provide local model inference to compatible tools such as
  Cline.
- Other assistants may be used when they follow the same security and review
  requirements.

No provider is installed, authenticated, or selected by this policy.

## Local hardware paths

Ollama supports Apple GPU acceleration through Metal and NVIDIA GPU
acceleration. That makes local inference a possible operator choice on both the
D3VONN Mac mini Pro and RTX 4090 workstation. Model selection must still fit
available memory and the task's context requirements.

Cline's local-model documentation supports Ollama and other local runtimes.
Local execution can reduce third-party data exposure, but it does not make
untrusted models, extensions, prompts, or generated code automatically safe.

## Security requirements

1. Never place GitHub, Supabase, Railway, Vercel, model-provider, or other
   credentials in prompts, committed configuration, logs, or generated files.
2. Keep production credentials in the existing managed secret stores.
3. Review diffs before commit and require protected CI before merge.
4. Require explicit human approval for destructive operations, deployments,
   credential changes, production data changes, and security-control changes.
5. Treat generated code and dependency suggestions as untrusted until reviewed
   and tested.
6. Do not grant a coding assistant broader repository or organization access
   than its task requires.
7. Local inference does not bypass license, provenance, vulnerability,
   secret-scanning, or deployment requirements.

## Historical cleanup automation

`scripts/bulk-close-stale-copilot-prs.sh` remains as a compatibility utility
for safely identifying old, superseded Copilot-authored drafts. It defaults to
a dry run and is called by the active triage workflow. Its presence does not
create a Copilot runtime, billing, token, or service dependency.

## Billing boundary

Repository changes cannot purchase, cancel, or modify a personal or
organization GitHub Copilot subscription. Billing changes must be made by an
authorized account or organization administrator after confirming the scope.

## Verification

- Active workflows must not reference Copilot services or credentials.
- Active secret inventories must not require a Copilot token.
- Historical cleanup automation must remain dry-run by default.
- GitHub Actions and the repository's security baseline remain authoritative.

## References

- [Cline local models](https://docs.cline.bot/running-models-locally/overview)
- [Cline Apache-2.0 license](https://github.com/cline/cline/blob/main/LICENSE)
- [Ollama hardware support](https://docs.ollama.com/gpu)
