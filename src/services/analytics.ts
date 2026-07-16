import type { DailyEntry, LifeAreaId, Option, ResultRecord } from '../types';
import { activityOptions, careerOptions, externalCareerStates, lifeAreaOptions } from '../types';
import { dateRange, endOfMonth, endOfWeek, formatMinutes, startOfMonth, startOfWeek } from './dates';

export type PeriodSummary = {
  entriesCount: number;
  averageSleep: number | null;
  averageEnergy: number | null;
  averageSleepQuality: number | null;
  careerDays: number;
  externalSteps: number;
  sportSessions: number;
  areaCounts: Record<string, number>;
};

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function summarize(entries: DailyEntry[], externalCareerIds: string[] = externalCareerStates): PeriodSummary {
  const areaCounts = Object.fromEntries(lifeAreaOptions.map(({ id }) => [id, 0])) as Record<string, number>;
  for (const entry of entries) {
    for (const area of entry.lifeAreas) areaCounts[area] = (areaCounts[area] ?? 0) + 1;
  }

  return {
    entriesCount: entries.length,
    averageSleep: average(entries.map((entry) => entry.sleepMinutes)),
    averageEnergy: average(entries.map((entry) => entry.energy)),
    averageSleepQuality: average(entries.map((entry) => entry.sleepQuality)),
    careerDays: entries.filter((entry) => entry.careerState !== null).length,
    externalSteps: entries.filter((entry) => externalCareerIds.includes(entry.careerState ?? '')).length,
    sportSessions: entries.reduce((sum, entry) => sum + entry.activities.filter((item) => item !== 'recovery').length, 0),
    areaCounts
  };
}

export function entriesForWeek(entries: DailyEntry[], anchor: string): DailyEntry[] {
  const start = startOfWeek(anchor);
  const end = endOfWeek(anchor);
  return entries.filter((entry) => entry.date >= start && entry.date <= end);
}

export function entriesForMonth(entries: DailyEntry[], anchor: string): DailyEntry[] {
  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  return entries.filter((entry) => entry.date >= start && entry.date <= end);
}

export function resultsForPeriod(results: ResultRecord[], start: string, end: string): ResultRecord[] {
  return results.filter((result) => result.date >= start && result.date <= end).sort((a, b) => b.date.localeCompare(a.date));
}

export function weekSummaryText(summary: PeriodSummary, activeAreas: LifeAreaId[], areaOptions: Option[] = lifeAreaOptions): string {
  if (!summary.entriesCount) return 'Пока нет записей за эту неделю. Здесь появится сухая сводка фактов.';

  const labels = new Map(areaOptions.map((item) => [item.id, item.label]));
  const present = activeAreas.filter((area) => summary.areaCounts[area] > 0).map((area) => (labels.get(area) ?? area).toLowerCase());
  const absent = activeAreas.filter((area) => (summary.areaCounts[area] ?? 0) === 0).map((area) => (labels.get(area) ?? area).toLowerCase());
  const parts = [
    `${summary.careerDays} карьерных ${plural(summary.careerDays, 'день', 'дня', 'дней')}`,
    `${summary.externalSteps} внешних ${plural(summary.externalSteps, 'шаг', 'шага', 'шагов')}`,
    `${summary.sportSessions} ${plural(summary.sportSessions, 'тренировка', 'тренировки', 'тренировок')}`
  ];
  if (summary.averageSleep !== null) parts.push(`средний сон ${formatMinutes(Math.round(summary.averageSleep))}`);
  let text = `За неделю: ${parts.join(', ')}.`;
  if (present.length) text += ` Присутствовали: ${present.join(', ')}.`;
  if (absent.length) text += ` Не появлялись: ${absent.join(', ')}.`;
  return text;
}

export function hasArea(entry: DailyEntry | undefined, area: string): boolean {
  if (!entry) return false;
  if (area === 'career') return entry.careerState !== null;
  if (area === 'sport') return entry.activities.some((activity) => activity !== 'recovery');
  return entry.lifeAreas.includes(area as LifeAreaId);
}

export function periodDays(anchor: string, period: 'week' | 'month'): string[] {
  return period === 'week'
    ? dateRange(startOfWeek(anchor), endOfWeek(anchor))
    : dateRange(startOfMonth(anchor), endOfMonth(anchor));
}

export function careerLabel(value: string | null): string {
  return careerOptions.find((option) => option.id === value)?.label ?? 'Нет';
}

export function activityLabel(value: string): string {
  return activityOptions.find((option) => option.id === value)?.label ?? value;
}

function plural(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
