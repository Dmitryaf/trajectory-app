import { describe, expect, it } from 'vitest';
import { emptyDailyEntry, normalizeDailyEntry, normalizeSettings } from '../src/types';

describe('settings migrations', () => {
  it('removes obsolete demo options while preserving old response entries', () => {
    const settings = normalizeSettings({
      settingsVersion: 3,
      customCareerOptions: [{ id: 'custom:career:responses', label: 'Адресные отклики' }],
      customEveningFactorOptions: [{ id: 'custom:evening:shower', label: 'Спокойный душ' }],
    });
    const normalized = normalizeDailyEntry({
      ...emptyDailyEntry('2026-07-13'),
      careerStates: ['preparation', 'custom:career:responses'],
      eveningFactors: ['screen', 'custom:evening:shower'],
    });

    expect(settings.customCareerOptions).toEqual([]);
    expect(settings.customEveningFactorOptions).toEqual([]);
    expect(normalized.careerStates).toEqual(['preparation', 'external']);
    expect(normalized.eveningFactors).toEqual(['screen']);
  });
});
