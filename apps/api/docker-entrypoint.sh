#!/bin/sh
set -e

# Миграции накатываются на старте контейнера. Безопасно при одной реплике api;
# при масштабировании выставить RUN_MIGRATIONS=false и накатывать отдельным шагом:
#   docker compose run --rm api node dist/migrate.js
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  node dist/migrate.js
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

exec node dist/index.js
