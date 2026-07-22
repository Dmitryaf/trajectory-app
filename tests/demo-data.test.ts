import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ExportPayload } from '../src/stores/app';
import { normalizeDailyEntry, normalizeLifeEvent, normalizeSettings } from '../src/types';

const dataThrough = '2026-07-20';
const fixturePath = resolve(process.cwd(), 'demo/trajectory-test-user-2026-07-20.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ExportPayload;

describe('test user fixture', () => {
  it('uses the current import schema and normalized settings', () => {
    expect(fixture.version).toBe(4);
    const settings = normalizeSettings(fixture.settings);
    expect(settings.settingsVersion).toBe(8);
    expect(settings.focusOutcomeCriterion).not.toBe('');
    expect(settings.focusReviewDate).toBe('2026-08-15');
    expect(settings.experiment).toMatchObject({ targetMetricId: 'energy', targetDirection: 'increase', minimumMeaningfulChange: 0.5 });
    expect(settings.activeDailyBlocks).toEqual(['sleep', 'context', 'career', 'movement', 'nutrition']);
    expect(settings.activeLifeAreas).not.toContain('spiritual');
    expect(settings.customCareerOptions.some((option) => option.label === 'Адресные отклики')).toBe(false);
    expect(settings.customContextFactorOptions.some((option) => option.label === 'Спокойный душ')).toBe(false);
  });

  it('covers new and high-volume UI scenarios', () => {
    const entries = fixture.dailyEntries.map(normalizeDailyEntry);
    expect(entries.length).toBeGreaterThanOrEqual(24);
    expect(entries.some((entry) => entry.careerStates.length > 1)).toBe(true);
    expect(entries.some((entry) => entry.contextFactors.includes('anxiety_overload'))).toBe(true);
    expect(entries.some((entry) => entry.specialDay !== null)).toBe(true);
    expect(entries.every((entry) => entry.entrySchemaVersion === 2)).toBe(true);
    expect(entries.every((entry) => entry.activeDailyBlocksSnapshot?.includes('context'))).toBe(true);
    expect(fixture.results.length).toBeGreaterThan(20);
    expect(fixture.lifeEvents?.length).toBeGreaterThanOrEqual(8);
    expect(fixture.monthlyReviews?.length).toBeGreaterThanOrEqual(2);
  });

  it('contains no future or removed event values', () => {
    expect(fixture.dailyEntries.every((entry) => entry.date <= dataThrough)).toBe(true);
    expect(fixture.dailyEntries.filter((entry) => entry.weightKg !== null).every((entry) => entry.date <= dataThrough)).toBe(true);
    const events = (fixture.lifeEvents ?? []).map(normalizeLifeEvent);
    expect(events.every((event) => event.date <= dataThrough)).toBe(true);
    expect(events.every((event) => event.type !== 'milestone')).toBe(true);
  });
});
