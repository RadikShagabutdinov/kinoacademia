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
| `pnpm -F api db:migrate` | Применить миграции к БД из `DATABASE_URL` |
| `pnpm -F api db:seed` | Заполнить справочники + создать дефолтных пользователей: `admin` (роль `admin`), `vamp` (`emp`, раса `vamp`, персонаж «Вампир»), `wolf` (`emp`, раса `wolf`, персонаж «Ликан»). Все пароли — из `SEED_ADMIN_PASSWORD` |
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
| `SEED_ADMIN_PASSWORD` | api (seed) | Пароль для дефолтных пользователей при `pnpm -F api db:seed` (default: `changeme`) |

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
| `rating.ts` | DTO рейтингов, `TransferRatingInput`, `ManualRatingInput` |
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

> Раздел заполнится после выполнения задачи 18.

---

## Контракты

Контракт связывает персонажа и компанию. Бывают двух видов:

- **Постоянный** — у персонажа может быть только один активный. Заключение нового автоматически разрывает старый со штрафом.
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

- При `confirm` нового постоянного — старый **заключённый** постоянный того же персонажа автоматически переходит в `broken_person` с триггером штрафа (`BREAKUP_PENALTY` из `@kinoacademia/shared/rating`). Заключённым считается контракт в статусе `confirmed`, `breakup_sent` или `breakup_rejected`: непринятое предложение (`draft`/`sent`) от другой компании подтверждению не мешает.
- При `confirm` постоянного — заключённый временный с той же компанией автоматически расторгается по обоюдному согласию (`breakup_sent` → `breakup_confirmed`), без штрафа.
- На `breakByPerson` постоянного контракта дополнительно вызывается хук штрафа (само начисление в задаче 07).
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

Кинокомпании (`branchCode = 'cinema'`) заявляют фильмы, формируют съёмочные группы и подают номинации на Оскар. Результаты церемонии присуждает администратор; награждение атомарно начисляет рейтинг персонажу и компании-создателю фильма.

### Бизнес-правила

- Фильм может создать только кинокомпания. Для не-кинокомпаний создание фильма отбивается `409 conflict` (`filmCode = "not_cinema"`).
- В съёмочную группу можно назначить любого персонажа на роль из списка `FILM_ROLES` (`director`, `actor_lead_male`, `actress_lead_female`, `actor_supporting`, `screenwriter`, `cinematographer`, `visual_artist`).
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
| Победа | персонаж | `OSCAR_WIN_PERSON_BONUS = 200` |
| Победа | компания-создатель фильма | `OSCAR_WIN_COMPANY_BONUS = 500` |

Подача номинации рейтинг не начисляет — по правилам игры его получают только победители церемонии. Все начисления идут как `kind = 'oscar'` в `rating_transactions` и фиксируются в общей истории рейтинга. Для закрытой номинации `contribution` компании ничего не начисляется (фильма нет).

### Идемпотентность

Эндпоинт `POST /api/admin/oscars/:id/award` атомарен: внутри одной транзакции выполняется `SELECT … FOR UPDATE` номинации, флаг `isWinner` переводится в `true`, и сразу же выполняются обе рейтинговые транзакции. Повторный вызов на ту же номинацию вернёт `409 conflict` с `details.oscarCode = "already_awarded"`.

### Эндпоинты

| Метод | Путь | Роль | Описание |
|---|---|---|---|
| `POST` | `/api/films` | head/admin | Создать фильм (в своей кинокомпании; admin — в любой) |
| `POST` | `/api/films/:id/assignments` | head/admin | Добавить участника в съёмочную группу |
| `GET` | `/api/films` | любая | Список фильмов: info/admin — все, head — только своей компании |
| `GET` | `/api/films/company/:companyId` | head своей / info / admin | Фильмы компании |
| `GET` | `/api/films/:id` | любая | Карточка фильма с составом |
| `POST` | `/api/oscars/nominations` | head/admin | Подать номинацию (cinema-only; `contribution` — только admin) |
| `GET` | `/api/oscars` | любая | Все номинации: info/admin — все, head — только своей компании |
| `GET` | `/api/oscars/company/:companyId` | head своей / info / admin | Номинации компании |
| `GET` | `/api/oscars/person/:personId` | любая | Номинации персонажа (используется в досье) |
| `GET` | `/api/oscars/film/:filmId` | любая | Номинации фильма |
| `POST` | `/api/admin/oscars/:id/award` | admin | Атомарно присудить награду |

### Страницы фронта

- `/company/films` — список фильмов кинокомпании, заявка нового, редактирование съёмочной группы.
- `/company/oscar-nominations` — таблица поданных номинаций и форма подачи (категория фильтрует список персонажей по роли).
- `/info/films`, `/info/oscars` — аналитические таблицы для менеджера информации.
- `/admin/films` — все фильмы с фильтром по компании, создание фильма от имени любой кинокомпании.
- `/admin/oscars` — таблица номинаций с действием «Присудить» (модалка подтверждения) и вкладка «Закрытая номинация» для категории `contribution`.
- В досье персонажа (`/admin/persons/:id`) вкладки «Фильмы» и «Оскары» показывают реальные данные.

