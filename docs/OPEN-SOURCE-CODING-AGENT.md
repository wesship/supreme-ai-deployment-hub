# Open-Source Coding Agent

## Decision

D3VONN.IO does not require GitHub Copilot for repository operation, CI/CD, security gates, or deployment. Copilot-specific repository automation is being removed so development does not depend on a paid Copilot subscription.

## Replacement

Use **Cline** as the coding agent, with **Ollama** for local model execution when the workstation has sufficient hardware.

- Cline: open-source coding agent for VS Code/terminal.
- Ollama: local model runtime; no per-request API charge when models run locally.
- GitHub Actions remains the CI/CD control plane.
- Existing security controls remain independent of the coding assistant.

## Security rules

1. Do not put GitHub, Supabase, Railway, Vercel, Snyk, or other secrets in prompts, source files, or committed configuration.
2. Keep production credentials in the existing secret stores.
3. Require human approval before destructive commands, deployments, credential changes, or security-control changes.
4. Cline is a development tool, not a replacement for CI security gates.
5. Prefer local Ollama models when practical for sensitive repository work.

## Suggested local setup

Install Cline in the IDE and Ollama on the development machine. In Cline, select Ollama as the provider and choose an appropriate coding model for the available hardware.

For larger repositories, use a sufficiently capable local model and keep repository-wide tasks scoped and reviewable. Cloud providers can be used through Cline only when explicitly approved and configured separately.

## Billing

Removing Copilot-specific repository files does **not** cancel a GitHub Copilot subscription. The personal GitHub billing setting must be canceled from GitHub account settings. GitHub states that cancellation takes effect at the end of the current billing cycle.

## Verification

After the transition:

- GitHub Actions must continue to run normally.
- Security checks must remain required where configured.
- No workflow should require a Copilot token or Copilot service.
- Deployment credentials and runtime configuration must remain unchanged.
