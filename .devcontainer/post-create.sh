#!/usr/bin/env bash
#
# Idempotent dev-container setup. Called from:
#   - devcontainer.json's postCreateCommand (VS Code Dev Containers path)
#   - build_container.sh's docker exec       (plain-docker path)
#
# Safe to re-run. Workspace path is auto-detected from the script's location.

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
WORKSPACE=$(cd "$SCRIPT_DIR/.." && pwd)

echo "[post-create] workspace: $WORKSPACE"

# chown the persisted named volumes so the vscode user owns them.
# .ssh is only mounted on the VS Code path, so skip if absent.
for d in /home/vscode/.claude /home/vscode/.codex /home/vscode/.ssh; do
    if [ -d "$d" ]; then
        sudo chown -R vscode:vscode "$d"
    fi
done
if [ -d /home/vscode/.ssh ]; then
    chmod 700 /home/vscode/.ssh
fi

# Volume-side configs: preserve any user edits already on the volume (-n).
cp -n "$SCRIPT_DIR/codex-config.toml"    /home/vscode/.codex/config.toml
cp -n "$SCRIPT_DIR/claude-settings.json" /home/vscode/.claude/settings.json

# Workspace-side configs: always refresh from the tracked source-of-truth.
cp "$SCRIPT_DIR/claude-mcp.json" "$WORKSPACE/.mcp.json"
mkdir -p "$WORKSPACE/.claude"
cp "$SCRIPT_DIR/claude-local-settings.json" "$WORKSPACE/.claude/settings.local.json"

# Bootstrap workspace .claude/settings.json (hooks) only if missing, so a
# project's own committed settings.json wins on subsequent rebuilds.
cp -n "$SCRIPT_DIR/claude-hooks.json" "$WORKSPACE/.claude/settings.json"

# Firewall. Rules don't persist across container starts; the VS Code path
# also re-runs this from postStartCommand, which is harmless (idempotent).
sudo "$SCRIPT_DIR/init-firewall.sh"

echo "[post-create] done."
