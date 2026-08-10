import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '@/env';
import { logger } from '@/logger';

/**
 * Программный накат миграций — используется в продакшн-образе, где drizzle-kit
 * (devDependency) недоступен. Отдельное соединение с max: 1: drizzle берёт
 * advisory lock на время наката и соединение нужно закрыть по завершении.
 */
async function main() {
  const client = postgres(env.DATABASE_URL, { max: 1 });
  try {
    logger.info({ dir: env.MIGRATIONS_DIR }, 'applying migrations');
    await migrate(drizzle(client), { migrationsFolder: env.MIGRATIONS_DIR });
    logger.info('migrations applied');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  logger.error({ err }, 'migration failed');
  process.exitCode = 1;
});
