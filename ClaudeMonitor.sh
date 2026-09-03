#!/bin/sh
# ClaudeMonitor launcher for macOS / Linux.
# Requires Node.js: https://nodejs.org/ (or brew install node / your package manager)
#
# Usage:
#   chmod +x ClaudeMonitor.sh
#   ./ClaudeMonitor.sh

DIR="$(cd "$(dirname "$0")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
    echo "Node.js not found on PATH."
    echo "macOS:  brew install node"
    echo "Linux:  see https://nodejs.org/ or your package manager"
    exit 1
fi

exec node "$DIR/ClaudeMonitor.js" "$@"
