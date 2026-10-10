#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/wesship/supreme-ai-deployment-hub"
REPO_DIR="/opt/supreme-ai-deployment-hub"
RUNNER_USER="github-runner"
RUNNER_NAME="d3vonn-production-vps"
RUNNER_LABELS="d3vonn-vps,production"
RUNNER_DIR="/home/${RUNNER_USER}/actions-runner"
DEPLOY_SOURCE="${REPO_DIR}/deploy/vps/scripts/d3vonn-deploy-release"
DEPLOY_TARGET="/usr/local/sbin/d3vonn-deploy-release"
SUDOERS_FILE="/etc/sudoers.d/d3vonn-github-runner-deploy"

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this script as root." >&2
  exit 1
fi

TOKEN="${1:-${RUNNER_TOKEN:-}}"
if [[ -z "${TOKEN}" ]]; then
  echo "Usage: $0 <fresh GitHub runner registration token>" >&2
  echo "Generate it at Settings > Actions > Runners > New self-hosted runner." >&2
  exit 1
fi

if ! id "${RUNNER_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${RUNNER_USER}"
fi

# Docker-group membership is root-equivalent. Remove it and grant only the
# root-owned deployment wrapper through sudoers.
if id -nG "${RUNNER_USER}" | tr ' ' '\n' | grep -qx docker; then
  gpasswd -d "${RUNNER_USER}" docker
fi

if [[ ! -x "${RUNNER_DIR}/config.sh" ]]; then
  echo "Runner files are missing from ${RUNNER_DIR}." >&2
  echo "Download and extract the Linux x64 runner there first." >&2
  exit 1
fi

if [[ ! -f "${DEPLOY_SOURCE}" ]]; then
  echo "Missing deployment wrapper source: ${DEPLOY_SOURCE}" >&2
  exit 1
fi

install -o root -g root -m 0755 "${DEPLOY_SOURCE}" "${DEPLOY_TARGET}"
printf '%s\n' \
  "${RUNNER_USER} ALL=(root) NOPASSWD: ${DEPLOY_TARGET} *" \
  > "${SUDOERS_FILE}"
chmod 0440 "${SUDOERS_FILE}"
visudo -cf "${SUDOERS_FILE}"

if ! git config --system --get-all safe.directory | grep -Fxq "${REPO_DIR}"; then
  git config --system --add safe.directory "${REPO_DIR}"
fi

chown -R "${RUNNER_USER}:${RUNNER_USER}" "${RUNNER_DIR}"

if [[ -f "${RUNNER_DIR}/.runner" ]]; then
  echo "Runner is already configured; skipping registration."
else
  runuser -u "${RUNNER_USER}" -- \
    "${RUNNER_DIR}/config.sh" \
      --url "${REPO_URL}" \
      --token "${TOKEN}" \
      --name "${RUNNER_NAME}" \
      --labels "${RUNNER_LABELS}" \
      --work "_work" \
      --unattended \
      --replace
fi

cd "${RUNNER_DIR}"

if [[ ! -f "/etc/systemd/system/actions.runner.wesship-supreme-ai-deployment-hub.${RUNNER_NAME}.service" ]]; then
  ./svc.sh install "${RUNNER_USER}"
fi

./svc.sh start
./svc.sh status

sudo -u "${RUNNER_USER}" sudo -n "${DEPLOY_TARGET}" --check

echo
echo "Runner registration complete with restricted deployment privileges."
echo "Confirm '${RUNNER_NAME}' is Idle in GitHub."
