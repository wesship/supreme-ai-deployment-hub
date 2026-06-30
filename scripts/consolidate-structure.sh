#!/usr/bin/env bash
# consolidate-structure.sh — Reorganize the repository into domain-driven folders
# This implements Phase 1 of the D3VONN v2.0 Repo Modernization Roadmap.
#
# Target structure:
#   frontend/          — Vite/React app (src/, public/, index.html, configs)
#   backend/           — FastAPI backend (already exists, keep in place)
#   agents/            — Agent mesh scaffolds and d3vonnbench
#   knowledge/         — DKOS, memory, research modules
#   security/          — Compliance, governance, policy, protocols
#   automation/        — Hermes governance engine
#   infrastructure/    — All deployment/infra: k8s, terraform, helm, gitops, deploy, infra
#   integrations/      — SDK, API specs, MCP, extension
#   documentation/     — All docs and markdown guides
#   shared/            — Shared services, models, templates
#   tests/             — Consolidated test directory
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== D3VONN Repository Consolidation ==="
echo ""

# --- 1. Move browser extension files into integrations/extension/ ---
echo "[1/8] Consolidating browser extension → integrations/extension/"
mkdir -p integrations/extension
for f in manifest.json background.js popup.html popup.css popup.js settings.html settings.css settings.js; do
  if [ -f "$f" ]; then
    git mv "$f" integrations/extension/ 2>/dev/null || mv "$f" integrations/extension/
  fi
done
if [ -d icons ]; then
  git mv icons integrations/extension/icons 2>/dev/null || mv icons integrations/extension/icons
