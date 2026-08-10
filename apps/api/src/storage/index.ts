import { env } from '@/env';
import type { StorageAdapter } from './StorageAdapter';
import { createLocalDiskAdapter } from './local-disk';

export * from './StorageAdapter';
export { createLocalDiskAdapter } from './local-disk';

let cached: StorageAdapter | null = null;

export const getScansStorage = (): StorageAdapter => {
  if (cached) return cached;
  switch (env.STORAGE_DRIVER) {
    case 'local':
      cached = createLocalDiskAdapter(env.SCANS_STORAGE_DIR);
      return cached;
    default:
      throw new Error(`Unsupported STORAGE_DRIVER: ${env.STORAGE_DRIVER as string}`);
  }
};

/** Только для тестов — сбросить закэшированный адаптер. */
export const resetScansStorageForTests = () => {
  cached = null;
};
