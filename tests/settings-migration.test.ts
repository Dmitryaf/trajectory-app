import { describe, expect, it } from 'vitest';
import { normalizeDailyEntry, normalizeSettings } from '../src/types';

describe('settings migrations', () => {
  it('removes obsolete demo options while preserving old response entries', () => {
    const settings = normalizeSettings({
      settingsVersion: 3,
      customCareerOptions: [{ id: 'custom:career:responses', label: 'Адресные отклики' }],
      customEveningFactorOptions: [{ id: 'custom:evening:shower', label: 'Спокойный душ' }],
    });
    const normalized = normalizeDailyEntry({
      date: '2026-07-13',
      careerStates: ['preparation', 'custom:career:responses'],
      eveningFactors: ['screen', 'custom:evening:shower'],
    });

    expect(settings.customCareerOptions).toEqual([]);
    expect(settings.settingsVersion).toBe(7);
    expect(settings.activeDailyBlocks).toContain('context');
    expect(settings.customContextFactorOptions).toEqual([]);
    expect(settings.hiddenContextFactorIds).toEqual([]);
    expect(settings).not.toHaveProperty('customEveningFactorOptions');
    expect(normalized.careerStates).toEqual(['preparation', 'external']);
    expect(normalized.contextFactors).toEqual(['screen']);
    expect(normalized).not.toHaveProperty('eveningFactors');
  });

  it('combines old context notes without dropping either value', () => {
    const normalized = normalizeDailyEntry({
      date: '2026-07-14',
      stateContext: 'Шум за окном',
      eveningFactorNote: 'Поздно выпил кофе',
    });

    expect(normalized.contextNote).toBe('Шум за окном\nПоздно выпил кофе');
  });

  it('infers only evidenced legacy answers and keeps historical block visibility unknown', () => {
    const normalized = normalizeDailyEntry({
      date: '2026-07-15',
      energy: 4,
      careerStates: ['external'],
      activities: [],
      activitiesRecorded: true,
    });

    expect(normalized.entrySchemaVersion).toBeNull();
    expect(normalized.activeDailyBlocksSnapshot).toBeNull();
    expect(normalized.recordedFields).toEqual(expect.arrayContaining(['energy', 'careerStates', 'activities']));
    expect(normalized.recordedFields).not.toContain('nutritionState');
  });

  it('links an unambiguous legacy experiment metric without guessing a combined metric', () => {
    const energy = normalizeSettings({ experiment: { ...normalizeSettings(undefined).experiment, targetMetric: 'Энергия' } });
    const combined = normalizeSettings({ experiment: { ...normalizeSettings(undefined).experiment, targetMetric: 'Энергия и качество сна' } });

    expect(energy.experiment).toMatchObject({ targetMetricId: 'energy', minimumMeaningfulChange: 0.5 });
    expect(combined.experiment.targetMetricId).toBeNull();
  });
});
