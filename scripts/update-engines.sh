#!/usr/bin/env bash
# Pins an official engine submodule to a release tag and rewrites engines.lock.json.
# Usage: scripts/update-engines.sh <regular|simples|danfse> <tag>
set -euo pipefail
cd "$(dirname "$0")/.."

engine="${1:-}"; tag="${2:-}"
case "$engine" in
  regular) dir=services/regime-regular ;;
  simples) dir=services/simples-nacional ;;
  danfse)  dir=services/danfse ;;
  *) echo "Uso: $0 <regular|simples|danfse> <tag>" >&2; exit 1 ;;
esac
[ -n "$tag" ] || { echo "Informe a tag." >&2; exit 1; }

git submodule update --init "$dir"
git -C "$dir" fetch --tags --quiet
git -C "$dir" checkout --quiet "$tag"
commit="$(git -C "$dir" rev-parse HEAD)"

node -e '
  const fs = require("fs");
  const f = "apps/web/public/engines.lock.json";
  const lock = JSON.parse(fs.readFileSync(f, "utf8"));
  lock[process.argv[1]].tag = process.argv[2];
  lock[process.argv[1]].commit = process.argv[3];
  fs.writeFileSync(f, JSON.stringify(lock, null, 2) + "\n");
' "$engine" "$tag" "$commit"

echo "$engine fixado em $tag ($commit)."
echo "Revise os cenários e rode scripts/test-integration.sh antes de commitar."
