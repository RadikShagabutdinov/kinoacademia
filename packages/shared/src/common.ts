import { z } from '@hono/zod-openapi';

export const Uuid = z.string().uuid();
export type Uuid = z.infer<typeof Uuid>;

export const IsoDateTime = z.string().datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTime>;
