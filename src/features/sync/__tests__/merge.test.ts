import { describe, expect, it } from 'vitest';
import { emptyDailyEntry, defaultSettings } from '../../../types';
import { BACKUP_VERSION } from '../../backup/version';
import type { ExportPayload } from '../../backup/snapshot';
import { mergeCloudSnapshots } from '../merge';

function emptyPayload(): ExportPayload {
  return {
    version: BACKUP_VERSION,
    exportedAt: '2026-08-20T10:00:00.000Z',
    dailyEntries: [],
    results: [],
    lifeEvents: [],
    weeklyReviews: [],
    monthlyReviews: [],
    settings: structuredClone(defaultSettings),
  };
}

describe('cloud snapshot merge', () => {
  it('keeps independent field edits made on two devices', () => {
    const entry = { ...emptyDailyEntry('2026-08-20'), energy: 3, importantFact: '' };
    const base = { ...emptyPayload(), dailyEntries: [entry] };
    const local = { ...base, dailyEntries: [{ ...entry, energy: 4 }] };
    const remote = { ...base, dailyEntries: [{ ...entry, importantFact: 'Изменение с телефона' }] };

    const merged = mergeCloudSnapshots(base, local, remote);

    expect(merged.dailyEntries[0]).toMatchObject({ energy: 4, importantFact: 'Изменение с телефона' });
  });

  it('merges independent settings fields', () => {
    const base = emptyPayload();
    const local = { ...base, settings: { ...base.settings, activeFocusTitle: 'Новая цель' } };
    const remote = { ...base, settings: { ...base.settings, focusOutcomeCriterion: 'Готовый результат' } };

    const merged = mergeCloudSnapshots(base, local, remote);

    expect(merged.settings.activeFocusTitle).toBe('Новая цель');
    expect(merged.settings.focusOutcomeCriterion).toBe('Готовый результат');
  });

  it('preserves two new journal records that received the same local id', () => {
    const base = emptyPayload();
    const local = {
      ...base,
      results: [{ id: 1, date: '2026-08-20', area: 'career', title: 'С компьютера', note: '', createdAt: '2026-08-20T10:00:00Z' }],
    };
    const remote = {
      ...base,
      results: [{ id: 1, date: '2026-08-20', area: 'health', title: 'С телефона', note: '', createdAt: '2026-08-20T10:01:00Z' }],
    };

    const merged = mergeCloudSnapshots(base, local, remote);

    expect(merged.results.map((record) => record.title).sort()).toEqual(['С компьютера', 'С телефона']);
    expect(new Set(merged.results.map((record) => record.id)).size).toBe(2);
  });
});
