#!/usr/bin/env sh
set -e

PORT="${PORT:-8000}"
INTERVAL="${INTERVAL:-30}"
OLLAMA_HOST="${OLLAMA_HOST:-localhost:11434}"
API_TIMEOUT="${API_TIMEOUT:-30}"
LOG_LEVEL="${LOG_LEVEL:-INFO}"

exec node --experimental-strip-types /app/src/index.ts \
  --port "$PORT" \
  --interval "$INTERVAL" \
  --ollama-host "$OLLAMA_HOST" \
  --api-timeout "$API_TIMEOUT" \
  --log-level "$LOG_LEVEL"



