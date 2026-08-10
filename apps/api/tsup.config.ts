import { defineConfig } from 'tsup';

export default defineConfig({
  // Сервер + два операционных скрипта (миграции и сид) — в проде drizzle-kit
  // и tsx недоступны, эти энтрипоинты запускаются как node dist/<name>.js
  entry: { index: 'src/index.ts', migrate: 'src/db/migrate.ts', seed: 'src/db/seed.ts' },
  // @kinoacademia/shared публикует TS-исходники без сборки — Node их не выполнит,
  // поэтому пакет обязан попасть внутрь бандла
  noExternal: ['@kinoacademia/shared'],
  // ESM-сборка — нативные import/export, совместимо с Node 22
  format: ['esm'],
  // Таргет — Node 22 LTS
  target: 'node22',
  // Очищаем dist/ перед каждой сборкой
  clean: true,
  // Sourcemaps для отладки продакшн-сборки
  sourcemap: true,
});
