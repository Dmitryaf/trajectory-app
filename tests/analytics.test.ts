import { describe, expect, it } from 'vitest';
import { entriesForWeek, summarize, weekSummaryText } from '../src/services/analytics';
import { emptyDailyEntry, type DailyEntry } from '../src/types';

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
});
