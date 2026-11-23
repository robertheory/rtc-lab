#!/bin/sh
# Idempotent database preparation.
# - Fingerprint = sha256 of every official Flyway script.
# - If the target DB exists and was built for the same fingerprint, do nothing.
# - Otherwise migrate into a scratch path and atomically move the result in place,
#   so a failed run never leaves a half-built database behind.
set -eu

DATA_DIR="${DB_DATA_DIR:-/data}"
DB_NAME="calculadora-pro.db"
TARGET="$DATA_DIR/$DB_NAME"
MARKER="$DATA_DIR/.built-for"

cd /build
FINGERPRINT="$(find flyway -type f | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -d' ' -f1)"

if [ -f "$TARGET" ] && [ -f "$MARKER" ] && [ "$(cat "$MARKER")" = "$FINGERPRINT" ]; then
  echo "[db-init] database up to date ($FINGERPRINT), nothing to do"
  exit 0
fi

echo "[db-init] building database for fingerprint $FINGERPRINT"
rm -rf calculadora
mkdir -p calculadora/db
mvn -B -q flyway:migrate -Dflyway.configFiles=./flyway/flyway-pro.conf

SCRATCH="$DATA_DIR/.$DB_NAME.tmp"
cp "calculadora/db/$DB_NAME" "$SCRATCH"
chmod 644 "$SCRATCH"
mv -f "$SCRATCH" "$TARGET"
echo "$FINGERPRINT" > "$MARKER"
echo "[db-init] done: $TARGET"
