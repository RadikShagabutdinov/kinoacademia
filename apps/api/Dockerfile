# Собирается из корня монорепозитория: docker build -f apps/api/Dockerfile .
# bookworm-slim, а не alpine: argon2 — нативный модуль, prebuild-ы собраны под glibc.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@10.33.2 --activate
WORKDIR /repo

# Манифесты воркспейса — общий слой для обеих установок зависимостей.
FROM base AS manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/config/package.json packages/config/

# --- Сборка бандла ---
FROM manifests AS build
RUN pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm -F api build

# --- Прод-зависимости отдельно: без tsup/tsx/drizzle-kit/vitest ---
FROM manifests AS prod-deps
# Корневой package.json обязателен: в нём pnpm.onlyBuiltDependencies, без него
# argon2 не выполнит postinstall и не подтянет нативный бинарник.
RUN pnpm install --frozen-lockfile --prod --filter @kinoacademia/api...

# --- Рантайм ---
FROM node:22-bookworm-slim AS runtime
ARG APP_VERSION=dev
ENV NODE_ENV=production \
    APP_VERSION=$APP_VERSION \
    MIGRATIONS_DIR=/repo/apps/api/migrations \
    SCANS_STORAGE_DIR=/data/scans \
    PORT=3000
# Раскладка /repo сохраняется как есть: node_modules воркспейса состоит из
# относительных симлинков в /repo/node_modules/.pnpm, склеивать каталоги нельзя.
WORKDIR /repo/apps/api

COPY --from=prod-deps /repo/node_modules /repo/node_modules
COPY --from=prod-deps /repo/apps/api/node_modules /repo/apps/api/node_modules
COPY --from=prod-deps /repo/package.json /repo/package.json
COPY --from=prod-deps /repo/apps/api/package.json /repo/apps/api/package.json
# Цель симлинка @kinoacademia/shared: сам код инлайнится в бандл, но битая
# ссылка в node_modules мешает диагностике.
COPY --from=build /repo/packages/shared /repo/packages/shared
COPY --from=build /repo/apps/api/dist ./dist
# Миграции — SQL-файлы, в бандл не попадают, нужны раннеру на старте.
COPY --from=build /repo/apps/api/src/db/migrations ./migrations
COPY apps/api/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && mkdir -p /data/scans \
    && chown -R node:node /data

USER node
EXPOSE 3000

# curl в slim-образе нет — пробуем через встроенный fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
