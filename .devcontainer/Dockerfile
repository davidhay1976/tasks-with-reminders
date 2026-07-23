FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Install firewall dependencies
RUN apt-get update && apt-get install -y \
    iptables \
    ipset \
    dnsutils \
    jq \
    aggregate \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (required by Claude Code and Codex CLI)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code

# Install OpenAI Codex CLI globally (used as an MCP server from Claude Code)
RUN npm install -g @openai/codex

# Allow the vscode user to:
#  - run any project's firewall init script with sudo, no password
#    (wildcard `/workspaces/*/...` keeps the image project-agnostic)
#  - chown the persisted Claude Code and Codex config volumes
RUN echo "vscode ALL=(root) NOPASSWD: /workspaces/*/.devcontainer/init-firewall.sh, /usr/bin/chown -R vscode\\:vscode /home/vscode/.claude, /usr/bin/chown -R vscode\\:vscode /home/vscode/.codex, /usr/bin/chown -R vscode\\:vscode /home/vscode/.ssh" \
    > /etc/sudoers.d/vscode-firewall \
    && chmod 0440 /etc/sudoers.d/vscode-firewall

# On first interactive shell after container creation, run the project's
# auth-setup script (prompts for codex / claude login if missing). Skips
# silently for non-interactive shells and after the first successful run.
# Then auto-launch claude for every interactive shell, with a recursion
# guard (CLAUDE_AUTOSTART_DONE) so claude's own Bash subshells don't
# re-trigger it. Set NO_CLAUDE_AUTOSTART=1 to get a plain shell.
RUN printf '%s\n' \
    '' \
    '# Run auth-setup.sh once per container on first interactive shell.' \
    'if [ -t 1 ] && [ -t 0 ] && [ ! -f "$HOME/.auth-setup-done" ]; then' \
    '    for _auth_script in /workspaces/*/.devcontainer/auth-setup.sh; do' \
    '        if [ -f "$_auth_script" ]; then' \
    '            bash "$_auth_script"' \
    '            touch "$HOME/.auth-setup-done"' \
    '            break' \
    '        fi' \
    '    done' \
    '    unset _auth_script' \
    'fi' \
    '' \
    '# Auto-launch claude in interactive shells. Set NO_CLAUDE_AUTOSTART=1 to skip.' \
    'if [ -t 1 ] && [ -t 0 ] && [ -z "${CLAUDE_AUTOSTART_DONE:-}" ] && [ -z "${NO_CLAUDE_AUTOSTART:-}" ] && command -v claude >/dev/null 2>&1; then' \
    '    export CLAUDE_AUTOSTART_DONE=1' \
    '    exec claude --dangerously-skip-permissions' \
    'fi' \
    >> /etc/bash.bashrc
