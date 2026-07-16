import { describe, expect, it } from 'vitest';
import { buildObservations, buildReviewCues, entriesForPeriod, entriesForWeek, factorSummaries, summarize, weekSummaryText } from '../src/services/analytics';
import { buildAiReportPayload, buildAiReportRangePayload } from '../src/services/aiReport';
import { addMonths, monthsBetween } from '../src/services/dates';
import { defaultSettings, emptyDailyEntry, type DailyEntry } from '../src/types';

function entry(date: string, patch: Partial<DailyEntry>): DailyEntry {
  return { ...emptyDailyEntry(date), ...patch };
}

describe('analytics', () => {
  it('aggregates sleep, career, sport and life areas', () => {
    const summary = summarize([
      entry('2026-07-13', { sleepMinutes: 420, energy: 3, careerState: 'external', activities: ['boxing'], lifeAreas: ['reading'] }),
      entry('2026-07-14', { sleepMinutes: 480, energy: 5, careerState: 'preparation', activities: ['bachata'], lifeAreas: ['family', 'reading'] })
    ]);

    expect(summary.averageSleep).toBe(450);
    expect(summary.averageEnergy).toBe(4);
    expect(summary.careerDays).toBe(2);
    expect(summary.externalSteps).toBe(1);
    expect(summary.sportSessions).toBe(2);
    expect(summary.specialDays).toBe(0);
    expect(summary.areaCounts.reading).toBe(2);
    expect(summary.areaCounts.family).toBe(1);
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
    expect(summary.sportSessions).toBe(1);
  });

  it('builds cautious observations from repeated patterns', () => {
    const observations = buildObservations([
      entry('2026-07-13', { sleepMinutes: 480, energy: 5, activities: ['walk'] }),
      entry('2026-07-14', { sleepMinutes: 450, energy: 4, activities: ['boxing'] }),
      entry('2026-07-15', { sleepMinutes: 360, energy: 2, activities: [] }),
      entry('2026-07-16', { sleepMinutes: 390, energy: 3, activities: [] }),
      entry('2026-07-17', { specialDay: 'travel', eveningFactors: ['news'] }),
      entry('2026-07-18', { eveningFactors: ['news'] })
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
      settings: defaultSettings
    });

    expect(payload.version).toBe(2);
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
      settings: defaultSettings
    });

    expect(payload.period).toBe('range');
    expect(payload.rangeMonths).toBe(3);
    expect(payload.start).toBe('2026-05-01');
    expect(payload.end).toBe('2026-07-31');
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
});
