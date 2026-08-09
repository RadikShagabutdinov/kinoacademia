import { z } from '@hono/zod-openapi';
import { IsoDateTime } from './common';

export const WS_CHANNEL_PREFIXES = [
  'person',
  'company',
  'ratings',
  'contracts',
  'oscars',
  'system',
] as const;

export const WsEvent = <T extends z.ZodTypeAny>(payload: T) =>
  z.object({
    channel: z.string().min(1),
    type: z.string().min(1),
    payload,
    ts: IsoDateTime,
  });

export const WsEventEnvelope = z.object({
  channel: z.string().min(1),
  type: z.string().min(1),
  payload: z.unknown(),
  ts: IsoDateTime,
});
export type WsEventEnvelope = z.infer<typeof WsEventEnvelope>;

export type WsEventOf<T> = {
  channel: string;
  type: string;
  payload: T;
  ts: string;
};
