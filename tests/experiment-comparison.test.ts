import { describe, expect, it } from 'vitest';
import { buildExperimentComparison } from '../src/features/analytics/experimentComparison';
import { buildAiReportPayload, buildAiReportPrompt } from '../src/features/export/report';
import { defaultSettings, emptyDailyEntry, type DailyEntry, type Experiment } from '../src/types';

function entry(date: string, patch: Partial<DailyEntry>): DailyEntry {
  return { ...emptyDailyEntry(date), ...patch };
}

function experiment(patch: Partial<Experiment> = {}): Experiment {
  return {
    ...defaultSettings.experiment,
    active: true,
    title: 'Спокойный вечер',
    hypothesis: 'Энергия станет выше',
    targetMetricId: 'energy',
    targetMetric: 'Энергия за день',
    targetDirection: 'increase',
    minimumMeaningfulChange: 0.5,
    startDate: '2026-07-05',
    endDate: '2026-07-08',
    ...patch,
  };
}

describe('experiment comparison', () => {
  it('compares an equally long preceding window and excludes special days', () => {
    const entries = [
      entry('2026-07-01', { energy: 2 }),
      entry('2026-07-02', { energy: 2 }),
      entry('2026-07-03', { energy: 5, specialDay: 'travel' }),
      entry('2026-07-04', { energy: 2 }),
      entry('2026-07-05', { energy: 3, experimentCompleted: true }),
      entry('2026-07-06', { energy: 3, experimentCompleted: true }),
      entry('2026-07-07', { energy: 3, experimentCompleted: false }),
      entry('2026-07-08', { energy: 3, experimentCompleted: true }),
    ];

    const comparison = buildExperimentComparison(entries, experiment());

    expect(comparison).toMatchObject({
      baselineStart: '2026-07-01',
      baselineEnd: '2026-07-04',
      baselineAverage: 2,
      baselineSamples: 3,
      experimentAverage: 3,
      experimentSamples: 4,
      adherenceMarkedDays: 4,
      adherenceCompletedDays: 3,
      thresholdMet: null,
    });
  });

  it('evaluates the predeclared threshold only with enough samples', () => {
    const entries = Array.from({ length: 8 }, (_, index) => entry(
      `2026-07-${String(index + 1).padStart(2, '0')}`,
      { energy: index < 4 ? 2 : 3 },
    ));

    expect(buildExperimentComparison(entries, experiment())?.thresholdMet).toBe(true);
    expect(buildExperimentComparison(entries, experiment({ minimumMeaningfulChange: 1.5 }))?.thresholdMet).toBe(false);
    expect(buildExperimentComparison(entries, experiment({ targetDirection: 'decrease' }))?.improvement).toBe(-1);
  });

  it('does not build a comparison from a free-text legacy metric', () => {
    expect(buildExperimentComparison([], experiment({ targetMetricId: null, targetMetric: 'Энергия и сон' }))).toBeNull();
  });

  it('includes the cautious period comparison in the manual analysis package', () => {
    const entries = Array.from({ length: 8 }, (_, index) => entry(
      `2026-07-${String(index + 1).padStart(2, '0')}`,
      { energy: index < 4 ? 2 : 3, experimentCompleted: index < 4 ? null : true },
    ));
    const settings = structuredClone(defaultSettings);
    settings.experiment = experiment();
    const payload = buildAiReportPayload('month', '2026-07-08', {
      entries,
      results: [],
      lifeEvents: [],
      reviews: [],
      monthlyReviews: [],
      settings,
    });

    expect(payload.version).toBe(7);
    expect(payload.experimentComparison?.thresholdMet).toBe(true);
    expect(buildAiReportPrompt(payload, settings)).toContain('Это сравнение периодов, а не доказательство влияния условия.');
  });
});
