#!/usr/bin/env bash
# Brings the stack up (building images), runs integration + e2e tests against the real
# engines and optionally tears everything down.
# Usage: scripts/test-integration.sh [--down]
set -euo pipefail
cd "$(dirname "$0")/.."

# An exported DOCKER_DEFAULT_PLATFORM=linux/amd64 forces emulation on Apple Silicon.
unset DOCKER_DEFAULT_PLATFORM

docker compose up --build --wait -d

(cd apps/web && npm ci --silent && npm run typecheck && npm test)
(cd tests && npm ci --silent && npx playwright install chromium >/dev/null && npm run integration && npm run e2e)

if [ "${1:-}" = "--down" ]; then docker compose down; fi
