import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  COOKIE_DOMAIN: z.string().optional(),
  WEB_ORIGIN: z.string().url(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  JOBS_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  ENABLE_API_DOCS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  SCANS_STORAGE_DIR: z.string().default('./storage/scans'),
  // Каталог с SQL-миграциями для программного раннера (src/db/migrate.ts).
  // Дефолт рассчитан на запуск из apps/api; в Docker-образе — /app/migrations.
  MIGRATIONS_DIR: z.string().default('./src/db/migrations'),
  // Создавать ли тестовых игроков (vamp/wolf) при db:seed. На проде — false.
  SEED_DEFAULT_PLAYERS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  APP_VERSION: z.string().default('dev'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env: Env = parsed.data;

export const isProduction = env.NODE_ENV === 'production';
