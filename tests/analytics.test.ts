import { describe, expect, it } from 'vitest';
import { buildCoverageSeries, buildEventComparison, buildObservations, buildRangeReviewCues, buildReviewCues, dataCoverageLevel, entriesForPeriod, entriesForWeek, factorSummaries, summarize, weekSummaryText } from '../src/services/analytics';
import { buildAiReportPayload, buildAiReportRangePayload } from '../src/services/aiReport';
import { addMonths, monthsBetween } from '../src/services/dates';
import { defaultSettings, emptyDailyEntry, normalizeDailyEntry, normalizeMonthlyReview, normalizeWeeklyReview, type DailyEntry } from '../src/types';

function entry(date: string, patch: Partial<DailyEntry>): DailyEntry {
  return { ...emptyDailyEntry(date), ...patch };
}

describe('analytics', () => {
  it('aggregates sleep, career, sport and life areas', () => {
    const summary = summarize([
      entry('2026-07-13', { sleepMinutes: 420, timeInBedMinutes: 480, energy: 3, careerState: 'external', activities: ['boxing'], lifeAreas: ['reading'] }),
      entry('2026-07-14', { sleepMinutes: 480, timeInBedMinutes: 600, energy: 5, careerState: 'preparation', activities: ['bachata'], lifeAreas: ['family', 'reading'] })
    ]);

    expect(summary.averageSleep).toBe(450);
    expect(summary.averageTimeInBed).toBe(540);
    expect(summary.averageSleepEfficiency).toBeCloseTo(83.75);
    expect(summary.averageEnergy).toBe(4);
    expect(summary.careerDays).toBe(2);
    expect(summary.externalSteps).toBe(1);
    expect(summary.movementDays).toBe(2);
    expect(summary.nutritionSupportDays).toBe(0);
    expect(summary.nutritionBlockDays).toBe(0);
    expect(summary.externalActionDays).toBe(0);
    expect(summary.preparationDays).toBe(0);
    expect(summary.driftDays).toBe(0);
    expect(summary.specialDays).toBe(0);
    expect(summary.areaCounts.reading).toBe(2);
    expect(summary.areaCounts.family).toBe(1);
  });

  it('tracks nutrition state and weight without scoring the day', () => {
    const summary = summarize([
      entry('2026-07-13', { nutritionState: 'supports_goal', weightKg: 82.4 }),
      entry('2026-07-14', { nutritionState: 'blocks_goal', weightKg: 82.8 }),
      entry('2026-07-15', { nutritionState: 'neutral' })
    ]);

    expect(summary.nutritionSupportDays).toBe(1);
    expect(summary.nutritionBlockDays).toBe(1);
    expect(summary.averageWeightKg).toBe(82.6);
  });

  it('counts multiple career actions from one day', () => {
    const summary = summarize([
      entry('2026-07-13', { careerStates: ['preparation', 'external', 'interview'] }),
      entry('2026-07-14', { careerStates: ['result'] })
    ]);

    expect(summary.careerDays).toBe(2);
    expect(summary.externalSteps).toBe(3);
  });

  it('drops unsupported imported enum values', () => {
    const normalized = normalizeDailyEntry({ date: '2026-07-13', nutritionState: 'unknown' as never, actionDirection: 'noise' as never });

    expect(normalized.nutritionState).toBeNull();
    expect(normalized.actionDirection).toBeNull();
  });

  it('tracks action direction without turning it into a score', () => {
    const summary = summarize([
      entry('2026-07-13', { actionDirection: 'external' }),
      entry('2026-07-14', { actionDirection: 'preparation' }),
      entry('2026-07-15', { actionDirection: 'preparation' }),
      entry('2026-07-16', { actionDirection: 'drift' })
    ]);

    expect(summary.externalActionDays).toBe(1);
    expect(summary.preparationDays).toBe(2);
    expect(summary.driftDays).toBe(1);
    expect(summary.actionDirectionCounts.maintenance).toBe(0);
  });

  it('separates experiment adherence from its outcome', () => {
    const summary = summarize([
      entry('2026-07-13', { experimentCompleted: true, energy: 4 }),
      entry('2026-07-14', { experimentCompleted: false, energy: 2 }),
      entry('2026-07-15', { experimentCompleted: null, energy: 3 })
    ]);

    expect(summary.experimentMarkedDays).toBe(2);
    expect(summary.experimentCompletedDays).toBe(1);
  });

  it('selects entries only from the requested Monday-Sunday week', () => {
    const entries = [
      entry('2026-07-12', {}),
      entry('2026-07-13', {}),
      entry('2026-07-19', {}),
      entry('2026-07-20', {})
    ];
    expect(entriesForWeek(entries, '2026-07-16').map(({ date }) => date)).toEqual(['2026-07-13', '2026-07-19']);
  });

  it('selects entries from an arbitrary calendar period', () => {
    const entries = [
      entry('2026-04-30', {}),
      entry('2026-05-01', {}),
      entry('2026-07-31', {}),
      entry('2026-08-01', {})
    ];

    expect(entriesForPeriod(entries, '2026-05-01', '2026-07-31').map(({ date }) => date)).toEqual(['2026-05-01', '2026-07-31']);
  });

  it('builds calendar month ranges for long trends', () => {
    expect(addMonths('2026-07-16', -2)).toBe('2026-05-01');
    expect(monthsBetween('2026-05-15', '2026-07-31')).toEqual(['2026-05-01', '2026-06-01', '2026-07-01']);
  });

  it('creates a factual summary without a score', () => {
    const summary = summarize([
      entry('2026-07-13', { careerState: 'external', activities: ['boxing'], lifeAreas: ['family'] })
    ]);
    const text = weekSummaryText(summary, ['family', 'reading']);
    expect(text).toContain('1 карьерных день');
    expect(text).toContain('Присутствовали: семья');
    expect(text).toContain('Не появлялись: чтение');
    expect(text).not.toContain('%');
  });

  it('counts special days separately from activity', () => {
    const summary = summarize([
      entry('2026-07-13', { specialDay: 'sick', specialDayNote: 'простуда' }),
      entry('2026-07-14', { activities: ['walk'] })
    ]);

    expect(summary.specialDays).toBe(1);
    expect(summary.movementDays).toBe(1);
  });

  it('builds cautious observations from repeated patterns', () => {
    const observations = buildObservations([
      entry('2026-07-13', { sleepMinutes: 480, energy: 5, activities: ['walk'] }),
      entry('2026-07-14', { sleepMinutes: 450, energy: 4, activities: ['boxing'] }),
      entry('2026-07-15', { sleepMinutes: 360, energy: 2, activities: [] }),
      entry('2026-07-16', { sleepMinutes: 390, energy: 3, activities: [] }),
      entry('2026-07-17', { specialDay: 'travel' }),
      entry('2026-07-18', { eveningFactors: ['news'] }),
      entry('2026-07-19', { eveningFactors: ['news'] })
    ]);

    expect(observations.map((item) => item.id)).toContain('movement-energy');
    expect(observations.map((item) => item.id)).toContain('sleep-energy');
    expect(observations.map((item) => item.id)).toContain('special-days');
    expect(observations.map((item) => item.id)).toContain('evening-factor');
  });

  it('summarizes evening factors without scoring them', () => {
    const factors = factorSummaries([
      entry('2026-07-13', { sleepMinutes: 360, energy: 2, eveningFactors: ['news', 'screen'] }),
      entry('2026-07-14', { sleepMinutes: 420, energy: 3, eveningFactors: ['news'] })
    ]);

    expect(factors[0].id).toBe('news');
    expect(factors[0].count).toBe(2);
    expect(factors[0].averageSleep).toBe(390);
    expect(factors[0].averageEnergy).toBe(2.5);
  });

  it('includes life events in the AI package only for the selected period', () => {
    const payload = buildAiReportPayload('week', '2026-07-16', {
      entries: [entry('2026-07-13', { energy: 3 })],
      results: [],
      lifeEvents: [
        { id: 1, date: '2026-07-15', type: 'decision', title: 'Сменил фокус поиска', note: 'Больше фронтенда', createdAt: '2026-07-15T10:00:00.000Z' },
        { id: 2, date: '2026-07-21', type: 'event', title: 'Будущее событие', note: '', createdAt: '2026-07-21T10:00:00.000Z' }
      ],
      reviews: [],
      monthlyReviews: [],
      settings: defaultSettings
    });

    expect(payload.version).toBe(3);
    expect(payload.lifeEvents).toHaveLength(1);
    expect(payload.lifeEvents[0].title).toBe('Сменил фокус поиска');
  });

  it('builds AI packages for long trend ranges', () => {
    const payload = buildAiReportRangePayload(3, '2026-07-16', {
      entries: [
        entry('2026-04-30', { energy: 1 }),
        entry('2026-05-01', { energy: 3 }),
        entry('2026-07-16', { energy: 5 })
      ],
      results: [
        { id: 1, date: '2026-06-10', area: 'career', title: 'Сделал проект', createdAt: '2026-06-10T10:00:00.000Z' }
      ],
      lifeEvents: [
        { id: 1, date: '2026-07-01', type: 'change', title: 'Новый режим', note: '', createdAt: '2026-07-01T10:00:00.000Z' }
      ],
      reviews: [],
      monthlyReviews: [],
      settings: defaultSettings
    });

    expect(payload.period).toBe('range');
    expect(payload.rangeMonths).toBe(3);
    expect(payload.start).toBe('2026-05-01');
    expect(payload.end).toBe('2026-07-16');
    expect(payload.entries.map((item) => item.date)).toEqual(['2026-05-01', '2026-07-16']);
    expect(payload.results).toHaveLength(1);
    expect(payload.lifeEvents).toHaveLength(1);
  });

  it('builds local review cues from factual period data', () => {
    const cues = buildReviewCues('week', [
      entry('2026-07-13', { sleepMinutes: 360, eveningFactors: ['news'], careerState: 'external' }),
      entry('2026-07-14', { sleepMinutes: 390, eveningFactors: ['news'] }),
      entry('2026-07-15', { sleepMinutes: 480 }),
      entry('2026-07-16', { sleepMinutes: 450 })
    ], [
      { id: 1, date: '2026-07-16', area: 'career', title: 'Отправил отклики', createdAt: '2026-07-16T10:00:00.000Z' }
    ], [
      { id: 1, date: '2026-07-15', type: 'decision', title: 'Сменил фокус', note: '', createdAt: '2026-07-15T10:00:00.000Z' }
    ]);

    expect(cues.map((cue) => cue.id)).toEqual(expect.arrayContaining(['coverage', 'short-sleep', 'factor', 'career', 'context', 'results']));
    expect(cues.find((cue) => cue.id === 'coverage')?.tone).toBe('good');
    expect(cues.find((cue) => cue.id === 'factor')?.text).toContain('Новости');
  });

  it('flags preparation when it does not turn into external contact', () => {
    const cues = buildReviewCues('week', [
      entry('2026-07-13', { actionDirection: 'preparation' }),
      entry('2026-07-14', { actionDirection: 'preparation' }),
      entry('2026-07-15', { actionDirection: 'preparation' }),
      entry('2026-07-16', { actionDirection: 'maintenance' })
    ], [], []);

    expect(cues.map((cue) => cue.id)).toContain('direction-preparation');
    expect(cues.find((cue) => cue.id === 'direction-preparation')?.tone).toBe('warning');
  });

  it('keeps completed results visible when review cues are crowded', () => {
    const cues = buildReviewCues('week', [
      entry('2026-07-13', { sleepMinutes: 360, eveningFactors: ['news'], careerState: 'external', nutritionState: 'blocks_goal', specialDay: 'overload' }),
      entry('2026-07-14', { sleepMinutes: 390, eveningFactors: ['news'], nutritionState: 'blocks_goal' }),
      entry('2026-07-15', { sleepMinutes: 480 }),
      entry('2026-07-16', { sleepMinutes: 450 })
    ], [
      { id: 1, date: '2026-07-16', area: 'career', title: 'Закончил отклики недели', createdAt: '2026-07-16T10:00:00.000Z' }
    ], [
      { id: 1, date: '2026-07-15', type: 'event', title: 'Сложный внешний день', note: '', createdAt: '2026-07-15T10:00:00.000Z' }
    ]);

    expect(cues).toHaveLength(6);
    expect(cues.map((cue) => cue.id)).toContain('results');
  });

  it('normalizes weekly review if-then plans for older backups', () => {
    const review = normalizeWeeklyReview({
      weekStart: '2026-07-13',
      results: ['результат'],
      support: 'режим',
      obstacle: 'новости',
      nextLever: 'закрывать новости'
    });

    expect(review.ifThenPlan).toBe('');
    expect(review.previousPlanOutcome).toBe('');
  });

  it('keeps special days out of baseline state averages', () => {
    const summary = summarize([
      entry('2026-07-13', { sleepMinutes: 480, energy: 4 }),
      entry('2026-07-14', { sleepMinutes: 180, energy: 1, specialDay: 'travel' })
    ]);

    expect(summary.entriesCount).toBe(2);
    expect(summary.ordinaryEntriesCount).toBe(1);
    expect(summary.averageSleep).toBe(480);
    expect(summary.averageEnergy).toBe(4);
    expect(summary.sleepSamples).toBe(1);
  });

  it('measures sleep timing variation across midnight without a false jump', () => {
    const summary = summarize([
      entry('2026-07-13', { bedtime: '23:30', wakeTime: '07:30' }),
      entry('2026-07-14', { bedtime: '00:30', wakeTime: '08:30' })
    ]);

    expect(summary.sleepTimingSamples).toBe(2);
    expect(summary.bedtimeVariationMinutes).toBe(30);
    expect(summary.wakeTimeVariationMinutes).toBe(30);
  });

  it('compares repeated factors with ordinary days without the factor', () => {
    const factors = factorSummaries([
      entry('2026-07-13', { sleepMinutes: 360, energy: 2, eveningFactors: ['news'] }),
      entry('2026-07-14', { sleepMinutes: 420, energy: 3, eveningFactors: ['news'] }),
      entry('2026-07-15', { sleepMinutes: 480, energy: 4 }),
      entry('2026-07-16', { sleepMinutes: 540, energy: 5 }),
      entry('2026-07-17', { sleepMinutes: 120, energy: 1, eveningFactors: ['news'], specialDay: 'sick' })
    ]);

    expect(factors[0].count).toBe(2);
    expect(factors[0].averageSleep).toBe(390);
    expect(factors[0].averageSleepWithout).toBe(510);
    expect(factors[0].energySamplesWithout).toBe(2);
  });

  it('uses proportional rules for long-period review cues', () => {
    const entries = Array.from({ length: 12 }, (_, index) => entry(`2026-${String(5 + Math.floor(index / 4)).padStart(2, '0')}-${String((index % 4) + 1).padStart(2, '0')}`, {
      actionDirection: index < 10 ? 'preparation' : 'external'
    }));
    const cues = buildRangeReviewCues(3, entries, [], []);

    expect(cues.map((cue) => cue.id)).toContain('direction-preparation');
  });

  it('normalizes monthly reviews for older backups', () => {
    const review = normalizeMonthlyReview({ monthStart: '2026-07-01', mainPattern: 'Сон менялся' });

    expect(review.mainPattern).toBe('Сон менялся');
    expect(review.ifThenPlan).toBe('');
    expect(review.nextFocus).toBe('');
  });

  it('separates missing, partial and core daily data without a score', () => {
    const partial = entry('2026-07-13', { energy: 3 });
    const core = entry('2026-07-14', { energy: 4, actionDirection: 'external' });

    expect(dataCoverageLevel(partial)).toBe(1);
    expect(dataCoverageLevel(core)).toBe(2);
    expect(buildCoverageSeries([partial, core], '2026-07-13', '2026-07-15')).toEqual([
      ['2026-07-13', 1],
      ['2026-07-14', 2],
      ['2026-07-15', 0],
    ]);
  });

  it('compares equal windows around an event and excludes special days from state averages', () => {
    const comparison = buildEventComparison('2026-07-15', [
      entry('2026-07-10', { sleepMinutes: 480, energy: 4, actionDirection: 'preparation' }),
      entry('2026-07-11', { sleepMinutes: 120, energy: 1, specialDay: 'travel' }),
      entry('2026-07-16', { sleepMinutes: 420, energy: 3, actionDirection: 'external' }),
      entry('2026-07-17', { sleepMinutes: 360, energy: 2, actionDirection: 'external' }),
    ], [
      { id: 1, date: '2026-07-17', area: 'career', title: 'Получил ответ', createdAt: '2026-07-17T10:00:00.000Z' },
    ], undefined, 14, '2026-07-20');

    expect(comparison?.windowDays).toBe(5);
    expect(comparison?.beforeStart).toBe('2026-07-10');
    expect(comparison?.afterEnd).toBe('2026-07-20');
    expect(comparison?.metrics.find((metric) => metric.id === 'sleep')).toMatchObject({ before: 480, after: 390, beforeSamples: 1, afterSamples: 2 });
    expect(comparison?.metrics.find((metric) => metric.id === 'external')).toMatchObject({ before: 0, after: 100 });
    expect(comparison?.metrics.find((metric) => metric.id === 'results')).toMatchObject({ before: 0, after: 1 });
  });
});
