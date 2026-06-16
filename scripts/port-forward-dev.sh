#!/usr/bin/env bash
# Dev 环境 port-forward 脚本
# 将 dev-service 集群服务转发到本地端口
# 用法: ./scripts/port-forward-dev.sh [start|stop|status]
set -euo pipefail

KUBECONFIG_PATH="${KUBECONFIG:-/Users/zqs/Downloads/config.yaml}"
export KUBECONFIG="$KUBECONFIG_PATH"

PID_DIR="/tmp/hmr-port-forward"
LOG_DIR="/tmp/hmr-port-forward/logs"
CTX="dev-service"

forward_one() {
  local name=$1 ns=$2 resource=$3 local_port=$4 remote_port=$5
  local pid_file="$PID_DIR/$name.pid"

  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "  [$name] already running (pid $(cat "$pid_file")), skip"
    return
  fi

  kubectl port-forward --context "$CTX" -n "$ns" "$resource" "$local_port:$remote_port" \
    > "$LOG_DIR/$name.log" 2>&1 &
  echo $! > "$pid_file"
  echo "  [$name] localhost:$local_port -> $ns/$resource:$remote_port (pid $!)"
}

start() {
  mkdir -p "$PID_DIR" "$LOG_DIR"
  echo "Starting port-forwards (context=$CTX)..."
  echo ""

  forward_one claw-farm    claw-farm svc/claw-farm          18080 8080
  forward_one portal       claw-farm svc/portal-backend     13090 3090
  forward_one clawhub      clawhub   svc/clawhub            13080 3080
  forward_one platform-be  claw-farm svc/ks-claw-platform   18100 8100
  forward_one litellm      hmr-base  svc/llmproxy-litellm   14000 8080
  forward_one xspace       xspace    svc/xspace-agent       18081 8080
  forward_one supabase-kong supabase svc/supabase-supabase-kong 18084 8000
  forward_one claw-manager claw-farm svc/claw-manager        18090 8090
  forward_one mcp-server   claw-farm svc/ksc-mcp-server     18082 8080
  forward_one dev-pg       hmr-base  pod/pg-forward         15432 5432

  echo ""
  echo "Waiting for connections..."
  sleep 3

  echo ""
  echo "Connectivity check:"
  local ok=0 fail=0
  for port in 18080 13090 13080 18100 14000 18081 18084 18090 18082 15432; do
    if curl -s --connect-timeout 2 -o /dev/null http://localhost:$port 2>/dev/null; then
      echo "  localhost:$port  OK"
      ok=$((ok+1))
    else
      echo "  localhost:$port  FAIL (check $LOG_DIR/*.log)"
      fail=$((fail+1))
    fi
  done

  echo ""
  echo "$ok connected, $fail failed. Stop: ./scripts/port-forward-dev.sh stop"
}

stop() {
  echo "Stopping port-forwards..."
  if [ ! -d "$PID_DIR" ]; then
    echo "  No active forwards."
    return
  fi
  for pid_file in "$PID_DIR"/*.pid; do
    [ -f "$pid_file" ] || continue
    local name
    name=$(basename "$pid_file" .pid)
    local pid
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null
      echo "  [$name] stopped (pid $pid)"
    else
      echo "  [$name] already stopped"
    fi
    rm -f "$pid_file"
  done
  echo "Done."
}

status() {
  echo "Port-forward status:"
  if [ ! -d "$PID_DIR" ]; then
    echo "  No active forwards."
    return
  fi
  for pid_file in "$PID_DIR"/*.pid; do
    [ -f "$pid_file" ] || continue
    local name pid
    name=$(basename "$pid_file" .pid)
    pid=$(cat "$pid_file")
    if kill -0 "$pid" 2>/dev/null; then
      echo "  [$name] RUNNING (pid $pid)"
    else
      echo "  [$name] DEAD — log: $LOG_DIR/$name.log"
    fi
  done
}

case "${1:-start}" in
  start)  start ;;
  stop)   stop ;;
  status) status ;;
  *)      echo "Usage: $0 [start|stop|status]"; exit 1 ;;
esac
