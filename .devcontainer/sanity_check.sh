#!/usr/bin/env bash
#
# Quick post-startup checks. Run with: ./.devcontainer/sanity_check.sh

# 1. Firewall is up
sudo iptables -L OUTPUT -n | grep -q REJECT && echo "✓ Firewall active" || echo "✗ Firewall NOT active"

# 2. Allowlist is populated (should see 60+ entries)
echo "Allowlist entries: $(sudo ipset list allowed-domains | grep -c '^[0-9]')"

# 3. Real-world reachability — blocked vs allowed
echo -n "example.com (should fail):           "
curl --max-time 5 -s -o /dev/null -w "%{http_code}\n" https://www.example.com 2>&1 || echo "BLOCKED ✓"
echo -n "api.anthropic.com (should succeed):  "
curl --max-time 5 -s -o /dev/null -w "%{http_code}\n" https://api.anthropic.com
echo -n "api.openai.com    (should succeed):  "
curl --max-time 5 -s -o /dev/null -w "%{http_code}\n" https://api.openai.com/v1/models
echo -n "api.github.com    (should succeed):  "
curl --max-time 5 -s -o /dev/null -w "%{http_code}\n" https://api.github.com/zen

# 4. Identity + tooling
echo "Running as:   $(whoami)"
echo -n "claude:       "; which claude || echo "MISSING"
echo -n "codex:        "; which codex  || echo "MISSING"
