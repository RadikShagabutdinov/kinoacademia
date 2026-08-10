import { and, eq } from 'drizzle-orm';
import { hashPassword } from '@/auth/password';
import { env } from '@/env';
import { allHandlers } from '@/jobs';
import { db, queryClient } from './client';
import {
  branches,
  companies,
  contractStatuses,
  jobDefinitions,
  nominations,
  persons,
  races,
  roles,
  users,
} from './schema';

const ROLES = [
  { code: 'emp', name: 'Игрок' },
  { code: 'head', name: 'Руководитель компании' },
  { code: 'info', name: 'Менеджер информации' },
  { code: 'admin', name: 'Администратор' },
];

const RACES = [
  { code: 'homo', name: 'Человек' },
  { code: 'vamp', name: 'Вампир' },
  { code: 'wolf', name: 'Ликан' },
  { code: 'corv', name: 'Корвинус' },
  { code: 'vamp-corv', name: 'Вампир-Корвинус' },
  { code: 'wolf-corv', name: 'Ликан-Корвинус' },
];

const BRANCHES = [
  { code: 'cinema', name: 'Кинокомпании' },
  { code: 'farm', name: 'Большая фарма' },
  { code: 'infra', name: 'Инфраструктура отеля' },
  { code: 'other', name: 'Остальное' },
  { code: 'jobless', name: 'Без компании' },
];

const CONTRACT_STATUSES = [
  { code: 'draft', name: 'Черновик' },
  { code: 'sent', name: 'Отправлен на подтверждение' },
  { code: 'confirmed', name: 'Подтверждён' },
  { code: 'rejected', name: 'Отклонён' },
  { code: 'breakup_sent', name: 'Отправлен на разрыв' },
  { code: 'breakup_confirmed', name: 'Разрыв подтверждён' },
  { code: 'breakup_rejected', name: 'Разрыв отклонён' },
  { code: 'broken_company', name: 'Односторонний разрыв компанией' },
  { code: 'broken_person', name: 'Односторонний разрыв персонажем' },
];

const NOMINATIONS = [
  { code: 'best_film', name: 'Лучший фильм', description: 'Режиссёр' },
  { code: 'best_actor', name: 'Лучший актёр 1-го плана', description: 'Мужчина' },
  { code: 'best_actress', name: 'Лучшая актриса 1-го плана', description: 'Женщина' },
  { code: 'best_role_2', name: 'Лучшая роль 2-го плана', description: 'Любой актёр' },
  { code: 'best_script', name: 'Лучший сценарий', description: 'Сценарист' },
  { code: 'best_camera', name: 'Лучшая операторская работа', description: 'Оператор' },
  {
    code: 'best_visual',
    name: 'Лучшая работа с визуальным наполнением',
    description: 'Рабочий сцены',
  },
  { code: 'contribution', name: 'За вклад в киноискусство', description: 'Закрытая номинация' },
];

async function seedAdmin() {
  const login = process.env.SEED_ADMIN_LOGIN;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!login || !password) {
    console.log('⚠️  SEED_ADMIN_LOGIN / SEED_ADMIN_PASSWORD not set — skipping admin creation.');
    return;
  }

  const existing = await db.select().from(users).where(eq(users.login, login)).limit(1);
  if (existing.length > 0) {
    console.log(`ℹ️  Admin "${login}" already exists — skipping.`);
    return;
  }

  const passwordHash = await hashPassword(password);
  await db.insert(users).values({ login, passwordHash, roleCode: 'admin', isActive: true });
  console.log(`✅ Admin created: ${login}`);
}

type DefaultPlayer = {
  login: string;
  raceCode: 'vamp' | 'wolf';
  displayName: string;
};

const DEFAULT_PLAYERS: DefaultPlayer[] = [
  { login: 'vamp', raceCode: 'vamp', displayName: 'Вампир' },
  { login: 'wolf', raceCode: 'wolf', displayName: 'Ликан' },
];

async function seedDefaultPlayers() {
  if (!env.SEED_DEFAULT_PLAYERS) {
    console.log('ℹ️  SEED_DEFAULT_PLAYERS=false — skipping default players.');
    return;
  }

  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) return;

  const passwordHash = await hashPassword(password);

  for (const player of DEFAULT_PLAYERS) {
    const existing = await db.select().from(users).where(eq(users.login, player.login)).limit(1);

    let userId: string;
    if (existing.length > 0) {
      const row = existing[0];
      if (!row) continue;
      userId = row.id;
      console.log(`ℹ️  Player "${player.login}" already exists — skipping user creation.`);
    } else {
      const inserted = await db
        .insert(users)
        .values({
          login: player.login,
          passwordHash,
          roleCode: 'emp',
          isActive: true,
        })
        .returning({ id: users.id });
      const row = inserted[0];
      if (!row) continue;
      userId = row.id;
      console.log(`✅ Player created: ${player.login} (${player.raceCode})`);
    }

    const openPerson = await db
      .select()
      .from(persons)
      .where(and(eq(persons.userId, userId), eq(persons.isOpen, true)))
      .limit(1);

    if (openPerson.length > 0) {
      console.log(`ℹ️  Person for "${player.login}" already exists — skipping.`);
      continue;
    }

    await db.insert(persons).values({
      userId,
      displayName: player.displayName,
      raceCode: player.raceCode,
      roleCode: 'emp',
      isOpen: true,
    });
    console.log(`✅ Person created: ${player.displayName} (${player.raceCode})`);
  }
}

async function main() {
  console.log('Seeding lookups...');

  await db.insert(roles).values(ROLES).onConflictDoNothing();
  await db.insert(races).values(RACES).onConflictDoNothing();
  await db.insert(branches).values(BRANCHES).onConflictDoNothing();
  await db.insert(contractStatuses).values(CONTRACT_STATUSES).onConflictDoNothing();
  await db.insert(nominations).values(NOMINATIONS).onConflictDoNothing();

  await seedAdmin();
  await seedDefaultPlayers();
  await seedSystemCompany();
  await seedJobDefinitions();

  console.log('Done.');
}

const SYSTEM_COMPANY_NAME = 'Киноакадемия';

async function seedSystemCompany() {
  const existing = await db.select().from(companies).where(eq(companies.isSystem, true)).limit(1);
  if (existing.length > 0) {
    console.log('ℹ️  System company already exists — skipping.');
    return;
  }
  await db
    .insert(companies)
    .values({
      name: SYSTEM_COMPANY_NAME,
      branchCode: 'jobless',
      isSystem: true,
    })
    .onConflictDoNothing({ target: companies.name });
  console.log(`✅ System company created: ${SYSTEM_COMPANY_NAME}`);
}

async function seedJobDefinitions() {
  const rows = allHandlers().map((h) => ({
    key: h.key,
    name: h.name,
    description: h.description,
    cronExpr: h.defaultCron,
    timezone: h.defaultTimezone,
    enabled: true,
    params: h.defaultParams as Record<string, unknown>,
  }));
  if (rows.length === 0) return;
  await db.insert(jobDefinitions).values(rows).onConflictDoNothing({ target: jobDefinitions.key });
  console.log(`✅ Job definitions seeded: ${rows.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await queryClient.end();
  });
