import { defineConfig } from 'tsup';

export default defineConfig({
  // Точка входа — один файл на выходе
  entry: ['src/index.ts'],
  // ESM-сборка — нативные import/export, совместимо с Node 22
  format: ['esm'],
  // Таргет — Node 22 LTS
  target: 'node22',
  // Очищаем dist/ перед каждой сборкой
  clean: true,
  // Sourcemaps для отладки продакшн-сборки
  sourcemap: true,
});
