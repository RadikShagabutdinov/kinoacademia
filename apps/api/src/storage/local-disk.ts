import { createReadStream } from 'node:fs';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path';
import type { ReadScanResult, SaveScanInput, StorageAdapter, StoredFile } from './StorageAdapter';

const ensurePathInside = (root: string, target: string): string => {
  const resolvedTarget = resolve(target);
  const resolvedRoot = resolve(root);
  const relative = resolvedTarget.startsWith(resolvedRoot + sep) || resolvedTarget === resolvedRoot;
  if (!relative) {
    throw new Error(`Storage path escape detected: ${target} not inside ${root}`);
  }
  return resolvedTarget;
};

export const createLocalDiskAdapter = (rootDir: string): StorageAdapter => {
  const root = isAbsolute(rootDir) ? rootDir : resolve(process.cwd(), rootDir);

  return {
    async save({ key, data }: SaveScanInput): Promise<StoredFile> {
      const normalizedKey = normalize(key).replace(/^[\\/]+/, '');
      const absolutePath = ensurePathInside(root, join(root, normalizedKey));
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, data);
      const info = await stat(absolutePath);
      return { filePath: normalizedKey, sizeBytes: info.size };
    },

    async read(filePath: string): Promise<ReadScanResult> {
      const absolutePath = ensurePathInside(root, join(root, filePath));
      const info = await stat(absolutePath);
      return {
        stream: createReadStream(absolutePath),
        mimeType: 'application/octet-stream',
        sizeBytes: info.size,
      };
    },

    async delete(filePath: string): Promise<void> {
      const absolutePath = ensurePathInside(root, join(root, filePath));
      try {
        await unlink(absolutePath);
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
      }
    },
  };
};
