#!/usr/bin/env bash
# Доступ к prod-базе ka-game.ru через SSH-туннель.
#   ./scripts/prod-db.sh up            — поднять туннель (фоновый ssh -f -N)
#   ./scripts/prod-db.sh down          — закрыть туннель
#   ./scripts/prod-db.sh status        — состояние туннеля
#   ./scripts/prod-db.sh psql [args]   — psql к prod-базе (туннель поднимается сам)
#   ./scripts/prod-db.sh dump [файл]   — pg_dump prod-базы в локальный файл
#   ./scripts/prod-db.sh url           — вывести DATABASE_URL для внешних клиентов
#   ./scripts/prod-db.sh dev [pnpm-аргументы] — pnpm dev на prod-базе (по умолчанию `pnpm dev`)
# Креды берутся из .env.prod.local (в .gitignore).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$root/.env.prod.local"
[ -f "$env_file" ] || { echo "нет $env_file" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$env_file"; set +a

port="${PROD_DB_LOCAL_PORT:-15432}"

tunnel_pid() { pgrep -f "ssh -f -N .*-L ${port}:127.0.0.1:5432 ${PROD_SSH}" || true; }

up() {
  if [ -n "$(tunnel_pid)" ]; then echo "туннель уже поднят на порту $port"; return; fi
  ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 \
    -L "${port}:127.0.0.1:5432" "$PROD_SSH"
  echo "туннель поднят: 127.0.0.1:${port} -> prod postgres"
}

case "${1:-status}" in
  up) up ;;
  down)
    pid="$(tunnel_pid)"
    if [ -n "$pid" ]; then kill $pid && echo "туннель закрыт"; else echo "туннель не запущен"; fi ;;
  status)
    pid="$(tunnel_pid)"
    if [ -n "$pid" ]; then echo "туннель активен (pid $pid), порт $port"; else echo "туннель не запущен"; fi ;;
  psql) up >/dev/null; shift; exec psql "$PROD_DATABASE_URL" "$@" ;;
  dump)
    up >/dev/null
    out="${2:-$root/data/prod-$(date +%Y%m%d-%H%M%S).dump}"
    mkdir -p "$(dirname "$out")"
    pg_dump -Fc -f "$out" "$PROD_DATABASE_URL"
    echo "$out" ;;
  url) echo "$PROD_DATABASE_URL" ;;
  dev)
    up >/dev/null; shift
    # dotenv не перетирает уже заданные переменные, поэтому apps/api/.env остаётся нетронутым.
    # Кроны выключены: локальный процесс не должен начислять рейтинги в проде.
    # Порты отличаются от обычного dev-стенда, чтобы два стенда могли работать одновременно
    # и прод-база случайно не оказалась открыта на привычных localhost:5173/3000.
    api_port="${PROD_API_PORT:-3100}"
    web_port="${PROD_WEB_PORT:-5273}"
    echo "prod-стенд: web http://localhost:${web_port}, api http://localhost:${api_port}"
    DATABASE_URL="$PROD_DATABASE_URL" JOBS_ENABLED=false \
      PORT="$api_port" WEB_PORT="$web_port" \
      API_PROXY_TARGET="http://localhost:${api_port}" \
      WEB_ORIGIN="http://localhost:${web_port}" \
      exec pnpm "${@:-dev}" ;;
  *) echo "usage: $0 {up|down|status|psql|dump|url|dev}" >&2; exit 1 ;;
esac
