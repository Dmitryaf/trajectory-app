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
    expect(settings.settingsVersion).toBe(9);
    expect(settings.activeDailyBlocks).toContain('context');
    expect(settings.customContextFactorOptions).toEqual([]);
    expect(settings.hiddenContextFactorIds).toEqual([]);
    expect(settings).not.toHaveProperty('customEveningFactorOptions');
    expect(normalized.careerStates).toEqual(['preparation', 'external']);
    expect(normalized.contextFactors).toEqual(['screen']);
    expect(normalized).not.toHaveProperty('eveningFactors');
  });

  it('keeps optional goal evidence and ignores an invalid review date', () => {
    const settings = normalizeSettings({
      focusOutcomeCriterion: 'Пять завершённых тренировок',
      focusReviewDate: '2026-08-01',
    });
    const invalid = normalizeSettings({ focusReviewDate: '01.08.2026' });

    expect(settings).toMatchObject({
      focusOutcomeCriterion: 'Пять завершённых тренировок',
      focusReviewDate: '2026-08-01',
    });
    expect(invalid.focusReviewDate).toBe('');
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

  it('discards invalid experiment dates and incomplete history records', () => {
    const defaultExperiment = normalizeSettings(undefined).experiment;
    const { active: _active, ...defaultRecord } = defaultExperiment;
    const settings = normalizeSettings({
      experiment: { ...defaultExperiment, title: 'Режим', startDate: '22.07.2026', endDate: '2026-07-29' },
      experimentHistory: [
        { ...defaultRecord, id: 'invalid', title: 'Старая запись', startDate: '2026-07-30', endDate: '2026-07-20', completedAt: '' },
        { ...defaultRecord, id: 'valid', title: 'Спокойный вечер', startDate: '2026-07-01', endDate: '2026-07-07', conclusion: 'Стало легче завершать день', completedAt: '' },
      ],
    });

    expect(settings.experiment.startDate).toBe('');
    expect(settings.experiment.endDate).toBe('2026-07-29');
    expect(settings.experimentHistory).toEqual([
      expect.objectContaining({ id: 'valid', title: 'Спокойный вечер' }),
    ]);
  });
});
