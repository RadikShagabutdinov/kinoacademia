import type { Readable } from 'node:stream';

export type SaveScanInput = {
  key: string;
  data: Buffer;
  mimeType: string;
};

export type ReadScanResult = {
  stream: Readable;
  mimeType: string;
  sizeBytes: number;
};

export type StoredFile = {
  filePath: string;
  sizeBytes: number;
};

/**
 * Абстракция над файловым хранилищем сканов.
 * Ключ передаётся вызывающим кодом (например, `${companyId}/${setId}/${pageId}.pdf`),
 * реализация возвращает результирующий `filePath` для сохранения в БД.
 */
export type StorageAdapter = {
  save(input: SaveScanInput): Promise<StoredFile>;
  read(filePath: string): Promise<ReadScanResult>;
  delete(filePath: string): Promise<void>;
};
