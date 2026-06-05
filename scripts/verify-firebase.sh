#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="studio-9757662699-74931"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cd "$ROOT_DIR"

echo "=== Firebase CLI version ==="
npx firebase --version

echo
"=== Firebase project check ==="
npx firebase projects:list | grep "$PROJECT_ID"

echo
"=== Setting active Firebase project ==="
npx firebase use "$PROJECT_ID"

echo
"=== Downloading deployed HTML ==="
cd "$TMP_DIR"
curl -fsSL "https://${PROJECT_ID}.web.app/" > deployed-index.html
curl -fsSL "https://${PROJECT_ID}.web.app/studio/" > deployed-studio.html
curl -fsSL "https://${PROJECT_ID}.web.app/stage/" > deployed-stage.html

echo
"=== Comparing local HTML against deployed HTML ==="
diff -u "$ROOT_DIR/public/index.html" "$TMP_DIR/deployed-index.html" || true
diff -u "$ROOT_DIR/public/studio/index.html" "$TMP_DIR/deployed-studio.html" || true
diff -u "$ROOT_DIR/public/stage/index.html" "$TMP_DIR/deployed-stage.html" || true

echo
"Verification complete. If the diff output is empty, local files match the deployed pages."
