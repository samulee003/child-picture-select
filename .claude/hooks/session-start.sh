#!/bin/bash
set -euo pipefail

# Only run in remote/web environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

echo "[session-start] Installing npm dependencies (skipping postinstall to avoid electron-builder)..."
npm install --ignore-scripts

echo "[session-start] Rebuilding native modules for Node.js..."
# Rebuild native modules (better-sqlite3, sharp, onnxruntime-node) for the current Node.js version
# without targeting Electron ABI
npm rebuild --ignore-scripts 2>/dev/null || true

echo "[session-start] Done."