fi
# Also move src/extension content
if [ -d src/extension ]; then
  mkdir -p integrations/extension/src
  git mv src/extension/* integrations/extension/src/ 2>/dev/null || mv src/extension/* integrations/extension/src/
  rmdir src/extension 2>/dev/null || true
fi

# --- 2. Consolidate infrastructure ---
echo "[2/8] Consolidating infrastructure/"
mkdir -p infrastructure/k8s
mkdir -p infrastructure/terraform
mkdir -p infrastructure/helm
mkdir -p infrastructure/gitops
mkdir -p infrastructure/deploy
mkdir -p infrastructure/observability

# Move k8s/ contents
if [ -d k8s ] && [ "$(ls -A k8s 2>/dev/null)" ]; then
  git mv k8s/* infrastructure/k8s/ 2>/dev/null || cp -r k8s/* infrastructure/k8s/
  rm -rf k8s
fi

# Move terraform/
if [ -d terraform ] && [ "$(ls -A terraform 2>/dev/null)" ]; then
  git mv terraform/* infrastructure/terraform/ 2>/dev/null || cp -r terraform/* infrastructure/terraform/
  rm -rf terraform
fi

# Move helm-values/
if [ -d helm-values ] && [ "$(ls -A helm-values 2>/dev/null)" ]; then
  mkdir -p infrastructure/helm/values
  git mv helm-values/* infrastructure/helm/values/ 2>/dev/null || cp -r helm-values/* infrastructure/helm/values/
  rm -rf helm-values
fi

# Move infra/ contents (has helm/ and k8s/ subdirs)
if [ -d infra ] && [ "$(ls -A infra 2>/dev/null)" ]; then
  cp -rn infra/helm/* infrastructure/helm/ 2>/dev/null || true
  cp -rn infra/k8s/* infrastructure/k8s/ 2>/dev/null || true
  rm -rf infra
fi

# Move gitops/
if [ -d gitops ] && [ "$(ls -A gitops 2>/dev/null)" ]; then
  git mv gitops/* infrastructure/gitops/ 2>/dev/null || cp -r gitops/* infrastructure/gitops/
  rm -rf gitops
fi

# Move deploy/
if [ -d deploy ] && [ "$(ls -A deploy 2>/dev/null)" ]; then
  git mv deploy/* infrastructure/deploy/ 2>/dev/null || cp -r deploy/* infrastructure/deploy/
  rm -rf deploy
fi

# Move deployment/ → infrastructure/deployment/
if [ -d deployment ] && [ "$(ls -A deployment 2>/dev/null)" ]; then
  mkdir -p infrastructure/deployment
  git mv deployment/* infrastructure/deployment/ 2>/dev/null || cp -r deployment/* infrastructure/deployment/
  rm -rf deployment
fi

# Move observability/
if [ -d observability ] && [ "$(ls -A observability 2>/dev/null)" ]; then
  git mv observability/* infrastructure/observability/ 2>/dev/null || cp -r observability/* infrastructure/observability/
  rm -rf observability
fi

# --- 3. Consolidate security ---
echo "[3/8] Consolidating security/"
mkdir -p security/compliance
mkdir -p security/governance
mkdir -p security/policy
mkdir -p security/protocols

if [ -d compliance ] && [ "$(ls -A compliance 2>/dev/null)" ]; then
  cp -r compliance/* security/compliance/ 2>/dev/null || true
  rm -rf compliance
fi

if [ -d governance ] && [ "$(ls -A governance 2>/dev/null)" ]; then
  cp -r governance/* security/governance/ 2>/dev/null || true
  rm -rf governance
fi

if [ -d policy ] && [ "$(ls -A policy 2>/dev/null)" ]; then
  cp -r policy/* security/policy/ 2>/dev/null || true
  rm -rf policy
fi

if [ -d protocols ] && [ "$(ls -A protocols 2>/dev/null)" ]; then
  cp -r protocols/* security/protocols/ 2>/dev/null || true
  rm -rf protocols
fi

# --- 4. Consolidate knowledge ---
echo "[4/8] Consolidating knowledge/"
mkdir -p knowledge

if [ -d memory ] && [ "$(ls -A memory 2>/dev/null)" ]; then
  mkdir -p knowledge/memory
  cp -r memory/* knowledge/memory/ 2>/dev/null || true
  rm -rf memory
fi

# --- 5. Consolidate agents ---
echo "[5/8] Consolidating agents/"
mkdir -p agents

if [ -d d3vonnbench ]; then
  git mv d3vonnbench agents/d3vonnbench 2>/dev/null || mv d3vonnbench agents/d3vonnbench
fi

if [ -d scaffold ]; then
  git mv scaffold agents/scaffold 2>/dev/null || mv scaffold agents/scaffold
fi

if [ -d models ]; then
  mkdir -p agents/models
  cp -r models/* agents/models/ 2>/dev/null || true
  rm -rf models
fi

# --- 6. Consolidate automation (Hermes) ---
echo "[6/8] Consolidating automation/"
mkdir -p automation

if [ -d hermes ]; then
  git mv hermes automation/hermes 2>/dev/null || mv hermes automation/hermes
fi

# --- 7. Consolidate documentation ---
echo "[7/8] Consolidating documentation/"
mkdir -p documentation

# Move docs/ contents
if [ -d docs ] && [ "$(ls -A docs 2>/dev/null)" ]; then
  cp -r docs/* documentation/ 2>/dev/null || true
  rm -rf docs
fi

# Move standalone markdown guides to documentation/guides/
mkdir -p documentation/guides
for f in AUTH.md CHANGELOG.md CONTRIBUTING.md DESIGN.md GATES.md \
         GOVERNANCE_LOCK_MANIFEST.md ROADMAP.md SECURITY.md \
         SYSTEM_AUTHORITY.md TESTING.md VERCEL_DEPLOYMENT.md \
         README-TERRAFORM.md deployment_runbook.md \
         auth-verification.md deploy-trigger-2026-04-14.md \
         sitemap-submission-results.md; do
  if [ -f "$f" ]; then
    git mv "$f" documentation/guides/ 2>/dev/null || mv "$f" documentation/guides/
  fi
done

# --- 8. Consolidate tests ---
echo "[8/8] Consolidating tests/"
mkdir -p tests/e2e
mkdir -p tests/load
mkdir -p tests/stress
mkdir -p tests/contract
mkdir -p tests/chaos

# Move e2e/ root-level
if [ -d e2e ] && [ "$(ls -A e2e 2>/dev/null)" ]; then
  cp -r e2e/* tests/e2e/ 2>/dev/null || true
  rm -rf e2e
fi

# Move load-tests/
if [ -d load-tests ] && [ "$(ls -A load-tests 2>/dev/null)" ]; then
  cp -r load-tests/* tests/load/ 2>/dev/null || true
  rm -rf load-tests
fi

# Move stress-validation/
if [ -d stress-validation ] && [ "$(ls -A stress-validation 2>/dev/null)" ]; then
  cp -r stress-validation/* tests/stress/ 2>/dev/null || true
  rm -rf stress-validation
fi

# Move runtime-validation/ into tests/
if [ -d runtime-validation ] && [ "$(ls -A runtime-validation 2>/dev/null)" ]; then
  mkdir -p tests/runtime-validation
  cp -r runtime-validation/* tests/runtime-validation/ 2>/dev/null || true
  rm -rf runtime-validation
fi

# Move test-results/ into tests/
if [ -d test-results ] && [ "$(ls -A test-results 2>/dev/null)" ]; then
  mkdir -p tests/results
  cp -r test-results/* tests/results/ 2>/dev/null || true
  rm -rf test-results
fi

# --- 9. Move SDK into integrations ---
echo "[+] Moving SDK → integrations/sdk/"
if [ -d sdk ]; then
  git mv sdk integrations/sdk 2>/dev/null || mv sdk integrations/sdk
fi

# Move API spec
if [ -d api ]; then
  mkdir -p integrations/api
  cp -r api/* integrations/api/ 2>/dev/null || true
  rm -rf api
fi

# --- 10. Move shared services ---
echo "[+] Moving services/ → shared/services/"
mkdir -p shared
if [ -d services ]; then
  git mv services shared/services 2>/dev/null || mv services shared/services
fi

# --- 11. Clean up temp/report files from root ---
echo "[+] Cleaning up root-level clutter"
mkdir -p infrastructure/config
if [ -d config ]; then
  cp -r config/* infrastructure/config/ 2>/dev/null || true
  rm -rf config
fi

# Move lighthouse reports to tests/
if [ -f lighthouse-report.report.html ]; then
  mv lighthouse-report.report.html tests/lighthouse-report.html 2>/dev/null || true
fi
if [ -f lighthouse-report.report.json ]; then
  mv lighthouse-report.report.json tests/lighthouse-report.json 2>/dev/null || true
fi
if [ -f lighthouse-config.json ]; then
  mv lighthouse-config.json tests/lighthouse-config.json 2>/dev/null || true
fi
if [ -f scan-report.json ]; then
  mv scan-report.json security/scan-report.json 2>/dev/null || true
fi

# Move _temp.txt
rm -f _temp.txt 2>/dev/null || true

# Move Dockerfiles to infrastructure/docker/
mkdir -p infrastructure/docker
for f in Dockerfile Dockerfile.frontend Dockerfile.hardened Dockerfile.railway; do
  if [ -f "$f" ]; then
    git mv "$f" infrastructure/docker/ 2>/dev/null || mv "$f" infrastructure/docker/
  fi
done
if [ -f docker-compose.yml ]; then
  git mv docker-compose.yml infrastructure/docker/ 2>/dev/null || mv docker-compose.yml infrastructure/docker/
fi
if [ -f nginx.conf ]; then
  git mv nginx.conf infrastructure/docker/ 2>/dev/null || mv nginx.conf infrastructure/docker/
fi

# Move deployment platform configs
mkdir -p infrastructure/platforms
for f in railway.json render.yaml Procfile vercel.json; do
  if [ -f "$f" ]; then
    git mv "$f" infrastructure/platforms/ 2>/dev/null || mv "$f" infrastructure/platforms/
  fi
done

echo ""
echo "=== Consolidation complete ==="
echo ""
echo "New top-level structure:"
find . -maxdepth 1 -type d | sort | grep -v "^\.$" | grep -v "\.git$"
