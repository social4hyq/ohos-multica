#!/usr/bin/env bash
# Keep the external Multica daemon alive while the desktop HAP is running.
#
# The HAP sandbox cannot host the daemon (see README "HAP 内执行二进制路线一"),
# so the daemon runs on the host. This supervisor restarts it when the app is
# alive but the daemon's health endpoint is unreachable, and stays silent while
# everything is fine.
#
# Usage:
#   multica-supervise.sh            one supervision cycle, print verdict
#   multica-supervise.sh --loop     run cycles forever (foreground, own pidfile)
#   multica-supervise.sh --daemon   detach a loop instance (idempotent); for shellrc
#   multica-supervise.sh stop       stop the detached loop
#
# Env:
#   MULTICA_PROFILE            desktop profile name (default desktop-api.multica.ai)
#   MULTICA_SUPERVISE_PORT     health port override (default: daemon.port file,
#                              fallback: 19515 + sum(utf8 bytes of profile) % 1000)
#   MULTICA_SUPERVISE_INTERVAL seconds between cycles in loop mode (default 3)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PROFILE="${MULTICA_PROFILE:-desktop-api.multica.ai}"
INTERVAL="${MULTICA_SUPERVISE_INTERVAL:-3}"
APP_PROCESS="com.huawei.ohos_electron"

STATE_DIR="/data/storage/el2/base/files/multica-supervise"
mkdir -p "$STATE_DIR"
LOOP_PIDFILE="$STATE_DIR/supervise.pid"
LAST_START_FILE="$STATE_DIR/last-start"
DAEMON_LOG="$STATE_DIR/daemon.log"
SUPERVISE_LOG="${MULTICA_SUPERVISE_LOG:-$PROJECT_DIR/logs/supervise.log}"

resolve_port() {
  if [[ -n "${MULTICA_SUPERVISE_PORT:-}" ]]; then
    printf '%s\n' "$MULTICA_SUPERVISE_PORT"
    return 0
  fi
  local port_file="$HOME/.multica/profiles/$PROFILE/daemon.port"
  if [[ -r "$port_file" ]]; then
    # daemon.port is JSON: {"port":19681,"pid":28672}
    local from_file
    from_file="$(head -n 1 "$port_file" | sed -n 's/.*"port":\([0-9][0-9]*\).*/\1/p')"
    if [[ -n "$from_file" ]]; then
      printf '%s\n' "$from_file"
      return 0
    fi
  fi
  # Mirrors healthPortForProfile() in apps/desktop/src/main/daemon-profile.ts.
  local sum=0 i ord
  for (( i = 0; i < ${#PROFILE}; i++ )); do
    printf -v ord '%d' "'${PROFILE:i:1}"
    sum=$(( sum + ord ))
  done
  printf '%s\n' "$(( 19515 + sum % 1000 ))"
}

PORT="$(resolve_port)"

log() {
  printf '%s %s\n' "$(date '+%F %T')" "$*" >> "$SUPERVISE_LOG"
}

app_running() {
  ps -eo args 2>/dev/null | grep -F -x "$APP_PROCESS" > /dev/null
}

daemon_health() {
  curl -sf -m 2 "http://127.0.0.1:${PORT}/health" 2> /dev/null
}

cycle() {
  if ! app_running; then
    printf 'app-not-running\n'
    return 0
  fi
  if daemon_health > /dev/null; then
    printf 'daemon-ok port=%s\n' "$PORT"
    return 0
  fi
  local now last
  now="$(date +%s)"
  last="$(cat "$LAST_START_FILE" 2> /dev/null || printf '0')"
  if (( now - last < 30 )); then
    printf 'daemon-down start-rate-limited\n'
    return 0
  fi
  date +%s > "$LAST_START_FILE"
  log "app alive but daemon unhealthy (port $PORT); starting daemon (profile $PROFILE)"
  setsid nohup bash "$SCRIPT_DIR/start-daemon-ohos.sh" "$PROFILE" >> "$DAEMON_LOG" 2>&1 &
  printf 'daemon-started port=%s\n' "$PORT"
}

loop() {
  printf '%s\n' $$ > "$LOOP_PIDFILE"
  trap 'rm -f "$LOOP_PIDFILE"; exit 0' TERM INT
  local prev="" verdict
  while true; do
    verdict="$(cycle)"
    if [[ "$verdict" != "$prev" ]]; then
      log "$verdict"
      prev="$verdict"
    fi
    sleep "$INTERVAL"
  done
}

daemonize() {
  if [[ -f "$LOOP_PIDFILE" ]] && kill -0 "$(cat "$LOOP_PIDFILE")" 2> /dev/null; then
    printf 'already-running pid=%s\n' "$(cat "$LOOP_PIDFILE")"
    return 0
  fi
  rm -f "$LOOP_PIDFILE"
  setsid nohup bash "$0" --loop >> "$SUPERVISE_LOG" 2>&1 &
  sleep 1
  if [[ -f "$LOOP_PIDFILE" ]]; then
    printf 'started pid=%s\n' "$(cat "$LOOP_PIDFILE")"
  else
    printf 'start-failed (see %s)\n' "$SUPERVISE_LOG"
    return 1
  fi
}

stop_loop() {
  if [[ -f "$LOOP_PIDFILE" ]]; then
    local pid
    pid="$(cat "$LOOP_PIDFILE")"
    kill "$pid" 2> /dev/null || true
    rm -f "$LOOP_PIDFILE"
    printf 'stopped pid=%s\n' "$pid"
  else
    printf 'not-running\n'
  fi
}

case "${1:-}" in
  "" ) cycle ;;
  --loop ) loop ;;
  --daemon ) daemonize ;;
  stop ) stop_loop ;;
  * ) printf 'usage: %s [--loop|--daemon|stop]\n' "$0" >&2; exit 2 ;;
esac
