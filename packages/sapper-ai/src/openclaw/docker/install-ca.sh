#!/usr/bin/env sh
set -eu

DEFAULT_CA_PATH="/proxy-ca/mitmproxy-ca-cert.pem"
CERT_PATH="${NODE_EXTRA_CA_CERTS:-$DEFAULT_CA_PATH}"

# Primary mode: NODE_EXTRA_CA_CERTS at runtime (works with read-only rootfs).
if [ -n "${NODE_EXTRA_CA_CERTS:-}" ]; then
  [ -r "$CERT_PATH" ] || exit 0
  exit 0
fi

# No-op quietly when cert is not present.
[ -r "$DEFAULT_CA_PATH" ] || exit 0

# Legacy fallback: best-effort system trust install only when explicitly enabled.
if [ "${OPENCLAW_INSTALL_SYSTEM_CA:-0}" != "1" ]; then
  exit 0
fi

if [ ! -d /usr/local/share/ca-certificates ] || [ ! -w /usr/local/share/ca-certificates ]; then
  exit 0
fi

if ! command -v update-ca-certificates >/dev/null 2>&1; then
  exit 0
fi

cp "$DEFAULT_CA_PATH" /usr/local/share/ca-certificates/openclaw-proxy-ca.crt 2>/dev/null || exit 0
update-ca-certificates >/dev/null 2>&1 || true