WS-канал `oscars` транслирует события `oscar.nominated` и `oscar.awarded` (доступен ролям `head`, `info`, `admin`).

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

Капитализация компаний (`capitalize_companies`) включает `randomizer` в сумму постоянных рейтингов сотрудников: модификатор — часть постоянного рейтинга. `employee_permanent` пересчитывается абсолютной величиной, поэтому после обнуления рандомайзера компании выравниваются на ближайшем запуске задачи.

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
| `/my-rating` | Постоянный рейтинг (база, системные/ручные топапы, Оскар, штрафы), переменный рейтинг с обратным отсчётом до следующего обновления, форма «Выразить восхищение» (выбор персонажа + сумма, ×5 для Звёзд, оптимистичное обновление через `useOptimistic`), история транзакций (виртуализация `@tanstack/react-virtual`). Realtime-обновления через WS-канал `person:{id}`. |
| `/my-contracts` | Вкладки «Постоянный / Временные / Архив», карточка контракта с компанией, статусом и датами, действия «Подтвердить / Отклонить / Подтвердить расторжение / Отклонить расторжение / Разорвать в одностороннем порядке» с модалкой подтверждения и предупреждением о штрафе при одностороннем разрыве. Realtime через WS-канал `contracts:my`. |

Все формы используют React Hook Form + Zod (`@kinoacademia/shared`). Мутации инвалидируют связанные query-ключи (`['ratings','me']`, `['ratings','me','history']`, `['contracts','my']`).

### Страницы руководителя компании

Доступны пользователям с ролью `head`. Корневой `/company` редиректит на `/company/rating`; пункты «Номинации» и «Фильмы» появляются в подменю только для компаний из сферы `cinema` (кинокомпании).

| Путь | Что внутри |
|---|---|
| `/company/rating` | Бюджет компании и постоянный рейтинг с разбивкой (капитализация сотрудников, ручные начисления, Оскар, штрафы), история транзакций (виртуализация). Realtime через WS-канал `company:{id}`. |
| `/company/contracts` | Вкладки «Активные / Черновики / Архив», создание черновика (выбор персонажа и типа), действия от лица компании: «Отправить персонажу», «Отправить на разрыв», «Разорвать в одностороннем порядке» (с модалкой подтверждения и комментарием). Realtime через WS-канал `company:{id}`. |
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

Расписания плановых задач (генерация и обнуление переменного рейтинга, капитализация компаний, очистка refresh-сессий) **хранятся в БД** (`job_definitions`) и редактируются администратором на странице `/admin/jobs` без рестарта процесса. Дефолтные `cron_expr`, `timezone` и параметры задаются сидом (`pnpm -F api db:seed`). REST-API: `GET /api/admin/jobs`, `PATCH /api/admin/jobs/:key`, `POST /api/admin/jobs/:key/run`, `GET /api/admin/jobs/:key/runs`. Журнал запусков пишется в `job_runs`, идемпотентность — через unique-индекс `(job_key, slot)`.

---

## Подготовка игры: создание аккаунтов

Перед началом игры администратор создаёт учётные записи игроков и привязывает персонажей. Все шаги доступны через веб-админку (`/admin/*`) или REST API.

### Работа через веб-админку

Зайдите под учёткой администратора и перейдите в раздел «Админка» в верхнем меню. Боковое меню содержит все разделы:

1. **Пользователи** (`/admin/users`) — создание аккаунтов (одноразовый временный пароль показывается один раз, есть кнопка «Скопировать»), смена роли, активация/деактивация, сброс пароля.
2. **Персонажи** (`/admin/persons`) — создание персонажа и его привязка к пользователю; досье (`/admin/persons/:id`) с вкладками «Рейтинг», «Контракты», «Фильмы», «Оскары» и кнопками «Открыть/Закрыть» с подтверждением.
3. **Рандомайзер** (`/admin/randomizer`) — задайте диапазон ±X, нажмите «Сгенерировать» для предпросмотра, затем «Применить»; кнопка «Обнулить рандомайзер» снимает текущие значения у всех персонажей (требует подтверждения). Модификатор секретный: игроку он не показывается ни строкой в разбивке, ни записью в истории — см. «Рейтинг: секретный модификатор».
4. **Транзакции** (`/admin/transactions`) — ручное начисление/списание рейтинга персонажу или компании. Типы: `manual`, `oscar`, `penalty` (абсолютно или процентом), а также `base` — стартовый рейтинг персонажа и `budget` — бюджет компании; последние два вносятся только абсолютной величиной и только своему типу получателя.
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
