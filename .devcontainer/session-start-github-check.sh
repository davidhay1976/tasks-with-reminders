#!/usr/bin/env bash
# SessionStart hook: report environment status to Claude as context.
#   - GitHub repo existence (origin or default-owner fallback)
#   - codex MCP server (stdio: binary available?)
#   - latex-sidecar MCP server (http: reachable on host.docker.internal:5555?)
#
# Output is emitted as JSON so the message is BOTH shown to the user
# (systemMessage) AND injected into Claude's context (additionalContext).

set -uo pipefail

PROJECT_NAME=$(basename "$PWD")
DEFAULT_OWNER="davidhay1976"

# --- GitHub repo check ---
if origin_url=$(git config --get remote.origin.url 2>/dev/null); then
    test_url="$origin_url"
    src="origin"
else
    test_url="git@github.com:$DEFAULT_OWNER/$PROJECT_NAME.git"
    src="default (no origin configured; trying $DEFAULT_OWNER/$PROJECT_NAME)"
fi

if timeout 5 git ls-remote --heads "$test_url" >/dev/null 2>&1; then
    gh_line="GitHub repository check: $test_url ($src) — EXISTS. Use this repo for git operations on the $PROJECT_NAME project."
else
    gh_line="GitHub repository check: $test_url ($src) — NOT FOUND or inaccessible. Claude: state what you have in memory about this project's git remote, then ask the user whether to create the repo, update memory, or proceed locally only."
fi

# --- codex MCP (stdio) check ---
if codex_path=$(command -v codex 2>/dev/null); then
    codex_ver=$(timeout 3 codex --version 2>/dev/null | head -1 || true)
    codex_line="codex MCP (stdio): AVAILABLE — ${codex_path}${codex_ver:+ ($codex_ver)}"
else
    codex_line="codex MCP (stdio): UNAVAILABLE — 'codex' binary not found on PATH"
fi

# --- latex-sidecar MCP (http) check ---
latex_url="http://host.docker.internal:5555/mcp"
latex_code=$(timeout 3 curl -sS -o /dev/null -w "%{http_code}" "$latex_url" 2>/dev/null)
latex_code=${latex_code:-000}
if [ "$latex_code" = "000" ]; then
    latex_line="latex-sidecar MCP (http): UNREACHABLE at $latex_url — sidecar not running or firewall blocked"
else
    latex_line="latex-sidecar MCP (http): REACHABLE at $latex_url (HTTP $latex_code)"
fi

msg=$(printf '%s\n%s\n%s' "$gh_line" "$codex_line" "$latex_line")

jq -n --arg msg "$msg" '{
  systemMessage: $msg,
  hookSpecificOutput: {
    hookEventName: "SessionStart",
    additionalContext: $msg
  }
}'
