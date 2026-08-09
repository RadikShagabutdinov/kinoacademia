import { describe, expect, it } from 'vitest';
import { allHandlerKeys, allHandlers, getHandler, requireHandler } from './registry';
import { cronSlot, manualSlot } from './slot';

describe('jobs/registry', () => {
  it('exposes all four handler keys', () => {
    const keys = allHandlerKeys().sort();
    expect(keys).toEqual([
      'capitalize_companies',
      'cleanup_sessions',
      'generate_variable',
      'reset_variable',
    ]);
  });

  it('returns handler by key', () => {
    const handler = requireHandler('generate_variable');
    expect(handler.key).toBe('generate_variable');
    expect(handler.defaultCron).toMatch(/\*/);
    expect(handler.defaultTimezone.length).toBeGreaterThan(0);
  });

  it('throws on unknown key', () => {
    // @ts-expect-error — runtime check for safety
    expect(() => requireHandler('unknown_key')).toThrow(/Job handler not found/);
  });

  it('returns undefined from getHandler for unknown key', () => {
    // @ts-expect-error — runtime check
    expect(getHandler('unknown_key')).toBeUndefined();
  });

  it('every handler exposes a parsable defaultParams via paramsSchema', () => {
    for (const handler of allHandlers()) {
      const parsed = handler.paramsSchema.safeParse(handler.defaultParams);
      expect(parsed.success).toBe(true);
    }
  });

  it('generate_variable params accept overrides', () => {
    const handler = requireHandler('generate_variable');
    expect(handler.paramsSchema.safeParse({ withPermanent: 10, default: 2 }).success).toBe(true);
    expect(handler.paramsSchema.safeParse({ withPermanent: -1 }).success).toBe(false);
  });
});

describe('jobs/slot', () => {
  it('cronSlot truncates to minute precision', () => {
    const date = new Date('2026-04-30T12:34:56.789Z');
    expect(cronSlot(date)).toBe('2026-04-30T12:34:00.000Z');
  });

  it('manualSlot uses manual: prefix', () => {
    const slot = manualSlot(new Date('2026-04-30T12:00:00.000Z'));
    expect(slot).toBe('manual:2026-04-30T12:00:00.000Z');
  });
});
