#!/usr/bin/env sh
set -eu

READY_FILE="/run/openclaw/ready"
PID_FILE="/run/openclaw/gateway.pid"
LOG_FILE="/captures/openclaw-gateway.log"

ensure_layout() {
  mkdir -p /run/openclaw /captures /skills /home/analyst
}

install_ca() {
  if [ -x /opt/runtime/install-ca.sh ]; then
    /opt/runtime/install-ca.sh >/dev/null 2>&1 || true
  fi
}

start_gateway() {
  if command -v openclaw-gateway >/dev/null 2>&1; then
    openclaw-gateway start --host 127.0.0.1 --port 8787 >>"$LOG_FILE" 2>&1 &
    echo "$!" >"$PID_FILE"
    return 0
  fi

  if command -v openclaw >/dev/null 2>&1; then
    openclaw gateway --host 127.0.0.1 --port 8787 >>"$LOG_FILE" 2>&1 &
    echo "$!" >"$PID_FILE"
    return 0
  fi

  echo "OpenClaw gateway command not found; running in mock mode." >>"$LOG_FILE"
  return 1
}

wait_for_ready() {
  retries=0

  while [ "$retries" -lt 30 ]; do
    if [ -f "$PID_FILE" ]; then
      pid="$(cat "$PID_FILE" 2>/dev/null || true)"
      if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
        touch "$READY_FILE"
        return 0
      fi
    else
      touch "$READY_FILE"
      return 0
    fi

    retries=$((retries + 1))
    sleep 1
  done

  touch "$READY_FILE"
  return 0
}

stop_gateway() {
  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || true)"
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
}

run_scenario() {
  scenario="${1:-}"
  if [ -z "$scenario" ]; then
    echo "Missing scenario prompt" >&2
    exit 1
  fi

  if command -v openclaw-gateway >/dev/null 2>&1; then
    if output="$(openclaw-gateway cli --message "$scenario" 2>&1)"; then
      printf "%s\n" "$output"
      return 0
    fi

    printf "%s\n" "$output" >&2
    return 1
  fi

  if command -v openclaw >/dev/null 2>&1; then
    if output="$(openclaw chat --message "$scenario" 2>&1)"; then
      printf "%s\n" "$output"
      return 0
    fi

    printf "%s\n" "$output" >&2
    return 1
  fi

  printf "assistant: %s\n" "$scenario"
  printf "tool_calls: []\n"
  return 0
}

main() {
  mode="${1:-serve}"

  case "$mode" in
  scenario)
    shift
    run_scenario "$*"
    ;;
  serve)
    ensure_layout
    install_ca
    start_gateway || true
    wait_for_ready
    trap 'stop_gateway; exit 0' INT TERM EXIT
    while :; do
      sleep 3600
    done
    ;;
  *)
    echo "Unknown mode: $mode" >&2
    exit 1
    ;;
  esac
}

main "$@"
