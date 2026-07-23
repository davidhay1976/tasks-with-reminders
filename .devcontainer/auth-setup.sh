#!/usr/bin/env bash
set -u

prompt_yes() {
    local question="$1"
    local reply
    read -r -p "$question [Y/n] " reply
    case "${reply,,}" in
        n|no) return 1 ;;
        *)    return 0 ;;
    esac
}

if codex login status >/dev/null 2>&1; then
    echo "[auth-setup] codex: already logged in"
else
    echo
    if prompt_yes "[auth-setup] codex is not authorized. Authorize now?"; then
        codex login --device-auth
    else
        echo "[auth-setup] Skipped. Run 'codex login' later if needed."
    fi
fi

if claude auth status 2>/dev/null | grep -q '"loggedIn": true'; then
    echo "[auth-setup] claude: already logged in"
else
    echo
    if prompt_yes "[auth-setup] claude is not authorized. Authorize now?"; then
        claude auth login
    else
        echo "[auth-setup] Skipped. Run 'claude auth login' later if needed."
    fi
fi

# GitHub SSH: make sure ~/.ssh has an ED25519 keypair and github.com is in
# known_hosts. If the key is not yet registered on GitHub, print the pubkey
# and tell the user to add it, then wait for confirmation and re-test.
SSH_DIR="$HOME/.ssh"
SSH_KEY="$SSH_DIR/id_ed25519"
KNOWN_HOSTS="$SSH_DIR/known_hosts"

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"

if [ ! -f "$SSH_KEY" ]; then
    echo "[auth-setup] github: generating ED25519 SSH key at $SSH_KEY"
    ssh-keygen -t ed25519 -f "$SSH_KEY" -N "" -C "vscode@$(hostname)-$(date +%Y%m%d)" -q
    chmod 600 "$SSH_KEY"
    chmod 644 "${SSH_KEY}.pub"
fi

# Add github.com host key (idempotent)
if ! grep -q '^github.com' "$KNOWN_HOSTS" 2>/dev/null; then
    ssh-keyscan -t ed25519 github.com 2>/dev/null >> "$KNOWN_HOSTS"
    chmod 644 "$KNOWN_HOSTS"
fi

# Test authentication. SSH to github.com returns 1 on success (it exits after
# printing "Hi <user>!"), so we check the message rather than the exit code.
if ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
    echo "[auth-setup] github: SSH key is registered"
else
    echo
    echo "[auth-setup] github: SSH key NOT yet registered. Paste this public key into"
    echo "             https://github.com/settings/ssh/new (any title):"
    echo
    cat "${SSH_KEY}.pub"
    echo
    if prompt_yes "[auth-setup] Press Y after the key is added to verify"; then
        if ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -T git@github.com 2>&1 | grep -q "successfully authenticated"; then
            echo "[auth-setup] github: verified."
        else
            echo "[auth-setup] github: still failing. Re-run this script after adding the key."
        fi
    else
        echo "[auth-setup] Skipped. Re-run $HOME/.devcontainer/auth-setup.sh or add the key later."
    fi
fi
