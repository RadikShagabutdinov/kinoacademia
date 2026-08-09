import type { JobKey } from '@kinoacademia/shared';
import { capitalizeCompaniesHandler } from './handlers/capitalizeCompanies';
import { cleanupSessionsHandler } from './handlers/cleanupSessions';
import { generateVariableHandler } from './handlers/generateVariable';
import { resetVariableHandler } from './handlers/resetVariable';
import type { JobHandler } from './types';

type AnyHandler = JobHandler<unknown>;

const handlers: Record<JobKey, AnyHandler> = {
  generate_variable: generateVariableHandler as AnyHandler,
  reset_variable: resetVariableHandler as AnyHandler,
  capitalize_companies: capitalizeCompaniesHandler as AnyHandler,
  cleanup_sessions: cleanupSessionsHandler as AnyHandler,
};

export const getHandler = <T = unknown>(key: JobKey): JobHandler<T> | undefined =>
  handlers[key] as JobHandler<T> | undefined;

export const requireHandler = <T = unknown>(key: JobKey): JobHandler<T> => {
  const handler = getHandler<T>(key);
  if (!handler) throw new Error(`Job handler not found: ${key}`);
  return handler;
};

export const allHandlers = (): AnyHandler[] => Object.values(handlers);

export const allHandlerKeys = (): JobKey[] => Object.keys(handlers) as JobKey[];
