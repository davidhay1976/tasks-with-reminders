#!/usr/bin/env bash
#
# Build and start a sandboxed dev container for any project.
#
# Usage:
#   ./.devcontainer/build_container.sh <host-workspace-path>
#
# Examples:
#   ./.devcontainer/build_container.sh .
#   ./.devcontainer/build_container.sh /Users/davidhay/Projects/myproject
#
# What it does:
#   - Derives the project name from the basename of the host path.
#   - Builds the image once (tag `claude-code-sandbox`, reusable across projects).
#   - Starts a container named `<project>-sandbox`.
#   - Mounts the host workspace at `/workspaces/<project>`.
#   - Creates persistent named volumes for Claude Code and Codex auth, keyed by
#     project name, so credentials survive container rebuilds.
#   - Runs the firewall init script.
#   - Drops you into an interactive shell inside the container.
#
# Notes:
#   - VS Code's Dev Containers extension uses a different naming scheme for the
#     config volumes (it appends `${devcontainerId}`, a hash, instead of the
#     project name). Pick one approach per project — either this script or
#     VS Code's Reopen-in-Container — so credentials persist consistently.

set -euo pipefail

if [ $# -ne 1 ]; then
    echo "Usage: $0 <host-workspace-path>" >&2
    echo "Example: $0 ." >&2
    exit 1
fi

HOST_PATH=$(cd "$1" && pwd)
PROJECT_NAME=$(basename "$HOST_PATH")
IMAGE_TAG="claude-code-sandbox"
CONTAINER_NAME="${PROJECT_NAME}-sandbox"
CONTAINER_WORKSPACE="/workspaces/${PROJECT_NAME}"
CLAUDE_VOLUME="claude-code-config-${PROJECT_NAME}"
CODEX_VOLUME="codex-config-${PROJECT_NAME}"
SSH_VOLUME="ssh-config-${PROJECT_NAME}"
SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)

echo "Project name:        $PROJECT_NAME"
echo "Host workspace:      $HOST_PATH"
echo "Container workspace: $CONTAINER_WORKSPACE"
echo "Container name:      $CONTAINER_NAME"
echo "Claude volume:       $CLAUDE_VOLUME"
echo "Codex volume:        $CODEX_VOLUME"
echo "SSH volume:          $SSH_VOLUME"
echo

# Replace any previous container with the same name.
docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
docker rm   "$CONTAINER_NAME" >/dev/null 2>&1 || true

# Build the image. Build context is .devcontainer/ so the Dockerfile can find
# any sibling files if it ever needs to COPY them in.
docker build -t "$IMAGE_TAG" -f "$SCRIPT_DIR/Dockerfile" "$SCRIPT_DIR"

# Start the container detached.
docker run -it -d \
    --name "$CONTAINER_NAME" \
    --cap-add=NET_ADMIN \
    --cap-add=NET_RAW \
    -v "$HOST_PATH:$CONTAINER_WORKSPACE" \
    -v "$CLAUDE_VOLUME:/home/vscode/.claude" \
    -v "$CODEX_VOLUME:/home/vscode/.codex" \
    -v "$SSH_VOLUME:/home/vscode/.ssh" \
    -e CLAUDE_CONFIG_DIR=/home/vscode/.claude \
    -e CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    -u vscode \
    -w "$CONTAINER_WORKSPACE" \
    "$IMAGE_TAG" \
    sleep infinity

# Run the shared post-create setup (chowns, config copies, firewall init).
# Same script that devcontainer.json's postCreateCommand invokes, so the
# two flows can't drift.
docker exec "$CONTAINER_NAME" "${CONTAINER_WORKSPACE}/.devcontainer/post-create.sh"

echo
echo "Container '$CONTAINER_NAME' is up. Opening a shell..."
echo

docker exec -it "$CONTAINER_NAME" bash
