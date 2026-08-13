#!/usr/bin/env bash
# Деплой ka-game.ru одной командой: git pull + сборка образов + перезапуск + health-check.
#   ./scripts/deploy.sh                 — задеплоить текущую ветку main из origin
#   ./scripts/deploy.sh --ref v0.1.0    — задеплоить конкретную ветку/тег/коммит
#   ./scripts/deploy.sh --backup        — сделать дамп базы на сервере перед обновлением
#   ./scripts/deploy.sh --seed          — после деплоя выполнить сид (только первое развёртывание)
#   ./scripts/deploy.sh --no-push       — не пушить локальные коммиты перед деплоем
#   ./scripts/deploy.sh --logs          — после успешного деплоя показать логи api/caddy
# Хост берётся из PROD_SSH в .env.prod.local (файл в .gitignore).
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$root/.env.prod.local"
[ -f "$env_file" ] || { echo "нет $env_file (нужен PROD_SSH)" >&2; exit 1; }
# shellcheck disable=SC1090
set -a; . "$env_file"; set +a
: "${PROD_SSH:?PROD_SSH не задан в .env.prod.local}"

deploy_path="${PROD_DEPLOY_PATH:-/opt/kinoacademia}"
health_url="${PROD_HEALTH_URL:-https://ka-game.ru/health/ready}"
ref="main"
backup=false
seed=false
push=true
logs=false

while [ $# -gt 0 ]; do
  case "$1" in
    --ref) ref="${2:?--ref требует значение}"; shift 2 ;;
    --backup) backup=true; shift ;;
    --seed) seed=true; shift ;;
    --no-push) push=false; shift ;;
    --logs) logs=true; shift ;;
    -h|--help) sed -n '2,10p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "неизвестный аргумент: $1" >&2; exit 1 ;;
  esac
done

if [ "$push" = true ] && [ "$ref" = "main" ]; then
  echo "==> push main -> origin"
  git -C "$root" push origin HEAD:main
fi

echo "==> деплой $ref на $PROD_SSH:$deploy_path"

ssh -o ServerAliveInterval=30 "$PROD_SSH" \
  DEPLOY_PATH="$deploy_path" REF="$ref" BACKUP="$backup" SEED="$seed" \
  HEALTH_URL="$health_url" 'bash -euo pipefail -s' <<'REMOTE'
cd "$DEPLOY_PATH"

compose_files=(-f docker-compose.prod.yml)
# Файл существует только там, где включён внешний доступ к базе по SSH-туннелю.
[ -f docker-compose.db-access.yml ] && compose_files+=(-f docker-compose.db-access.yml)
dc() { docker compose "${compose_files[@]}" --env-file .env.prod "$@"; }

if [ "$BACKUP" = true ]; then
  out="backup-$(date +%F-%H%M).sql.gz"
  echo "==> дамп базы: $DEPLOY_PATH/$out"
  dc exec -T postgres pg_dump -U kinoacademia kinoacademia | gzip > "$out"
fi

echo "==> git fetch/checkout $REF"
git fetch --tags --prune origin
git checkout --detach "origin/$REF" 2>/dev/null || git checkout --detach "$REF"
git --no-pager log -1 --oneline

echo "==> сборка образов"
docker build -f apps/api/Dockerfile -t kinoacademia-api:latest .
docker build -f apps/web/Dockerfile -t kinoacademia-web:latest .

echo "==> запуск контейнеров"
dc up -d --remove-orphans

if [ "$SEED" = true ]; then
  echo "==> сид базы"
  dc run --rm api node dist/seed.js
  dc restart api
fi

echo "==> health-check $HEALTH_URL"
for i in $(seq 1 30); do
  if curl -fsS --max-time 5 "$HEALTH_URL" >/dev/null; then
    echo "готово (попытка $i)"
    dc ps
    exit 0
  fi
  sleep 2
done

echo "health-check не прошёл, логи api:" >&2
dc logs --tail 50 api >&2
exit 1
REMOTE

echo "==> деплой завершён"

if [ "$logs" = true ]; then
  ssh -t "$PROD_SSH" "cd '$deploy_path' && docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f --tail 100 api caddy"
fi
