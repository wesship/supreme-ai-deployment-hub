# DevonnBench Runbook

This repository includes a manual DevonnBench security audit workflow at:

```text
.github/workflows/devonnbench-security.yml
```

## Required configuration

Add these repository secrets before running the live API smoke benchmark:

```text
DEVONN_BASE_URL
DEVONN_API_TOKEN
```

Recommended location:

```text
GitHub repository → Settings → Secrets and variables → Actions → Repository secrets
```

Use the public API URL for `DEVONN_BASE_URL`, for example:

```text
https://api.devonn.ai
```

Never commit the real `DEVONN_API_TOKEN` to the repository.

## Manual GitHub Actions run

1. Open the repository in GitHub.
2. Go to **Actions**.
3. Select **DevonnBench Security Audit**.
4. Click **Run workflow** on `main`.
5. Open the completed run and review both jobs:
   - `Repo security checks`
   - `DevonnBench API security smoke`
6. Download the artifact named:

```text
devonnbench-security-artifacts
```

## Local run

Copy `.env.example` to `.env`, fill in the DevonnBench values, then run:

```bash
python -m pip install -r requirements-devonnbench.txt
python -m devonnbench.cli run devonnbench/suites/security-smoke.yaml \
  --base-url "$DEVONN_BASE_URL" \
  --env "${DEVONN_ENV:-local}" \
  --threshold 100 \
  --auth-token "$DEVONN_API_TOKEN"
```

## Expected success indicators

A passing run should report:

```text
Result      : PASS
Score       : 100.0 / threshold 100
```

Benchmark JSON output is written under:

```text
benchmark-artifacts/
```

## Troubleshooting

If the GitHub Actions job skips the live API smoke test, confirm `DEVONN_BASE_URL` is configured as a repository secret. If authentication fails, rotate and update `DEVONN_API_TOKEN` in repository secrets.
