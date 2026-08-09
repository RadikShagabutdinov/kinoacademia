import { db } from '../db/client';
import { accessLog } from '../db/schema';

export const logAccess = async (
  userId: string | null,
  action: string,
  payload: Record<string, unknown> | null = null,
): Promise<void> => {
  await db.insert(accessLog).values({ userId, action, payload });
};
