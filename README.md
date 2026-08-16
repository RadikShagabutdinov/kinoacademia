# Спасибо Киноакадемии!

Веб-приложение для ролевой игры в жанре комедии по мотивам «Реальных упырей».
Подробное описание игры — в [PROJECT.md](./PROJECT.md).

---

## Быстрый старт (локально)

### Требования

- Node.js 22 LTS ([nvm](https://github.com/nvm-sh/nvm): `nvm use`)
- pnpm 9+ (`npm install -g pnpm`)

### Установка и запуск

```bash
# Установить зависимости
pnpm install

# Поднять PostgreSQL для разработки
docker compose up -d postgres

# Скопировать переменные окружения для api
cp apps/api/.env.example apps/api/.env

# Применить миграции и заполнить справочники
pnpm -F api db:migrate
pnpm -F api db:seed

# Запустить фронт и бэк параллельно
pnpm dev

# Или по отдельности:
pnpm -F web dev    # http://localhost:5173
pnpm -F api dev    # http://localhost:3000
```

### База данных

| Команда | Описание |
|---|---|
| `docker compose up -d postgres` | Поднять PostgreSQL 16 |
| `docker compose down` | Остановить контейнер (данные сохраняются в томе) |
| `pnpm -F api db:generate` | Сгенерировать SQL-миграцию по изменениям Drizzle-схемы |
| `pnpm -F api db:migrate` | Применить миграции к БД из `DATABASE_URL` (drizzle-kit) |
| `pnpm -F api db:migrate:run` | То же программным раннером — так миграции накатываются в проде, где drizzle-kit недоступен |
| `pnpm -F api db:seed` | Заполнить справочники + создать администратора `admin` (пароль из `SEED_ADMIN_PASSWORD`). При `SEED_DEFAULT_PLAYERS=true` дополнительно создаются тестовые игроки `vamp` (раса `vamp`, персонаж «Вампир») и `wolf` (раса `wolf`, «Ликан») с тем же паролем |
| `pnpm -F api db:studio` | Drizzle Studio для просмотра данных |

---

## Переменные окружения

Скопировать `.env.example` → `.env` в нужном приложении.

| Переменная | Приложение | Описание |
|---|---|---|
| `PORT` | api | Порт сервера (default: 3000) |
| `NODE_ENV` | api | `development` / `production` / `test` (default: `development`) |
| `DATABASE_URL` | api | Строка подключения PostgreSQL (default из docker-compose: `postgres://kinoacademia:kinoacademia@localhost:5432/kinoacademia`) |
| `DATABASE_POOL_MAX` | api | Размер пула соединений (default: 10) |
| `JWT_ACCESS_SECRET` | api | Секрет подписи access-токена (минимум 32 символа). Генерация: `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | api | Секрет подписи refresh-токена (минимум 32 символа) |
| `COOKIE_DOMAIN` | api | Домен HttpOnly-cookie (опционально; пусто — текущий хост) |
| `WEB_ORIGIN` | api | URL фронта для CORS (например, `http://localhost:5173`) |
| `LOG_LEVEL` | api | Уровень логов pino: `fatal`/`error`/`warn`/`info`/`debug`/`trace` (default: `info`) |
| `STORAGE_DRIVER` | api | Драйвер хранилища сканов контрактов. Сейчас поддерживается только `local` (default). Заготовка под будущий `s3` (Cloudflare R2). |
| `SCANS_STORAGE_DIR` | api | Каталог локального хранилища сканов относительно cwd процесса api (default: `./storage/scans`). Каталог создаётся автоматически при первой загрузке. |
| `JOBS_ENABLED` | api | Включить планировщик cron (`true` / `false`, default: `true`) |
| `ENABLE_API_DOCS` | api | Публиковать OpenAPI и Scalar UI в production (`true` / `false`, default: `false`) |
| `MIGRATIONS_DIR` | api | Каталог с SQL-миграциями для программного раннера `db:migrate:run` (default: `./src/db/migrations`; в Docker-образе — `/repo/apps/api/migrations`) |
| `APP_VERSION` | api | Версия, которую отдают `/health` и `/health/ready` (default: `dev`; в CI подставляется git-тег) |
| `SEED_ADMIN_LOGIN` | api (seed) | Логин администратора, создаваемого при `db:seed`. Пусто — админ не создаётся |
| `SEED_ADMIN_PASSWORD` | api (seed) | Пароль для дефолтных пользователей при `pnpm -F api db:seed` (default: `changeme`) |
| `SEED_DEFAULT_PLAYERS` | api (seed) | Создавать ли тестовых игроков `vamp`/`wolf` (`true` / `false`, default: `false`). На проде — `false` |
| `RUN_MIGRATIONS` | api (docker) | Накатывать ли миграции при старте контейнера; читается `docker-entrypoint.sh` (`true` / `false`, default: `true`) |
| `VITE_API_URL` | web (build) | Базовый URL API. Пусто — относительный `/api` (нужно при раздаче фронта и API с одного домена) |
| `VITE_WS_URL` | web (build) | URL WebSocket. Пусто — `wss://<текущий host>/ws` |

ENV-переменные `apps/api` валидируются через Zod при старте процесса — при невалидной конфигурации сервер падает с сообщением.

---

## Аутентификация и роли

Аутентификация: логин + пароль (`POST /api/auth/login`). Логин — латиница/цифры/`._-`, длина 3–64 символа. Пароли хешируются `argon2id`. Сессия — два HttpOnly+Secure cookie:

- `ka_access` — JWT access (TTL 1 час, `SameSite=Strict`).
- `ka_refresh` — JWT refresh (TTL 30 дней, путь `/api/auth`, ротируется при каждом `POST /api/auth/refresh`).

Refresh-сессии хранятся в таблице `auth_sessions` и могут быть отозваны (`POST /api/auth/logout` или вручную админом). На `POST /api/auth/login` действует rate-limit (5 попыток в минуту с одного IP). Все попытки входа пишутся в `access_log`.

Деактивированный аккаунт (`users.isActive = false`) войти не может: `POST /api/auth/login` отвечает `403 forbidden`, а `POST /api/auth/refresh` — `401` с очисткой cookie.

Эндпоинты:

| Метод | Путь | Описание |
|---|---|---|
| `POST` | `/api/auth/login` | Логин по `login`+паролю, выставляет cookie |
| `POST` | `/api/auth/refresh` | Ротация access/refresh по refresh-cookie |
| `POST` | `/api/auth/logout` | Отзыв refresh-сессии и очистка cookie |
| `POST` | `/api/auth/change-password` | Смена пароля (текущий + новый), сбрасывает `mustChangePassword` |
| `GET`  | `/api/auth/me` | Текущий пользователь (требует валидный access-cookie) |

Ролевая модель (RBAC, см. [PROJECT.md](./PROJECT.md)):

| Код | Роль | Описание |
|---|---|---|
| `emp` | Игрок | Базовый игровой пользователь, владеет одним персонажем |
| `head` | Руководитель компании | Управляет компанией и контрактами в её рамках |
| `info` | Менеджер информации | Просматривает рейтинги и контракты, ведёт фильмы и Оскары |
| `admin` | Мастер игры | Полный доступ: пользователи, ручные транзакции, рандомайзер |

Доступ к роутам контролируют middleware `requireAuth` и `requireRole(...roles)` из `apps/api/src/auth/`. Для проверки владения ресурсом используются хелперы `ownsPerson` / `ownsCompany`.

---

## Структура проекта

```
kinoacademia/
├── apps/
│   ├── web/          # React 19 + Vite 7 — фронтенд
│   └── api/          # Hono + Node.js — бэкенд
├── packages/
│   ├── shared/       # @kinoacademia/shared — Zod-схемы доменных DTO, константы ролей/рас/сфер, общий формат WS-событий и API-ошибок
│   └── config/       # Общие конфиги TS/Biome
├── data/             # Исходные материалы (макеты, модель данных)
├── PROJECT.md        # Концептуальное описание игры
└── README.md
```

---

## Скрипты

| Команда | Описание |
|---|---|
| `pnpm dev` | Запустить все приложения в dev-режиме |
| `pnpm build` | Собрать все приложения |
| `pnpm lint` | Проверить код через Biome |
| `pnpm lint:fix` | Автоисправление через Biome |
| `pnpm typecheck` | Проверить типы во всех пакетах |
| `pnpm test` | Запустить тесты во всех пакетах |

---

## Пакет `@kinoacademia/shared`

Единый источник правды для DTO, констант и Zod-схем. Используется одновременно фронтом (`apps/web`) и бэком (`apps/api`):

```ts
import { LoginInput, PersonDto, RoleCode } from '@kinoacademia/shared';
```

Структура (`packages/shared/src/`):

| Файл | Содержимое |
|---|---|
| `roles.ts`, `races.ts`, `branches.ts` | Константы и `z.enum` справочников + лейблы для UI |
| `user.ts` | `LoginInput`, `UserDto`, `CreateUserInput`, `ResetPasswordInput` |
| `person.ts` | `PersonDto`, `CreatePersonInput`, `UpdatePersonInput` |
| `company.ts` | `CompanyDto`, `CreateCompanyInput`, `UpdateCompanyInput` |
| `contract.ts` | `ContractKind`, `ContractStatusCode`, `ContractDto`, переходы статусов |
| `rating.ts` | DTO рейтингов, `TransferRatingInput`, `RatingSlot`, `ManualRatingInput` (`to` / `from`) |
| `film.ts`, `oscar.ts` | Фильмы, назначения ролей, номинации Оскар |
| `wsEvent.ts` | Универсальный формат сообщений WebSocket |
| `apiError.ts` | Единый формат API-ошибок (`code` / `message` / `details`) |
| `common.ts` | Базовые типы (`Uuid`, `IsoDateTime`) |

### Как добавить новую схему

1. Создать файл в `packages/shared/src/<domain>.ts`. Объявить Zod-схему и тип через `z.infer`:
   ```ts
   import { z } from 'zod';
   export const FooDto = z.object({ id: z.uuid(), name: z.string() });
   export type FooDto = z.infer<typeof FooDto>;
   ```
2. Добавить `export * from './<domain>';` в `packages/shared/src/index.ts`.
3. Покрыть smoke-тестом в `packages/shared/src/index.test.ts`.
4. Использовать на фронте и бэке через `import { FooDto } from '@kinoacademia/shared'`.

Сборка пакета не требуется — потребители читают `src/index.ts` напрямую через workspace-зависимость.

---

## Деплой

Продакшн — один VPS с Docker Compose. Фронт, API и Postgres живут в одной сети, наружу смотрит только Caddy, который автоматически выпускает и продлевает TLS-сертификат.

```
интернет → Caddy :80/:443
             ├── /api/*, /ws*, /health*  → api:3000   (Hono, node:22-slim)
             └── всё остальное           → web:80     (nginx со статикой Vite)
                                            api ↔ postgres:5432
```

Фронт и API отдаются **с одного домена** — это не деталь вкуса: cookie сессии выставлены с `SameSite=Strict`, а клиент по умолчанию ходит на относительный `/api` и `wss://<текущий host>/ws`. При разнесении на разные домены авторизация перестанет работать.

### Окружения

| Окружение | Как запускается |
|---|---|
| `local` | `docker compose up -d postgres` + `pnpm dev` (см. «Быстрый старт») |
| `production` | `docker-compose.prod.yml` + `.env.prod` на VPS, выкат по тегу через GitHub Actions |

Staging при необходимости поднимается тем же `docker-compose.prod.yml` с другим `.env.prod`, доменом и `-p` (имя проекта) — отдельных файлов не требуется.

### Файлы стека

| Файл | Назначение |
|---|---|
| `apps/api/Dockerfile` | Multi-stage сборка API: tsup-бандл + прод-зависимости без `tsup`/`tsx`/`drizzle-kit` |
| `apps/api/docker-entrypoint.sh` | Накатывает миграции (если `RUN_MIGRATIONS=true`) и запускает сервер |
| `apps/web/Dockerfile` | Сборка статики Vite и её раздача через `nginx:alpine` |
| `apps/web/nginx.conf` | SPA-fallback, gzip, кэш-заголовки |
| `docker-compose.prod.yml` | Прод-стек: caddy + web + api + postgres |
| `Caddyfile` | Роутинг и TLS |
| `.env.prod.example` | Шаблон продакшн-конфигурации |

Оба образа собираются **из корня репозитория** (нужен весь воркспейс):

```bash
docker build -f apps/api/Dockerfile -t kinoacademia-api .
docker build -f apps/web/Dockerfile -t kinoacademia-web .
```

### Подготовка сервера

1. Направить A-запись домена на IP сервера — без этого Caddy не выпустит сертификат.
2. Установить Docker с плагином Compose, открыть порты 80 и 443.
3. Создать каталог выката и положить туда конфигурацию:

```bash
mkdir -p /opt/kinoacademia && cd /opt/kinoacademia
# docker-compose.prod.yml и Caddyfile приедут сами при первом деплое,
# либо скопировать их вручную из репозитория
cp .env.prod.example .env.prod   # затем отредактировать
chmod 600 .env.prod
```

4. Заполнить `.env.prod`. Обязательно поменять: `DOMAIN`, `ACME_EMAIL`, `IMAGE_API`/`IMAGE_WEB`, `POSTGRES_PASSWORD`, `DATABASE_URL`, `WEB_ORIGIN`, `SEED_ADMIN_PASSWORD` и оба JWT-секрета (`openssl rand -hex 32` каждый). Полный перечень переменных — в разделе «Переменные окружения» и в комментариях самого шаблона.

Секреты хранятся только в `.env.prod` на сервере: в git этот файл не попадает (`.gitignore`), а деплой его не перезаписывает.

### Первый выкат

```bash
cd /opt/kinoacademia
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# Справочники, системная компания и определения cron-задач.
# Без сида планировщик не найдёт ни одной задачи.
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api node dist/seed.js

curl https://<домен>/health/ready
```

Миграции накатываются автоматически при старте контейнера api (`docker-entrypoint.sh` → `node dist/migrate.js`). Это безопасно при одной реплике; если реплик станет больше — выставить `RUN_MIGRATIONS=false` и накатывать отдельным шагом:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod run --rm api node dist/migrate.js
```

Планировщик cron работает внутри процесса api, поэтому при нескольких репликах `JOBS_ENABLED=true` должно остаться ровно у одной.

### Обновление и откат

Выкат делает GitHub Actions по тегу (см. ниже). Вручную:

```bash
cd /opt/kinoacademia
TAG=v0.2.0 docker compose -f docker-compose.prod.yml --env-file .env.prod pull
TAG=v0.2.0 docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Откат — тот же набор команд с предыдущим тегом. Образы версионируются, поэтому откат кода мгновенный; **миграции не откатываются** — если релиз менял схему несовместимо, потребуется восстановление из дампа.

### Данные и бэкапы

| Том | Что внутри | Чем грозит потеря |
|---|---|---|
| `postgres-data` | вся игровая база | полная потеря состояния игры |
| `scans-data` | сканы контрактов (`STORAGE_DRIVER=local`) | потеря загруженных документов |
| `caddy-data` | сертификаты TLS | повторный выпуск (упирается в лимиты Let's Encrypt) |

Дамп базы:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec -T postgres \
  pg_dump -U kinoacademia kinoacademia | gzip > backup-$(date +%F-%H%M).sql.gz
```

Перед игрой и перед каждым релизом со сменой схемы дамп стоит снимать обязательно; в остальное время — по cron на хосте.

### Смена домена

1. Обновить `DOMAIN` и `WEB_ORIGIN` в `.env.prod` (оба, иначе сломается CORS).
2. `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d` — Caddy выпустит новый сертификат сам.

### Мониторинг

| Точка | Что показывает |
|---|---|
| `GET /health` | liveness: процесс жив, зависимости не проверяются |
| `GET /health/ready` | readiness: доступность БД, состояние планировщика, версия. 503 при недоступной БД |
| `/status` | публичная страница состояния для игроков и мастеров, обновляется раз в 15 с |

`HEALTHCHECK` контейнера api и smoke-проверка после деплоя используют `/health/ready`.

### CI/CD

**`.github/workflows/ci.yml`** — на каждый push в `main` и на каждый pull request:

- `check` — `pnpm lint`, `typecheck`, `test`, `build`. Postgres не нужен: тесты мокают слой БД.
- `migrations` — поднимает чистый Postgres и прогоняет `db:migrate:run` дважды подряд плюс `db:seed`. Так ловятся миграции, работающие только инкрементально.
- `docker` — собирает оба образа без публикации.

**`.github/workflows/deploy.yml`** — на push тега `v*` (или вручную через workflow_dispatch):

1. собирает и пушит образы в GHCR с тегами `:<тег>` и `:latest`;
2. копирует `docker-compose.prod.yml` и `Caddyfile` на сервер по SSH (`.env.prod` не трогает);
3. делает `pull` + `up -d` и чистит старые образы;
4. проверяет `https://<домен>/health/ready` с ретраями — падение шага означает, что выкат не поднялся.

Секреты репозитория (Settings → Secrets and variables → Actions):

| Секрет | Значение |
|---|---|
| `SSH_HOST` | IP или хост VPS |
| `SSH_USER` | пользователь с правом запускать docker |
| `SSH_KEY` | приватный SSH-ключ для этого пользователя |
| `SSH_PORT` | порт SSH (опционально, по умолчанию 22) |
| `DEPLOY_PATH` | каталог выката, например `/opt/kinoacademia` |
| `PROD_DOMAIN` | домен для финальной проверки, например `kinoacademia.example.com` |

Публикация образов в GHCR идёт под встроенным `GITHUB_TOKEN` — отдельный токен реестра не нужен.

### Локальная проверка прод-стека

Прод-сборку можно поднять на машине разработчика, не выпуская сертификатов:

```bash
cp .env.prod.example .env.prod
# в .env.prod: DOMAIN=http://localhost  (префикс http:// отключает автоTLS),
# IMAGE_API=kinoacademia-api, IMAGE_WEB=kinoacademia-web, TAG=local,
# DATABASE_URL с хостом postgres, WEB_ORIGIN=http://localhost

docker build -f apps/api/Dockerfile -t kinoacademia-api:local .
docker build -f apps/web/Dockerfile -t kinoacademia-web:local .
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

Прод-стек использует собственное имя проекта (`kinoacademia-prod`), поэтому его тома не пересекаются с dev-стеком из `docker-compose.yml`.

---

## Контракты

Контракт связывает персонажа и компанию. Бывают двух видов:

- **Постоянный** — у персонажа может быть только один активный. Заключение нового автоматически разрывает старый со штрафом (см. «Штраф за разрыв постоянного контракта»).
- **Временный** — любое количество, но не более одного активного с одной и той же компанией. При заключении постоянного с этой же компанией активный временный разрывается автоматически.

Контракт проходит через статусную машину из 9 состояний (см. `contract_statuses`):

```mermaid
stateDiagram-v2
  [*] --> draft
  draft --> sent: submit (head)
  sent --> confirmed: confirm (person)
  sent --> rejected: reject (person)
  confirmed --> broken_company: breakByCompany (head)
  confirmed --> broken_person: breakByPerson (person, penalty)
  confirmed --> breakup_sent: requestEnd (person или head)
  breakup_sent --> breakup_confirmed: confirmEnd (другая сторона)
  breakup_sent --> breakup_rejected: rejectEnd (другая сторона)
  breakup_sent --> broken_company: breakByCompany (head)
  breakup_sent --> broken_person: breakByPerson (person, penalty)
  breakup_rejected --> breakup_sent: requestEnd
  breakup_rejected --> broken_company: breakByCompany (head)
  breakup_rejected --> broken_person: breakByPerson (person, penalty)
```

Расторжение по обоюдному согласию инициирует любая из сторон; инициатор запоминается в `breakup_initiated_by`, а подтвердить или отклонить запрос может **только противоположная сторона** (иначе `403 forbidden`, `contractCode = "forbidden"`). Из `breakup_rejected` контракт остаётся действующим, но его по-прежнему можно разорвать — иначе отказ в расторжении делал бы контракт вечным.

Каждый переход атомарно изменяет статус контракта и пишет запись в `contract_status_history` (одна транзакция БД).

### Бизнес-правила

- При `confirm` нового постоянного — старый **заключённый** постоянный того же персонажа автоматически переходит в `broken_person` с триггером штрафа (см. «Штраф за разрыв постоянного контракта»). Заключённым считается контракт в статусе `confirmed`, `breakup_sent` или `breakup_rejected`: непринятое предложение (`draft`/`sent`) от другой компании подтверждению не мешает.
- При `confirm` постоянного — заключённый временный с той же компанией автоматически расторгается по обоюдному согласию (`breakup_sent` → `breakup_confirmed`), без штрафа.
- На `breakByPerson` постоянного контракта дополнительно вызывается хук штрафа.
- Запрещённые переходы возвращают HTTP 409 с `code: "conflict"` и `details.contractCode = "invalid_transition"` (другие коды — `duplicate_temporary`, `permanent_exists_same_company`).

### Эндпоинты

| Метод | Путь | Роль | Описание |
|---|---|---|---|
| `GET` | `/api/contracts/my` | любая | Все контракты активного персонажа текущего пользователя |
| `POST` | `/api/contracts/my/:kind/:id/confirm` | владелец персонажа | 02 → 03 |
| `POST` | `/api/contracts/my/:kind/:id/reject` | владелец персонажа | 02 → 04 |
| `POST` | `/api/contracts/my/:kind/:id/break` | владелец персонажа | 03 → 06 (штраф) |
| `POST` | `/api/contracts/my/:kind/:id/request-end` | владелец персонажа | 03 → 07 |
| `POST` | `/api/contracts/my/:kind/:id/confirm-end` | владелец персонажа | 07 → 08 (если инициатор — компания) |
| `POST` | `/api/contracts/my/:kind/:id/reject-end` | владелец персонажа | 07 → 09 (если инициатор — компания) |
| `GET` | `/api/contracts/history` | info/admin | Лента переходов статусов с join по компании и персонажу. Фильтры query: `companyId`, `personId`, `limit` (≤500) |
| `GET` | `/api/contracts/company/:companyId` | head/admin/info | Контракты компании |
| `POST` | `/api/contracts/company/:companyId` | head своей / admin | Создать черновик (`{ kind, personId, companyId }`) |
| `POST` | `/api/contracts/company/:companyId/:kind/:id/submit` | head/admin | 01 → 02 |
| `POST` | `/api/contracts/company/:companyId/:kind/:id/break` | head/admin | 03 → 05 |
| `POST` | `/api/contracts/company/:companyId/:kind/:id/request-end` | head/admin | 03 → 07 |
| `POST` | `/api/contracts/company/:companyId/:kind/:id/confirm-end` | head/admin | 07 → 08 (если инициатор — персонаж) |
| `POST` | `/api/contracts/company/:companyId/:kind/:id/reject-end` | head/admin | 07 → 09 (если инициатор — персонаж) |

`:kind` — `permanent` или `temporary`. Тело POST — `{ comment?: string }` (см. `ContractActionInput` в `@kinoacademia/shared`).

Подробности и контекст реализации: см. документацию по контрактам в PROJECT.md.

---

## Фильмы и Оскары

Кинокомпании (`branchCode = 'cinema'`) заявляют фильмы, формируют съёмочные группы и подают номинации на Оскар. Результаты церемонии присуждает администратор; награждение атомарно закрывает номинацию и начисляет рейтинг победителю, его номинатору и проигравшим номинантам.

### Бизнес-правила

- Фильм может создать только кинокомпания. Для не-кинокомпаний создание фильма отбивается `409 conflict` (`filmCode = "not_cinema"`).
- В съёмочную группу можно назначить любого персонажа на роль из списка `FILM_ROLES` (`director`, `actor_lead_male`, `actress_lead_female`, `actor_supporting`, `screenwriter`, `cinematographer`, `visual_artist`).
- Количество персонажей на одной позиции не ограничено, и один персонаж может занимать несколько разных позиций. Единственный запрет — повторное назначение того же персонажа на ту же роль в том же фильме: `409 conflict` (`filmCode = "duplicate_assignment"`).
- Участника можно убрать из съёмочной группы, пока у него нет номинации на этот фильм: иначе номинация осталась бы без подтверждающего назначения, и удаление отбивается `409 conflict` (`filmCode = "assignment_nominated"`).
- Номинация привязывается к категории, фильму и персонажу. Соответствие категории и роли участника фильма строгое (`NOMINATION_TO_FILM_ROLE` из `@kinoacademia/shared`):

  | Категория | Требуемая роль персонажа |
  |---|---|
  | `best_film` | `director` |
  | `best_actor` | `actor_lead_male` |
  | `best_actress` | `actress_lead_female` |
  | `best_role_2` | `actor_supporting` |
  | `best_script` | `screenwriter` |
  | `best_camera` | `cinematographer` |
  | `best_visual` | `visual_artist` |
  | `contribution` | — (закрытая, без фильма) |

- Категория **«За вклад в киноискусство»** (`contribution`) — закрытая: подаётся только администратором, без фильма и компании, не доступна кинокомпаниям. Попытка `head` подать `contribution` отбивается `409 conflict` (`oscarCode = "closed_nomination"`).

### Начисления рейтинга

Константы вынесены в `packages/shared/src/oscar.ts`:

| Событие | Получатель | Сумма |
|---|---|---|
| Победа | персонаж-победитель (для `best_film` — режиссёр) | `OSCAR_WIN_PERSON_BONUS = 400` |
| Победа | компания, номинировавшая победителя, — **только если** у победителя есть с ней действующий контракт (любой, хоть временный) | `OSCAR_WIN_COMPANY_BONUS = 400` |
| Победа в номинации | каждый остальной номинант этой же номинации | `OSCAR_NOMINEE_BONUS = 100` |

Подача номинации рейтинг не начисляет — по правилам игры его получают только участники церемонии в момент присуждения. Все начисления идут как `kind = 'oscar'` в `rating_transactions` в постоянный рейтинг и фиксируются в общей истории рейтинга.

- Присуждение **закрывает номинацию**: второго победителя в той же категории быть не может, поэтому утешительные `OSCAR_NOMINEE_BONUS` выплачиваются всем остальным её номинантам сразу, по всем кинокомпаниям. Персона, номинированная в категории несколькими компаниями, получает утешительный приз один раз; победителю он не начисляется.
- Начисления персонажам отдельно в компанию не переносятся — постоянный рейтинг сотрудника сам зеркалится в `employee_permanent` компании его постоянного контракта (см. «Мгновенный перенос»). Бонус компании-номинатору — это **дополнительные** 400 сверх переноса, и получить их может другая компания, чем та, где персонаж работает постоянно.
- Закрытая номинация `contribution` присуждается **без каких-либо начислений**: конкурса в ней нет, рейтинг за неё администратор начисляет вручную под нужды игры. Её же не закрывает первое присуждение — вручить «За вклад» можно нескольким персонажам за игру.

### Стоимость подачи

Подача номинации списывает переменный рейтинг компании — поле `budget` в `company_ratings`. Стоимость прогрессивная и зависит от того, какая это по счёту номинация компании: считаются все её номинации за всё время, по всем фильмам (`computeNominationCost` в `packages/shared/src/oscar.ts`).

| Номинация компании | Стоимость |
|---|---|
| 1-я | 0 |
| 2-я и 3-я | 100 |
| 4-я | 200 |
| 5-я и далее | 300 |

- Списание идёт транзакцией `kind = 'budget'` в `rating_transactions` (в истории компании отображается как «Бюджет») и не влияет на постоянный рейтинг.
- Если бюджета меньше стоимости, подача отклоняется `409 conflict` (`oscarCode = "insufficient_budget"`) — номинация не создаётся.
- Подача администратором бесплатна (служебное действие), но учитывается в счётчике для последующих платных подач. Закрытая `contribution` бесплатна всегда — у неё нет фильма и компании.
- Внутри транзакции подачи строка `company_ratings` берётся под `SELECT … FOR UPDATE` до чтения счётчика, чтобы параллельные подачи не посчитали одну и ту же стоимость.

### Отзыв номинации

`DELETE /api/oscars/nominations/:id` — руководитель отзывает номинацию своей компании, администратор любую. Строка `oscars` удаляется, след остаётся в аудите (`oscar.withdraw`) и в истории рейтинга.

- Возвращается **стоимость верхней ступени шкалы**, то есть цена последней по счёту номинации компании (`computeNominationCost(count - 1)`), а не фактически списанная сумма за конкретную строку. За счёт этого подача и отзыв подряд всегда компенсируют друг друга на любой глубине шкалы. Обратная сторона: отзыв бесплатной (админской) номинации всё равно вернёт компании сумму по шкале.
- Возврат идёт транзакцией `kind = 'budget'` со знаком «+», строка блокируется так же, как при подаче.
- Победившую номинацию отозвать нельзя: `409 conflict` (`oscarCode = "already_awarded"`). Закрытая `contribution` отзывается без возврата и только администратором.
- После отзыва участника снова можно убрать из съёмочной группы — проверка `assignment_nominated` больше не срабатывает.

### Идемпотентность

Эндпоинт `POST /api/admin/oscars/:id/award` атомарен: внутри одной транзакции все строки номинации берутся под `SELECT … FOR UPDATE` (в порядке `id`, чтобы параллельные присуждения не поймали дедлок), флаг `isWinner` переводится в `true`, и сразу же выполняются все рейтинговые транзакции — победителю, компании-номинатору и проигравшим. Повторный вызов на ту же номинацию вернёт `409 conflict` с `details.oscarCode = "already_awarded"`, а присуждение другой строки уже присуждённой категории — `409 conflict` с `details.oscarCode = "nomination_already_awarded"`.

### Эндпоинты

| Метод | Путь | Роль | Описание |
|---|---|---|---|
| `POST` | `/api/films` | head/admin | Создать фильм (в своей кинокомпании; admin — в любой) |
| `POST` | `/api/films/:id/assignments` | head/admin | Добавить участника в съёмочную группу |
| `DELETE` | `/api/films/:id/assignments/:assignmentId` | head своей / admin | Убрать участника из съёмочной группы |
| `GET` | `/api/films` | любая | Список фильмов: info/admin — все, head — только своей компании |
| `GET` | `/api/films/company/:companyId` | head своей / info / admin | Фильмы компании |
| `GET` | `/api/films/:id` | любая | Карточка фильма с составом |
| `POST` | `/api/oscars/nominations` | head/admin | Подать номинацию (cinema-only; `contribution` — только admin) |
| `DELETE` | `/api/oscars/nominations/:id` | head своей / admin | Отозвать номинацию с возвратом в бюджет |
| `GET` | `/api/oscars` | любая | Все номинации: info/admin — все, head — только своей компании |
| `GET` | `/api/oscars/company/:companyId` | head своей / info / admin | Номинации компании |
| `GET` | `/api/oscars/person/:personId` | любая | Номинации персонажа (используется в досье) |
| `GET` | `/api/oscars/film/:filmId` | любая | Номинации фильма |
| `POST` | `/api/admin/oscars/:id/award` | admin | Атомарно присудить награду |

### Страницы фронта

- `/company/films` — список фильмов кинокомпании, заявка нового, редактирование съёмочной группы.
- `/company/oscar-nominations` — таблица поданных номинаций с действием «Отозвать» и форма подачи (категория фильтрует список персонажей по роли, в диалоге показана стоимость).
- `/info/films`, `/info/oscars` — аналитические таблицы для менеджера информации.
- `/admin/films` — все фильмы с фильтром по компании, создание фильма от имени любой кинокомпании.
- `/admin/oscars` — таблица номинаций с действиями «Присудить» и «Отозвать» (модалки подтверждения) и вкладка «Закрытая номинация» для категории `contribution`.
- В досье персонажа (`/admin/persons/:id`) вкладки «Фильмы» и «Оскары» показывают реальные данные.

WS-канал `oscars` транслирует события `oscar.nominated`, `oscar.awarded` и `oscar.withdrawn` (доступен ролям `head`, `info`, `admin`).

---

## Сканы контрактов

Сканы бумажных контрактов группируются в **сеты**: один сет — до 4 страниц (JPEG или PDF, до 10 МБ каждая) с общим названием (`caption`). Сет привязан к компании и может быть опционально привязан к конкретному контракту (постоянному или временному).

### Типы сетов

| Тип | Владелец | Кто загружает | Кто читает |
|---|---|---|---|
| Обычный | Компания-работодатель | `head` компании / `admin` | Владелец персонажа контракта, `head` компании, `info`, `admin` |
| Типовой (default) | Системная компания «Киноакадемия» (`isSystem = true`) | `admin` / `info` | Любой авторизованный пользователь |

Руководителем обычной компании можно назначить только персонажа, чей аккаунт имеет роль `head`; иначе `POST`/`PATCH /api/admin/companies` вернут 400. Без этой проверки назначенный глава не получил бы доступ к контрактам компании.

Системная компания создаётся сидом (`pnpm -F api db:seed`) и защищена уникальным индексом — второй экземпляр не появится. Она не играбельна: у неё **не может быть главы** (`PATCH /api/admin/companies/:id` c `headPersonId` вернёт 400) и **не может быть контрактов** (`POST /api/contracts/company/:companyId` вернёт 400), а `GET /api/companies/my` её никогда не возвращает. Иначе её глава упёрся бы в правило «типовые сеты грузят только `admin`/`info`» и не смог бы прикрепить сканы к своим контрактам.

### Хранилище

Абстракция `StorageAdapter` (интерфейс `save` / `read` / `delete`) изолирует место хранения от бизнес-логики. По умолчанию используется `LocalDiskAdapter` — файлы кладутся в `SCANS_STORAGE_DIR` по ключу `${companyId}/${setId}/${pageId}.${ext}`. Переезд на S3-совместимое хранилище (Cloudflare R2) сводится к новой реализации адаптера и переключению `STORAGE_DRIVER`.

При ошибке во время загрузки уже сохранённые файлы удаляются (rollback), запись в БД идёт единой транзакцией.

### Эндпоинты

| Метод | Путь | Роль | Описание |
|---|---|---|---|
| `POST` | `/api/scans` | `head` / `info` / `admin` | Multipart-загрузка сета: поля `companyId`, `caption`, `files[]` (1..4), опц. `contractKind` + `contractId`. Для системной компании контракт не поддерживается. |
| `GET` | `/api/scans/default` | любая | Сеты системной компании плюс её `companyId`. |
| `GET` | `/api/scans/company/:companyId` | `head` своей / `info` / `admin` / игрок с контрактом | Сеты компании (для игрока фильтруются по доступу — видит только те, что привязаны к его контрактам). |
| `GET` | `/api/scans/set/:setId` | по доступу к сету | Метаданные сета и список страниц. |
| `GET` | `/api/scans/page/:pageId` | по доступу к сету | Стрим файла с исходным `Content-Type` (`image/jpeg` или `application/pdf`), `Content-Disposition: inline`. |
| `DELETE` | `/api/scans/set/:setId` | `head` компании / `admin` (`info`/`admin` — для системной) | Удаляет сет и файлы. |

Каждая операция upload/delete пишется в `audit_log` (`scan.upload`, `scan.delete`).

### Страницы фронта

- `/company/documents` — сеты сканов компании: список + загрузка + удаление + просмотр (модалка с навигацией по страницам, PDF рендерится через `<iframe>`, JPEG — `<img>`).
- `/admin/default-scans` — управление типовыми контрактами (сеты системной компании).
- Карточки контрактов (игрока и компании) содержат секцию «Сканы»: показывают привязанный сет (если есть), позволяют открыть модалку просмотра; руководитель может прикрепить сканы напрямую из карточки.

### Ограничения

- Максимум 4 страницы на сет (`SCAN_MAX_PAGES` из `@kinoacademia/shared`).
- Максимум 10 МБ на файл (`SCAN_MAX_FILE_SIZE`).
- Разрешённые MIME: `image/jpeg`, `application/pdf` (`SCAN_ALLOWED_MIME`).
- Антивирус-сканирование не реализовано (в открытых вопросах).

---

## Постоянный рейтинг компании

`company_ratings` хранит слагаемые (`employee_permanent`, `manual_topup`, `oscar`, `penalties`), итог `now_permanent = employee_permanent + manual_topup + oscar + penalties` и его прошлое значение `last_permanent`. `budget` — аналог переменного рейтинга, вносится администратором и в постоянный рейтинг не входит; тратит его руководитель (номинации на Оскар и выплаты — см. «Выплаты из бюджета компании»). Итог и «прошлое» пересчитываются в `updateCompanyRatingAbsolute` (`modules/ratings/ratings-repo.ts`) при каждой правке любого постоянного слагаемого: `last_permanent` получает предыдущее `now_permanent`, как у персонажа. Правка одного лишь `budget` их не двигает.

**Зеркало постоянного контракта.** Постоянный рейтинг сотрудника не переходит компании, а учитывается у обоих сразу: при подтверждении постоянного контракта весь `person_ratings.now_permanent` (включая скрытый модификатор — он часть итога) прибавляется к `employee_permanent`, при завершении контракта — снимается, а у персонажа остаётся при нём. Потолок 100 к зеркалу не применяется: он относится только к плановым начислениям. Наработанное 12-часовыми начислениями компания при уходе сотрудника сохраняет, и отдельно получает штраф за разрыв. Механика: `attachPermanentEmployee`/`detachPermanentEmployee` в `modules/ratings/ratings.service.ts`, подключены к contracts.service хуками `setPermanentMirrorHooks` (регистрация — `wireContractRatingHooks` в `index.ts`); зеркало снимается **до** начисления штрафа, чтобы обе величины считались от одного и того же, доштрафного рейтинга. В `randomizer_capitalized` зеркало не попадает: пока сотрудник в штате, отмену модификатора отыгрывает мгновенный перенос дельты, и учёт в счётчике вычел бы ту же величину дважды.

**Капитализация (`capitalize_companies`, 05:55 и 17:55).** Начисление накопительное: за каждого сотрудника с активным постоянным контрактом компании прибавляется `min(person_ratings.now_permanent, CAPITALIZATION_PER_EMPLOYEE_CAP)` — потолок 100 пунктов за сотрудника за начисление защищает от гиперкапитализации (Звезда с рейтингом 1000 приносит те же 100). Со старта капитализация равна нулю и растёт от начисления к начислению. Начисления идут через `applyCapitalization` (`modules/ratings/ratings.service.ts`) — в журнал пишется прибавка (`kind = 'generated'`), в WS-канал `company:{id}` уходит `rating.updated`. Отдельно копится доля секретного модификатора (`randomizer_capitalized`), чтобы её можно было изъять при обнулении рандомайзера — см. раздел о рандомайзере.

Из-за накопительности повторный запуск начисляет ещё раз. Плановые запуски защищены unique-индексом `(job_key, slot)` в `job_runs`, но ручной «Запустить» на `/admin/jobs` использует слот `manual:<ISO>` и начислит капитализацию повторно — это осознанное поведение админского инструмента.

**Мгновенный перенос.** Любое изменение постоянного рейтинга сотрудника (ручное начисление, восхищение, Оскар, штраф, мастерский пересчёт) сразу меняет `employee_permanent` его компании на ту же дельту — `applyPersonDeltaPropagating` в `ratings.service.ts`; изменения только переменного рейтинга (`generated`) компанию не задевают. Штраф за разрыв постоянного контракта переносом не отражается: контракт к моменту начисления штрафа уже помечен `ended_at` (см. `contracts.service.ts`), поэтому компания получает только сам штраф (`penalties`), а падение рейтинга ушедшего сотрудника её не тянет.

**Разовые поступления.** Штрафы за разрыв, оскаровские и ручные начисления зачисляются в свои колонки в момент операции и сразу попадают в `now_permanent`.

---

## Выплаты из бюджета компании

Руководитель тратит бюджет своей компании сам, без администратора: это зарплата сотрудникам и прочие игровые расходы. Восхищение остаётся личной опцией персонажа (переменный рейтинг), выплата — функция компании.

- Списывается всегда `company_ratings.budget`, зачисляется всегда **постоянный** рейтинг получателя (`manual_topup`), сумма — целая и положительная.
- Получатель — либо любой открытый персонаж, либо любая другая компания (кроме системной). Платить своей же компании нельзя: бюджет свободно конвертировался бы в её собственный рейтинг (`self_transfer`, 409).
- Выплата сверх бюджета отклоняется целиком (`insufficient_rating`, 409): отрицательный бюджет в игре невозможен.
- Реализация — `payFromCompanyBudget` в `modules/ratings/ratings.service.ts`, тонкая обёртка над админской `manualTransaction`: одна транзакция БД, запись в `rating_transactions` (`kind = 'manual'`, донор — компания), события `rating.updated` в каналы `person:{id}` / `company:{id}` / `ratings:all`. Каждая выплата пишется в аудит (`company.payment`).
- Побочный эффект по правилам игры: выплата **своему** сотруднику на постоянном контракте тут же поднимает `employee_permanent` компании через мгновенный перенос — часть зарплаты возвращается в рейтинг работодателя.

### Эндпоинты

| Метод | Путь | Роль | Описание |
|---|---|---|---|
| `GET` | `/api/companies` | любая | Список играбельных компаний (системная не выдаётся) — справочник для выбора получателя. |
| `POST` | `/api/companies/:id/payments` | `head` (своя компания), `admin` | Выплата из бюджета: тело `{ recipientPersonId \| recipientCompanyId, amount, comment? }`, ответ — рейтинг компании-плательщика, рейтинг получателя и транзакция. |

---

## Штраф за разрыв постоянного контракта

При одностороннем разрыве постоянного контракта персонажем (`breakByPerson`, автоматический разрыв старого постоянного при подтверждении нового, админский force-break со стороны персонажа) с персонажа списывается **процент его постоянного рейтинга**, и та же сумма целиком зачисляется компании в `company_ratings.penalties`.

- **Звезда** теряет `BREAKUP_PENALTY_PERCENT_STAR` = **50%**, обычная персона — `BREAKUP_PENALTY_PERCENT_REGULAR` = **25%**. Формула — `computeBreakupPenalty` в `@kinoacademia/shared/rating`.
- База процента — постоянный рейтинг **без секретного модификатора**: `person_ratings.now_permanent − person_ratings.randomizer`. Скрытая мастерская добавка на размер штрафа не влияет.
- Статус Звезды берётся **как до разрыва**: разрывается постоянный контракт, поэтому применяется порог «с контрактом» (`STAR_RATING_WITH_CONTRACT` = 500), хотя `ended_at` к моменту начисления штрафа уже проставлен.
- При неположительной базе штраф равен нулю: рейтинг не списывается и транзакция `kind = 'penalty'` не создаётся.

Сумму считает `applyContractBreakPenalty` (`modules/ratings/ratings.service.ts`), подключённый к contracts.service через хук штрафа (`setPenaltyHook`): payload несёт только персонажа, компанию и причину — рейтингом владеет модуль ratings. Админский force-break сохраняет флаг «применять штраф», но своего размера не задаёт; точечная корректировка делается ручной транзакцией `kind = 'penalty'`.

Игроку в интерфейсе показывается только правило (50% / 25%), без абсолютной суммы — она косвенно раскрыла бы рандомайзер.

---

## Рейтинг: секретный модификатор (рандомайзер)

Постоянный рейтинг персонажа хранится в `person_ratings` покомпонентно (`base`, `randomizer`, `system_topup`, `manual_topup`, `oscar`, `penalties`), где `now_permanent = base + randomizer + system_topup + manual_topup + oscar − penalties`.

`randomizer` — **мастерский модификатор, о существовании которого игрок не знает**. Он лежит отдельной колонкой, чтобы «честный» рейтинг (каким он был бы без модификатора) в любой момент можно было восстановить обнулением одной колонки.

Правила видимости:

| Кому | Что видно |
|---|---|
| Игрок, руководитель компании, `info`, публичные экраны | `PersonRatingDto` без поля `randomizer`; модификатор свёрнут в `base` (`toPersonRatingDto` в `modules/ratings/ratings.service.ts`), поэтому сумма составляющих сходится с итогом |
| `admin` | `PersonRatingAdminDto` с сырой `base` и отдельным `randomizer` (`toPersonRatingAdminDto`); отдаётся только по `/api/admin/*` |

Транзакции `kind = 'randomizer'` пишутся в `rating_transactions` (журнал изменений рейтинга должен быть полным), но из игровых эндпоинтов исключаются на уровне SQL: `listPersonHistoryForPlayer` в `ratings.service.ts` передаёт `excludeKinds` в репозиторий. Явный запрос `GET /api/ratings/me/history?kind=randomizer` отдаёт пустой список, а не ошибку — ошибка выдала бы существование вида.

Жизненный цикл: `POST /api/admin/randomizer` проставляет значения всем открытым персонажам разом и при повторном запуске **заменяет** предыдущие (в БД пишется дельта `новое − текущее`, старое значение не хранится); `DELETE /api/admin/randomizer` зануляет колонку у всех — «восстановление справедливости».

Изменение `randomizer` — часть постоянного рейтинга персонажа, поэтому оно сразу переносится в `company_ratings.employee_permanent` работодателя (как и любое другое изменение постоянного рейтинга, см. «Постоянный рейтинг компании») и участвует в плановой капитализации.

`DELETE /api/admin/randomizer` одной операцией убирает оба следа: обнуляет модификатор у персонажей (мгновенный перенос откатывается той же дельтой) и снимает у компаний накопленную долю модификатора в капитализации — `company_ratings.randomizer_capitalized`. Доля считается на каждом начислении как `min(now_permanent, 100) − min(now_permanent − randomizer, 100)` (`employeeCapitalization` в `jobs/handlers/capitalizeCompanies.ts`), то есть «сколько компания получила с модификатором минус сколько получила бы без него». Колонка наружу не отдаётся — из неё видно, что скрытая механика существует. Доля начислений, сделанных до появления колонки (миграция `0012_randomizer_capitalized.sql`), не восстанавливается.

---

## Realtime (WebSocket)

`GET /ws` — WS-эндпоинт для realtime-обновлений рейтингов, контрактов и системных событий.

Авторизация: handshake выполняется с HttpOnly-cookie `ka_access` (тот же, что у REST). При отсутствии или невалидном JWT соединение закрывается с кодом `4401`. Heartbeat: сервер шлёт `{type:"ping"}` каждые 30 c, клиент отвечает `{type:"pong"}`; неотвечающие соединения дропаются через 60 c.

### Каналы

| Канал | Кто получает | События |
|---|---|---|
| `person:{id}` | владелец персонажа, `info`, `admin` | `rating.updated` |
| `company:{id}` | руководитель компании, `info`, `admin` | `rating.updated`, `contract.updated` |
| `ratings:all` | `info`, `admin` | любые `rating.updated` |
| `contracts:my` | любой авторизованный (фильтрация по `userId` персонажа) | `contract.updated` для своих контрактов |
| `oscars` | `head`, `info`, `admin` | (резерв под номинации/Оскары) |
| `system` | любой авторизованный | административные сообщения, ход cron-задач |

Подписка на чужой `person:{id}` или `company:{id}` отбивается ack `{type:"subscribe_error", channel, reason:"forbidden"}`.

### Формат событий (server → client)

```ts
type WsEvent<T> = {
  channel: string;
  type: string;       // напр. "rating.updated", "contract.updated"
  payload: T;
  ts: string;         // ISO timestamp
};
```

Также сервер шлёт служебные сообщения без поля `channel`: `{type:"ready"}` после успешного handshake, `{type:"ping"}` для heartbeat, `{type:"subscribed"|"unsubscribed", channel}` и `{type:"subscribe_error", channel, reason}` — ack-и на команды клиента.

### Команды клиента (client → server)

| Сообщение | Ответ сервера |
|---|---|
| `{type:"subscribe", channel}` | `{type:"subscribed", channel}` или `{type:"subscribe_error", channel, reason}` |
| `{type:"unsubscribe", channel}` | `{type:"unsubscribed", channel}` |
| `{type:"ping"}` | `{type:"pong"}` |
| `{type:"pong"}` | (ответ на server ping) |

При reconnect фронт-клиент автоматически переподписывается на каналы, активные на момент разрыва. Пропущенные за время разрыва события не воспроизводятся — состояние следует подтягивать из REST.

ENV: `VITE_WS_URL` (web) — URL WS-эндпоинта; по умолчанию `ws://<host>/ws` от текущей страницы.

---

## Разработка фронта

Фронтенд (`apps/web`) — React 19 + Vite 7 + TypeScript, Tailwind v4, shadcn/ui, TanStack Router (file-based) и TanStack Query. Точка входа — `src/main.tsx`, корневой роут — `src/routes/__root.tsx`.

```bash
pnpm -F web dev          # http://localhost:5173 (proxy /api и /ws → http://localhost:3000)
pnpm -F web build        # production-сборка
pnpm -F web test         # vitest + jsdom
pnpm -F web typecheck    # tsc --noEmit
```

ENV-переменные фронта (опционально):

| Переменная | Описание |
|---|---|
| `VITE_API_URL` | Базовый URL REST API (default: `/api`, через Vite proxy) |
| `VITE_WS_URL` | URL WebSocket-эндпоинта (default: `ws://<host>/ws`) |

### Авторизация и роуты

- `/login` — публичная страница входа. После успешного логина — редирект на `redirect` из query или `/`.
- `/_auth/*` — защищённый pathless layout: `beforeLoad` тянет `GET /api/auth/me`; при 401 — редирект на `/login` с сохранением исходного пути.
- HTTP-клиент `src/api/client.ts` (ofetch) автоматически вызывает `POST /api/auth/refresh` и повторяет запрос при 401.
- Меню в шапке (`RoleNav`) формируется по `me.user.roleCode` (см. `src/components/layout/RoleNav.tsx`).

### Страницы игрока

Доступны всем авторизованным пользователям, у которых открыт персонаж:

| Путь | Что внутри |
|---|---|
| `/my-rating` | Постоянный рейтинг (база, системные/ручные топапы, Оскар, штрафы), переменный рейтинг с обратным отсчётом до следующего обновления, кнопки «Выразить восхищение» и «Встречная проверка», история транзакций (виртуализация `@tanstack/react-virtual`). Realtime-обновления через WS-канал `person:{id}`. |
| `/admire` | Форма восхищения: выбор персонажа с поиском + сумма, списывается переменный рейтинг, ×5 для Звёзд (множитель применяет сервер), себе переводить нельзя. |
| `/compare` | Встречная проверка: сравнение своего постоянного рейтинга с рейтингом одного любого персонажа. Разбивка чужого рейтинга не показывается — сервер отдаёт только итог и статус Звезды. |
| `/my-contracts` | Вкладки «Постоянный / Временные / Архив», карточка контракта с компанией, статусом и датами, действия «Подтвердить / Отклонить / Подтвердить расторжение / Отклонить расторжение / Разорвать в одностороннем порядке» с модалкой подтверждения и предупреждением о штрафе при одностороннем разрыве. Realtime через WS-канал `contracts:my`. |

Все формы используют React Hook Form + Zod (`@kinoacademia/shared`). Мутации инвалидируют связанные query-ключи (`['ratings','me']`, `['ratings','me','history']`, `['contracts','my']`).

### Страницы руководителя компании

Доступны пользователям с ролью `head`. Корневой `/company` редиректит на `/company/rating`; пункты «Номинации» и «Фильмы» появляются в подменю только для компаний из сферы `cinema` (кинокомпании).

| Путь | Что внутри |
|---|---|
| `/company/rating` | Бюджет компании, постоянный рейтинг (`now_permanent`) с прошлым значением и разбивкой (капитализация сотрудников, ручные начисления, Оскар, штрафы), история транзакций (виртуализация). Realtime через WS-канал `company:{id}`. |
| `/company/contracts` | Вкладки «Активные / Черновики / Архив», создание черновика (выбор персонажа и типа), действия от лица компании: «Отправить персонажу», «Отправить на разрыв», «Разорвать в одностороннем порядке» (с модалкой подтверждения и комментарием). Realtime через WS-канал `company:{id}`. |
| `/company/payments` | Выплата из бюджета: переключатель «Персонажу / Компании», поиск получателя, сумма (не больше бюджета). В подменю компании пункта нет — вход с плитки «Выплата из бюджета» на главной руководителя. |
| `/company/documents` | Хранилище сканов контрактов. На данный момент — просмотр (загрузка появится позже). |
| `/company/oscar-nominations` | Только для кинокомпаний: номинирование сотрудников на Оскар (форма откроется в следующих задачах). |
| `/company/films` | Только для кинокомпаний: список фильмов компании и заявка нового (форма откроется в следующих задачах). |

Доступ к `/company/*` контролируется в `beforeLoad` через `meQueryOptions` (роль `head`), а cinema-only страницы дополнительно проверяют `company.branchCode === 'cinema'`. Карточка контракта и `ConfirmActionDialog` переиспользуются с раздела «Мои контракты».

### Страницы менеджера информации

Доступны пользователям с ролью `info` (и `admin`). Корневой `/info` редиректит на `/info/ratings`. Все страницы — плотные аналитические мониторы на `@tanstack/react-table` с расчётом на десктоп и iPad-планшеты (1024×768 без горизонтального скролла).

| Путь | Что внутри |
|---|---|
| `/info/ratings` | Сводные таблицы рейтингов персонажей и компаний. Поиск по имени, сортировка по любой колонке. Realtime через WS-канал `ratings:all`. |
| `/info/contracts-history` | Лента переходов статусов контрактов (`from → to` через `ContractStatusBadge`) с фильтрами по компании и персонажу. Источник — `GET /api/contracts/history`. |
| `/info/oscars` | Поданные номинации и результаты Оскара. Заглушка до реализации фильмов и Оскаров. |
| `/info/films` | Список заявленных фильмов с режиссёрами, актёрами и типами контрактов. Заглушка до реализации фильмов и Оскаров. |

Доступ к `/info/*` контролируется в `beforeLoad` (`roleCode in {info, admin}`, иначе редирект на `/no-access`). Эндпоинт `GET /api/ratings/all` дополнительно возвращает мапы `personNames`/`companyNames`, чтобы избежать N+1 запросов с фронта. Разбивку персонажей он отдаёт свёрнутой; полную (с рандомайзером) даёт только `GET /api/admin/ratings/all` для роли `admin` — её использует досье персонажа в админке.

### Темы

Тем ровно две — светлая и тёмная (плюс «системная», которая выбирает одну из них), одинаковые для всех пользователей. Zustand-store `src/stores/themeStore.ts` пишет атрибут `data-theme` на `<html>`, синхронизируется с `prefers-color-scheme` и хранит выбор в localStorage. Токены задаются OKLCH-переменными в `apps/web/src/index.css`: база — тёмная тема в блоке `@theme`, светлая переопределяет её в `[data-theme="light"]`.

Оформления, зависящего от расы персонажа, нет намеренно: раса — скрытая игровая информация, и по акцентному цвету или эмблеме её было бы видно со стороны.

---

## Документация

- [PROJECT.md](./PROJECT.md) — концепция и правила игры
- `http://localhost:3000/api/docs` — интерактивная OpenAPI-спека (dev)
- `http://localhost:3000/api/openapi.json` — OpenAPI 3.1 спецификация

### Плановые операции (cron)

Начисление и обнуление переменного рейтинга, а также капитализация компаний пишут записи в `rating_transactions` с `kind = 'generated'` — по правилам игры в журнале должны быть все изменения рейтинга, включая автоматические.

Расписания плановых задач (генерация и обнуление переменного рейтинга, капитализация компаний — по умолчанию `55 5,17 * * *`, очистка refresh-сессий) **хранятся в БД** (`job_definitions`) и редактируются администратором на странице `/admin/jobs` без рестарта процесса. Дефолтные `cron_expr`, `timezone` и параметры задаются сидом (`pnpm -F api db:seed`); существующие строки сид не переписывает, поэтому смена дефолтного расписания приезжает миграцией (`0011_company_permanent_rating.sql`). REST-API: `GET /api/admin/jobs`, `PATCH /api/admin/jobs/:key`, `POST /api/admin/jobs/:key/run`, `GET /api/admin/jobs/:key/runs`. Журнал запусков пишется в `job_runs`, идемпотентность — через unique-индекс `(job_key, slot)`.

---

## Подготовка игры: создание аккаунтов

Перед началом игры администратор создаёт учётные записи игроков и привязывает персонажей. Все шаги доступны через веб-админку (`/admin/*`) или REST API.

### Работа через веб-админку

Зайдите под учёткой администратора и перейдите в раздел «Админка» в верхнем меню. Боковое меню содержит все разделы:

1. **Пользователи** (`/admin/users`) — создание аккаунтов (одноразовый временный пароль показывается один раз, есть кнопка «Скопировать»), смена роли, активация/деактивация, сброс пароля.
2. **Персонажи** (`/admin/persons`) — создание персонажа и его привязка к пользователю; досье (`/admin/persons/:id`) с вкладками «Рейтинг», «Контракты», «Фильмы», «Оскары» и кнопками «Открыть/Закрыть» с подтверждением.
3. **Рандомайзер** (`/admin/randomizer`) — задайте диапазон ±X, нажмите «Сгенерировать» для предпросмотра, затем «Применить»; кнопка «Обнулить рандомайзер» снимает текущие значения у всех персонажей (требует подтверждения). Модификатор секретный: игроку он не показывается ни строкой в разбивке, ни записью в истории — см. «Рейтинг: секретный модификатор».
4. **Транзакции** (`/admin/transactions`) — ручные транзакции рейтинга. Форма состоит из двух блоков:
   - **Откуда** — «Админский ресурс» (неисчерпаемый, ничего не списывается) либо конкретный персонаж/компания и часть его рейтинга. При переводе от персонажа или компании эта сумма у источника **снимается**; постоянный рейтинг всегда списывается из «ручной» составляющей (`manual_topup`).
   - **Кому** — персонаж или компания, часть рейтинга и — для постоянного рейтинга — составляющая: `manual`, `oscar`, `penalty`, а для персонажа ещё и `base` (стартовый рейтинг).

   Части рейтинга (`slot`): у персонажа `permanent` / `variable`, у компании `permanent` / `budget`. Допустимы все сочетания сторон, кроме одного: **переменный рейтинг персонажа пополняется только из админского ресурса** — переливать в него чужой рейтинг нельзя.

   Режим «процент» доступен единственному сочетанию: платит компания со своего **постоянного счёта**, и процент считается от её постоянного рейтинга (`company_ratings.now_permanent`) на момент операции. В остальных случаях опция заблокирована. Форма показывает получившуюся абсолютную величину до отправки; она считается той же функцией `computePercentAmount` из `@kinoacademia/shared`, что и на сервере, поэтому предпросмотр совпадает с транзакцией. Составляющая `base` вносится только абсолютной величиной.

   Отрицательный рейтинг в игре невозможен (единственное исключение — скрытый мастерский модификатор), поэтому транзакция, уводящая затронутую часть в минус, отклоняется целиком с кодом `insufficient_rating` (HTTP 409). Без источника допустима отрицательная сумма — это прямое списание у получателя, тоже в пределах его остатка.

   Транзакция пишется одной строкой в `rating_transactions` (заполнены и `donor_*`, и `recipient_*`), поэтому у источника она видна в истории со знаком «−», у получателя — со знаком «+». Если источник или получатель — сотрудник на постоянном контракте, изменение его постоянного рейтинга обычным образом переносится в капитализацию его компании (см. «Мгновенный перенос»).
5. **Контракты** (`/admin/contracts`) — сводка по статусам и лента контрактных событий по всем компаниям.
6. **Задачи (cron)** (`/admin/jobs`) — редактирование `cron_expr`, `timezone`, `enabled`, JSON-параметров без перезапуска; ручной запуск задачи; история выполнения на странице `/admin/jobs/:key`.

Все опасные операции требуют подтверждения через диалог. Каждая операция фиксируется в `audit_log` и отображается в блоках «Аудит» рядом с действием (`GET /api/admin/audit?...`).

### Работа через REST API

### 1. Создать аккаунт игрока

```http
POST /api/admin/users
Authorization: (admin cookie)

{
  "login": "player1",
  "roleCode": "emp"
}
```

Ответ содержит объект `user` и одноразовый `temporaryPassword` — **сохраните его и передайте игроку** (вручную, распечатайте или отправьте сообщением). После первого входа игрок меняет пароль через настройки.

Доступные роли: `emp` (игрок), `head` (руководитель компании), `info` (менеджер информации), `admin` (мастер игры).

### 2. Создать персонажа и привязать к аккаунту

```http
POST /api/admin/persons
Authorization: (admin cookie)

{
  "userId": "<id из шага 1>",
  "displayName": "Имя Персонажа",
  "raceCode": "homo",
  "roleCode": "emp",
  "age": 35
}
```

Один аккаунт — один открытый персонаж. Если персонаж уже есть, сначала закройте его (ротация).

### 3. Сброс пароля

```http
POST /api/admin/users/:id/reset-password
```

Возвращает новый `temporaryPassword`. Старый пароль сразу становится недействительным.

### 4. Ротация персонажа

Если нужно заменить персонажа игрока (например, персонаж выбывает по сюжету):

```http
PATCH /api/admin/persons/:oldPersonId
{ "isOpen": false }

POST /api/admin/persons
{ "userId": "<тот же userId>", "displayName": "Новый Персонаж", ... }
```

Закрытый персонаж **не отображается в публичных списках**, но виден в досье (`GET /api/admin/persons/:id/dossier`).

### 5. Блокировка аккаунта

```http
PATCH /api/admin/users/:id
{ "isActive": false }
```

Заблокированный пользователь сразу теряет доступ: логин отбивается `403`, а обновление сессии по refresh-cookie — `401`.

### Публичный экран рейтингов

Для отображения лидерборда персонажей и компаний на большом экране (проектор, телевизор, монитор) предусмотрена страница `/display/leaderboard`. Она работает в полноэкранном режиме без шапки и меню, обновляется в реальном времени через WebSocket-канал `ratings:all` и помещается на FullHD/4K без скролла.

#### Параметры URL

| Параметр | Значения | По умолчанию | Описание |
|---|---|---|---|
| `layout` | `two-columns` / `rotate` / `persons` / `companies` | `two-columns` | Раскладка: две колонки на одном экране, ротация одиночных таблиц, только персонажи, только компании |
| `limit` | `top10` / `all` | `all` | Показывать топ-10 или все строки |
| `interval` | целое 2–120 | `10` | Интервал ротации в секундах (для `layout=rotate`) |

Примеры:
- `/display/leaderboard` — две колонки, все строки.
- `/display/leaderboard?layout=rotate&interval=15` — карусель «персонажи ↔ компании» каждые 15 секунд.
- `/display/leaderboard?layout=persons&limit=top10` — только топ-10 персонажей на весь экран.

#### Настройка перед игрой

1. Через `/admin/users` создайте отдельный технический аккаунт с ролью `info` (например, `display`), сохраните пароль.
2. На компьютере, подключённом к экрану-монитору, откройте `/login`, войдите под этим аккаунтом.
3. Перейдите на `/display/leaderboard` (с нужными query-параметрами) и переведите браузер в полноэкранный режим (`F11`).
4. Отключите спящий режим и заставку ОС, чтобы экран не гас.

Сессия живёт до 30 дней (refresh-cookie `ka_refresh`), access-cookie обновляется автоматически — переподключение в течение суток не потребуется.

### Справочные коды

| Расы (`raceCode`) | Роли (`roleCode`) |
|---|---|
| `homo` — Человек | `emp` — Игрок |
| `vamp` — Вампир | `head` — Руководитель компании |
| `wolf` — Ликан | `info` — Менеджер информации |
| `corv` — Корвинус | `admin` — Администратор |
| `vamp-corv` — Вампир-Корвинус | |
| `wolf-corv` — Ликан-Корвинус | |

Раса — скрытая игровая информация: её задаёт и видит только админ. Игровые эндпоинты (`GET /api/auth/me`, `GET /api/persons`, `GET /api/ratings/all`) `raceCode` не отдают, в UI игроков её нигде нет. Расу содержат только админские ответы (`AdminPersonDto`, `PersonDossierDto`).

---

## Готовность к игре

> Чек-лист заполнится после выполнения задачи 19.
