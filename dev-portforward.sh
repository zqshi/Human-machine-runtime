#!/bin/bash
# dev-portforward.sh — 一键启动所有 dev 环境 port-forward（自动重连）
# 用法: ./dev-portforward.sh [start|stop|status]
#
# 说明：下方 namespace/service 为占位示例，企业按自有集群实际资源替换。
# 组件代号对照：litellm=LLM 网关；clawhub=技能市场；portal=配置中心；
#               claw-farm=实例编排；claw-manager=实例管理；platform-be=平台后端；
#               xspace=AI 工作区；weknora=RAG 服务。

set -euo pipefail

export KUBECONFIG="${KUBECONFIG:-$HOME/.kube/config}"
CONTEXT="${CONTEXT:-default}"   # 企业按自有 kubeconfig context 设置
PID_DIR="/tmp/hmr-pf"
mkdir -p "$PID_DIR"

declare -A FORWARDS=(
  # 格式：<逻辑名>=<namespace>:<svc资源>:<本地端口>:<远端端口>
  # namespace / service 名称请替换为各企业集群中的实际资源
  ["litellm"]="hmr-base:svc/llmproxy-litellm:14000:8080"
  ["clawhub"]="clawhub:svc/clawhub:13080:3080"
  ["portal"]="claw-farm:svc/portal-backend:13090:3090"
  ["claw-farm"]="claw-farm:svc/claw-farm:18080:8080"
  ["claw-manager"]="claw-farm:svc/claw-manager:18090:8090"
  ["platform-be"]="claw-farm:svc/platform-be:18100:8100"
  ["xspace"]="xspace:svc/xspace-app-gateway:18081:8080"
  ["weknora"]="weknora:svc/app:8088:8080"
)

start_one() {
  local name=$1
  IFS=':' read -r ns resource local_port remote_port <<< "${FORWARDS[$name]}"
  local pid_file="$PID_DIR/$name.pid"

  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "  [$name] already running (PID $(cat "$pid_file"))"
    return
  fi

  lsof -ti:"$local_port" 2>/dev/null | xargs kill -9 2>/dev/null || true

  nohup kubectl --context="$CONTEXT" -n "$ns" port-forward "$resource" "$local_port:$remote_port" \
    &>"$PID_DIR/$name.log" &
  echo $! > "$pid_file"
  echo "  [$name] started → localhost:$local_port (PID $!)"
}

stop_one() {
  local name=$1
  local pid_file="$PID_DIR/$name.pid"
  if [ -f "$pid_file" ]; then
    kill "$(cat "$pid_file")" 2>/dev/null && echo "  [$name] stopped" || echo "  [$name] already stopped"
    rm -f "$pid_file"
  fi
}

check_one() {
  local name=$1
  IFS=':' read -r ns resource local_port remote_port <<< "${FORWARDS[$name]}"
  local pid_file="$PID_DIR/$name.pid"

  if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    if curl -s --connect-timeout 2 --max-time 5 "http://127.0.0.1:$local_port/" &>/dev/null; then
      echo "  [$name] ✓ UP (localhost:$local_port)"
    else
      echo "  [$name] ⚠ PROCESS ALIVE BUT NOT RESPONDING (localhost:$local_port) — restarting"
      stop_one "$name"
      start_one "$name"
    fi
  else
    echo "  [$name] ✗ DOWN"
  fi
}

case "${1:-start}" in
  start)
    echo "Starting all port-forwards..."
    for name in "${!FORWARDS[@]}"; do
      start_one "$name"
    done
    echo ""
    echo "Waiting 5s for connections..."
    sleep 5
    echo ""
    echo "Status:"
    for name in "${!FORWARDS[@]}"; do
      check_one "$name"
    done
    ;;
  stop)
    echo "Stopping all port-forwards..."
    for name in "${!FORWARDS[@]}"; do
      stop_one "$name"
    done
    ;;
  status)
    echo "Port-forward status:"
    for name in "${!FORWARDS[@]}"; do
      check_one "$name"
    done
    ;;
  watch)
    echo "Watching port-forwards (Ctrl+C to stop)..."
    while true; do
      for name in "${!FORWARDS[@]}"; do
        IFS=':' read -r ns resource local_port remote_port <<< "${FORWARDS[$name]}"
        pid_file="$PID_DIR/$name.pid"
        if ! ([ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null); then
          echo "[$(date +%H:%M:%S)] [$name] died, restarting..."
          start_one "$name"
        fi
      done
      sleep 10
    done
    ;;
  *)
    echo "Usage: $0 {start|stop|status|watch}"
    exit 1
    ;;
esac
