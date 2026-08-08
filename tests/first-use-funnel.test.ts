import { describe, expect, it, vi } from 'vitest';
import { clearFirstUseFunnel, readFirstUseFunnel, recordFirstUseEvent, recordFirstUseReturnEvents } from '../src/features/first-use/funnel';

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
    values,
  };
}

describe('local first-use funnel', () => {
  it('stores only the first timestamp for a known event', () => {
    const storage = memoryStorage();
    const first = new Date(2026, 7, 1, 12);
    const repeated = new Date(2026, 7, 1, 13);

    expect(recordFirstUseEvent('first_use_recovery_started', first, storage)).toBe(true);
    expect(recordFirstUseEvent('first_use_recovery_started', repeated, storage)).toBe(false);
    expect(readFirstUseFunnel(storage)).toEqual([{ name: 'first_use_recovery_started', occurredAt: first.toISOString() }]);

    const stored = [...storage.values.values()].join('');
    expect(stored).not.toContain('answer');
    expect(stored).not.toContain('title');
    expect(stored).not.toContain('note');
  });

  it('ignores unknown fields, invalid timestamps and broken local data', () => {
    const key = 'trajectory:first-use-funnel:v1';
    const storage = memoryStorage({
      [key]: JSON.stringify({
        version: 1,
        events: {
          first_use_presentation_viewed: '2026-08-01T09:00:00.000Z',
          first_use_signup_completed: 'not-a-date',
          user_answer: 'private text',
        },
      }),
    });

    expect(readFirstUseFunnel(storage)).toEqual([{ name: 'first_use_presentation_viewed', occurredAt: '2026-08-01T09:00:00.000Z' }]);

    storage.values.set(key, '{broken');
    expect(readFirstUseFunnel(storage)).toEqual([]);
  });

  it('records return windows only on a later application opening', () => {
    const storage = memoryStorage();
    const started = new Date(2026, 7, 1, 12);
    recordFirstUseEvent('first_use_recovery_started', started, storage);

    expect(recordFirstUseReturnEvents(new Date(2026, 7, 1, 18), storage)).toEqual([]);
    expect(recordFirstUseReturnEvents(new Date(2026, 7, 2, 9), storage)).toEqual(['first_use_next_day_returned']);
    expect(recordFirstUseReturnEvents(new Date(2026, 7, 2, 18), storage)).toEqual([]);
    expect(recordFirstUseReturnEvents(new Date(2026, 7, 8, 9), storage)).toEqual(['first_use_next_week_returned']);

    expect(readFirstUseFunnel(storage).map((event) => event.name)).toEqual([
      'first_use_recovery_started',
      'first_use_next_day_returned',
      'first_use_next_week_returned',
    ]);
  });

  it('clears the local funnel without depending on the main database', () => {
    const storage = memoryStorage();
    recordFirstUseEvent('first_use_overview_viewed', new Date(2026, 7, 1, 12), storage);

    clearFirstUseFunnel(storage);

    expect(readFirstUseFunnel(storage)).toEqual([]);
    expect(storage.removeItem).toHaveBeenCalledWith('trajectory:first-use-funnel:v1');
  });
});
