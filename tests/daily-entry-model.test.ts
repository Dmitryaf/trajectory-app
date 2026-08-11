import { describe, expect, it } from 'vitest';
import {
  normalizeWeight,
  prepareDailyEntryForSave,
  snapshotDailyEntry,
  timeBetween,
  validateDailyEntryMetrics,
  validateDailyEntryText,
} from '../src/features/daily-entry/model';
import { emptyDailyEntry, type DailyBlockId } from '../src/types';

describe('daily entry model', () => {
  it('calculates time in bed across midnight and rejects invalid ranges', () => {
    expect(timeBetween('23:40', '07:30')).toBe(470);
    expect(timeBetween('10:00', '09:00')).toBeNull();
    expect(timeBetween('25:00', '07:00')).toBeNull();
    expect(timeBetween('', '07:00')).toBeNull();
  });

  it('normalizes weight without inventing a value', () => {
    expect(normalizeWeight(82.46)).toBe(82.5);
    expect(normalizeWeight(Number.NaN)).toBeNull();
    expect(normalizeWeight('82.4')).toBeNull();
    expect(normalizeWeight(null)).toBeNull();
  });

  it('prepares a new entry with current defaults while preserving an existing entry', () => {
    const source = emptyDailyEntry('2026-07-22');
    const metrics = { sleepMinutes: 420, timeInBedMinutes: 470, weightKg: 82.46 };
    const defaults = {
      focusTitle: ' Текущая цель ',
      focusOutcomeCriterion: ' Пять выполненных действий ',
      focusReviewDate: '2026-08-01',
      externalEvidenceCriterion: ' Внешний результат ',
      nutritionCriterion: ' Обычный режим ',
      activeDailyBlocks: ['sleep', 'context', 'movement'] as DailyBlockId[],
    };

    const prepared = prepareDailyEntryForSave(source, metrics, defaults, true);
    expect(prepared).toMatchObject({
      sleepMinutes: 420,
      timeInBedMinutes: 470,
      weightKg: 82.5,
      focusTitle: 'Текущая цель',
      focusOutcomeCriterion: 'Пять выполненных действий',
      focusReviewDate: '2026-08-01',
      externalEvidenceCriterion: 'Внешний результат',
      nutritionCriterion: 'Обычный режим',
      entrySchemaVersion: 3,
      activeDailyBlocksSnapshot: ['sleep', 'context', 'movement'],
    });
    expect(source.focusTitle).toBe('');

    const existing = prepareDailyEntryForSave(source, metrics, defaults, false);
    expect(existing.focusTitle).toBe('');
    expect(existing.focusOutcomeCriterion).toBe('');
    expect(existing.focusReviewDate).toBe('');
    expect(existing.externalEvidenceCriterion).toBe('');
    expect(existing.nutritionCriterion).toBe('');
    expect(existing.activeDailyBlocksSnapshot).toBeNull();
  });

  it('builds a stable dirty snapshot and validates sleep duration', () => {
    const entry = { ...emptyDailyEntry('2026-07-22'), updatedAt: 'first' };
    const metrics = { sleepMinutes: 480, timeInBedMinutes: 470, weightKg: 82.46 };
    const first = snapshotDailyEntry(entry, metrics);
    const second = snapshotDailyEntry({ ...entry, updatedAt: 'second' }, metrics);

    expect(first).toBe(second);
    expect(JSON.parse(first)).toMatchObject({ sleepMinutes: 480, timeInBedMinutes: 470, weightKg: 82.5, updatedAt: '' });
    expect(validateDailyEntryMetrics(metrics, true)).toBe('Время сна не может быть больше времени в кровати.');
    expect(validateDailyEntryMetrics(metrics, false)).toBe('');
    expect(validateDailyEntryMetrics({ ...metrics, sleepMinutes: 420 }, true)).toBe('');
    expect(validateDailyEntryText({ ...entry, experimentNote: 'x'.repeat(501) })).toContain('длиннее 500 символов');
    expect(validateDailyEntryText({ ...entry, experimentNote: 'x'.repeat(500) })).toBe('');
  });
});
