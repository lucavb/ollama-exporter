#!/usr/bin/env bash
set -euo pipefail

# This script installs the ollama-exporter as a systemd service.
# It will:
#  - ensure Node.js is installed
#  - create /opt/ollama-exporter
#  - build the TypeScript project
#  - create /etc/ollama-exporter.env (if absent)
#  - install and enable systemd unit ollama-exporter.service

SERVICE_NAME="ollama-exporter"
APP_DIR="/opt/ollama-exporter"
ENV_FILE="/etc/ollama-exporter.env"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
NODE_VERSION="24"

require_root() {
  if [[ ${EUID:-$(id -u)} -ne 0 ]]; then
    echo "This script must be run as root" >&2
    exit 1
  fi
}

check_nodejs() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Node.js is required but not installed." >&2
    echo "Please install Node.js ${NODE_VERSION} or later and try again." >&2
    echo "Visit https://nodejs.org/ for installation instructions." >&2
    exit 1
  fi
  
  # Check Node.js version
  NODE_MAJOR=$(node -v | cut -d. -f1 | sed 's/v//')
  if [[ ${NODE_MAJOR} -lt ${NODE_VERSION} ]]; then
    echo "Node.js ${NODE_VERSION} or later is required. Found: $(node -v)" >&2
    exit 1
  fi
}

create_user() {
  if ! id -u ${SERVICE_NAME} >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin ${SERVICE_NAME}
  fi
}

sync_app_files() {
  mkdir -p "${APP_DIR}"
  # Copy project files
  rsync -a --delete \
    --exclude ".git" \
    --exclude "__pycache__" \
    --exclude "node_modules" \
    --exclude "dist" \
    --exclude ".venv" \
    ./ "${APP_DIR}/"
  chown -R ${SERVICE_NAME}:${SERVICE_NAME} "${APP_DIR}"
}

build_app() {
  echo "Building TypeScript application..."
  cd "${APP_DIR}"
  
  # Install dependencies and build as root, then change ownership
  npm ci --include=dev
  npm run build
  
  # Remove dev dependencies to save space
  npm prune --production
  
  # Fix ownership
  chown -R ${SERVICE_NAME}:${SERVICE_NAME} "${APP_DIR}"
}

write_env_file() {
  if [[ ! -f "${ENV_FILE}" ]]; then
    cat >"${ENV_FILE}" <<EOF
# Environment for ollama-exporter
PORT=8000
INTERVAL=30
OLLAMA_HOST=localhost:11434
API_TIMEOUT=30
LOG_LEVEL=INFO
EOF
    chmod 0644 "${ENV_FILE}"
  fi
}

write_service() {
  cat >"${SERVICE_FILE}" <<EOF
[Unit]
Description=Ollama Prometheus Exporter
After=network.target

[Service]
Type=simple
User=${SERVICE_NAME}
Group=${SERVICE_NAME}
EnvironmentFile=${ENV_FILE}
WorkingDirectory=${APP_DIR}
ExecStart=$(command -v node) ${APP_DIR}/dist/index.js \\
  --port \${PORT} \\
  --interval \${INTERVAL} \\
  --ollama-host \${OLLAMA_HOST} \\
  --api-timeout \${API_TIMEOUT} \\
  --log-level \${LOG_LEVEL}
Restart=on-failure
RestartSec=2

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}

[Install]
WantedBy=multi-user.target
EOF
  chmod 0644 "${SERVICE_FILE}"
}

reload_enable_start() {
  systemctl daemon-reload
  systemctl enable --now ${SERVICE_NAME}.service
}

main() {
  require_root
  check_nodejs
  create_user
  sync_app_files
  build_app
  write_env_file
  write_service
  reload_enable_start
  echo "Installed and started ${SERVICE_NAME}. Service status:"
  echo ""
  systemctl --no-pager status ${SERVICE_NAME}.service || true
}

main "$@"