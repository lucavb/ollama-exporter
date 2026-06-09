#!/usr/bin/env sh
set -e

PORT="${PORT:-8000}"

exec env PORT="$PORT" node -e "fetch('http://localhost:' + process.env.PORT + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
