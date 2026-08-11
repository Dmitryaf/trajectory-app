import type { ContextFactorId, DailyEntry, LifeAreaId, Option } from '../types';
import {
  actionDirectionOptions,
  careerOptions,
  contextFactorOptions,
  knownActivityOptions,
  legacyCareerOptions,
  legacyContextFactorOptions,
  lifeAreaOptions,
  specialDayOptions,
} from '../types';
import { careerStatesForEntry, type PeriodSummary } from '../features/analytics/periodSummary';
import { dateRange, endOfMonth, endOfWeek, formatMinutes, startOfMonth, startOfWeek } from './dates';

export { buildCoverageSeries, dataCoverageLevel, type DataCoverageLevel } from '../features/analytics/coverage';
export { buildEventComparison, type EventComparison, type EventComparisonMetric } from '../features/analytics/eventComparison';
export { buildObservations, factorSummaries, type FactorSummary, type Observation } from '../features/analytics/observations';
export {
  careerStatesForEntry,
  entriesForMonth,
  entriesForPeriod,
  entriesForWeek,
  hasMovement,
  resultsForPeriod,
  summarize,
  type PeriodSummary,
} from '../features/analytics/periodSummary';
export { buildRangeReviewCues, buildReviewCues, ratioPercent, type ReviewCue } from '../features/analytics/reviewCues';

export function weekSummaryText(summary: PeriodSummary, activeAreas: LifeAreaId[], areaOptions: Option[] = lifeAreaOptions): string {
  if (!summary.coveredEntriesCount) return 'Пока нет заполненных записей за эту неделю. Здесь появится краткая сводка фактов.';

  const labels = new Map(areaOptions.map((item) => [item.id, item.label]));
  const present = activeAreas.filter((area) => summary.areaCounts[area] > 0).map((area) => (labels.get(area) ?? area).toLowerCase());
  const absent =
    summary.lifeAreaSamples > 0
      ? activeAreas.filter((area) => (summary.areaCounts[area] ?? 0) === 0).map((area) => (labels.get(area) ?? area).toLowerCase())
      : [];
  const parts = [
    `работа отмечена в ${summary.careerDays} из ${summary.careerSamples} заполненных дней этого блока`,
    `${summary.movementDays} ${plural(summary.movementDays, 'день с активностью', 'дня с активностью', 'дней с активностью')}`,
  ];
  if (summary.nutritionSupportDays || summary.nutritionBlockDays) {
    parts.push(`питание поддержало ${summary.nutritionSupportDays}, мешало ${summary.nutritionBlockDays}`);
  }
  if (summary.externalActionDays || summary.preparationDays || summary.driftDays) {
    parts.push(
      `действия по цели: конкретные действия ${summary.externalActionDays}, подготовка ${summary.preparationDays}, занимался другим ${summary.driftDays}`,
    );
  }
  if (summary.averageSleep !== null) parts.push(`средний сон ${formatMinutes(Math.round(summary.averageSleep))}`);
  if (summary.averageTimeInBed !== null && summary.averageSleep !== null && summary.averageTimeInBed - summary.averageSleep >= 45) {
    parts.push(`в кровати ${formatMinutes(Math.round(summary.averageTimeInBed))}`);
  }
  let text = `За неделю: ${parts.join(', ')}.`;
  if (present.length) text += ` Присутствовали: ${present.join(', ')}.`;
  if (absent.length) text += ` Не отмечались: ${absent.join(', ')}.`;
  return text;
}

export function hasArea(entry: DailyEntry | undefined, area: string): boolean {
  if (!entry) return false;
  if (area === 'career') return careerStatesForEntry(entry).length > 0;
  if (area === 'sport') return entry.activities.some((activity) => activity !== 'recovery');
  return entry.lifeAreas.includes(area as LifeAreaId);
}

export function periodDays(anchor: string, period: 'week' | 'month'): string[] {
  return period === 'week' ? dateRange(startOfWeek(anchor), endOfWeek(anchor)) : dateRange(startOfMonth(anchor), endOfMonth(anchor));
}

export function careerLabel(value: string | null): string {
  return [...careerOptions, ...legacyCareerOptions].find((option) => option.id === value)?.label ?? 'Нет';
}

export function activityLabel(value: string): string {
  return knownActivityOptions.find((option) => option.id === value)?.label ?? value;
}

export function specialDayLabel(value: string | null): string {
  return specialDayOptions.find((option) => option.id === value)?.label ?? 'Особый день';
}

export function contextFactorLabel(value: string, factorOptions: Option<ContextFactorId>[] = contextFactorOptions): string {
  return (
    factorOptions.find((option) => option.id === value)?.label ??
    legacyContextFactorOptions.find((option) => option.id === value)?.label ??
    value
  );
}

export function actionDirectionLabel(value: string | null): string {
  return actionDirectionOptions.find((option) => option.id === value)?.label ?? 'Не отмечено';
}

function plural(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
