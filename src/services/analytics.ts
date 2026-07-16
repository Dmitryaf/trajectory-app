import type { DailyEntry, EveningFactorId, LifeAreaId, LifeEventRecord, Option, ResultRecord } from '../types';
import { activityOptions, careerOptions, eveningFactorOptions, externalCareerStates, lifeAreaOptions, specialDayOptions } from '../types';
import { dateRange, endOfMonth, endOfWeek, formatMinutes, startOfMonth, startOfWeek } from './dates';

export type PeriodSummary = {
  entriesCount: number;
  averageSleep: number | null;
  averageEnergy: number | null;
  averageSleepQuality: number | null;
  careerDays: number;
  externalSteps: number;
  sportSessions: number;
  specialDays: number;
  areaCounts: Record<string, number>;
};

export type Observation = {
  id: string;
  title: string;
  text: string;
};

export type FactorSummary = {
  id: EveningFactorId;
  label: string;
  icon?: string;
  count: number;
  averageSleep: number | null;
  averageEnergy: number | null;
};

export type ReviewCue = {
  id: string;
  title: string;
  text: string;
  tone: 'good' | 'warning' | 'neutral';
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
    specialDays: entries.filter((entry) => entry.specialDay !== null).length,
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

export function entriesForPeriod(entries: DailyEntry[], start: string, end: string): DailyEntry[] {
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

export function hasMovement(entry: DailyEntry): boolean {
  return entry.activities.some((activity) => activity !== 'recovery');
}

export function buildObservations(entries: DailyEntry[]): Observation[] {
  const observations: Observation[] = [];
  const energyEntries = entries.filter((entry) => entry.energy !== null);
  const movementEntries = energyEntries.filter(hasMovement);
  const stillEntries = energyEntries.filter((entry) => !hasMovement(entry));
  const restedEntries = energyEntries.filter((entry) => (entry.sleepMinutes ?? 0) >= 420);
  const shortSleepEntries = energyEntries.filter((entry) => entry.sleepMinutes !== null && entry.sleepMinutes < 420);
  const specialEntries = entries.filter((entry) => entry.specialDay !== null);

  const movementEnergy = average(movementEntries.map((entry) => entry.energy));
  const stillEnergy = average(stillEntries.map((entry) => entry.energy));
  if (movementEntries.length >= 2 && stillEntries.length >= 2 && movementEnergy !== null && stillEnergy !== null && Math.abs(movementEnergy - stillEnergy) >= 0.5) {
    const direction = movementEnergy > stillEnergy ? 'выше' : 'ниже';
    observations.push({
      id: 'movement-energy',
      title: 'Движение и энергия',
      text: `В дни с движением энергия в среднем ${direction}: ${formatNumber(movementEnergy)} против ${formatNumber(stillEnergy)}.`,
    });
  }

  const restedEnergy = average(restedEntries.map((entry) => entry.energy));
  const shortSleepEnergy = average(shortSleepEntries.map((entry) => entry.energy));
  if (restedEntries.length >= 2 && shortSleepEntries.length >= 2 && restedEnergy !== null && shortSleepEnergy !== null && Math.abs(restedEnergy - shortSleepEnergy) >= 0.5) {
    const direction = restedEnergy > shortSleepEnergy ? 'выше' : 'ниже';
    observations.push({
      id: 'sleep-energy',
      title: 'Сон и энергия',
      text: `После сна от 7 часов энергия в среднем ${direction}: ${formatNumber(restedEnergy)} против ${formatNumber(shortSleepEnergy)}.`,
    });
  }

  if (specialEntries.length) {
    observations.push({
      id: 'special-days',
      title: 'Особые дни',
      text: `${specialEntries.length} ${plural(specialEntries.length, 'день отмечен', 'дня отмечены', 'дней отмечены')} как особые. Их стоит учитывать отдельно от обычного ритма.`,
    });
  }

  const leadingFactor = factorSummaries(entries)[0];
  if (leadingFactor && leadingFactor.count >= 2) {
    const details = [
      leadingFactor.averageSleep !== null ? `сон ${formatMinutes(Math.round(leadingFactor.averageSleep))}` : '',
      leadingFactor.averageEnergy !== null ? `энергия ${formatNumber(leadingFactor.averageEnergy)}` : ''
    ].filter(Boolean).join(', ');
    observations.push({
      id: 'evening-factor',
      title: 'Повторяющийся фактор',
      text: `${leadingFactor.label.toLowerCase()} встречался ${leadingFactor.count} ${plural(leadingFactor.count, 'раз', 'раза', 'раз')}${details ? `: ${details}` : ''}.`,
    });
  }

  return observations;
}

export function factorSummaries(entries: DailyEntry[]): FactorSummary[] {
  return eveningFactorOptions
    .map((option) => {
      const matching = entries.filter((entry) => entry.eveningFactors.includes(option.id));
      return {
        id: option.id,
        label: option.label,
        icon: option.icon,
        count: matching.length,
        averageSleep: average(matching.map((entry) => entry.sleepMinutes)),
        averageEnergy: average(matching.map((entry) => entry.energy)),
      };
    })
    .filter((summary) => summary.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildReviewCues(period: 'week' | 'month', entries: DailyEntry[], results: ResultRecord[], lifeEvents: LifeEventRecord[], externalCareerIds: string[] = externalCareerStates): ReviewCue[] {
  const summary = summarize(entries, externalCareerIds);
  const factors = factorSummaries(entries);
  const cues: ReviewCue[] = [];
  const enoughEntries = period === 'week' ? summary.entriesCount >= 4 : summary.entriesCount >= 12;
  const minTarget = period === 'week' ? '4 дня' : '12 дней';

  cues.push({
    id: 'coverage',
    title: enoughEntries ? 'Данных достаточно для вывода' : 'Данных пока мало',
    text: enoughEntries
      ? `${summary.entriesCount} ${plural(summary.entriesCount, 'заполненный день', 'заполненных дня', 'заполненных дней')} уже дают рабочую картину периода.`
      : `Для уверенного обзора лучше иметь хотя бы ${minTarget}. Сейчас есть ${summary.entriesCount}.`,
    tone: enoughEntries ? 'good' : 'warning',
  });

  const shortSleepDays = entries.filter((entry) => entry.sleepMinutes !== null && entry.sleepMinutes < 420).length;
  if (shortSleepDays >= 2) {
    cues.push({
      id: 'short-sleep',
      title: 'Сон проседал несколько раз',
      text: `${shortSleepDays} ${plural(shortSleepDays, 'день был', 'дня были', 'дней были')} со сном меньше 7 часов. Это стоит проверить перед выводами про мотивацию и дисциплину.`,
      tone: 'warning',
    });
  } else if (summary.averageSleep !== null) {
    cues.push({
      id: 'sleep-baseline',
      title: 'База сна',
      text: `Средний сон за период: ${formatMinutes(Math.round(summary.averageSleep))}. Это первый контекст для оценки энергии и действий.`,
      tone: 'neutral',
    });
  }

  const leadingFactor = factors[0];
  if (leadingFactor && leadingFactor.count >= 2) {
    cues.push({
      id: 'factor',
      title: 'Повторяющийся мешающий фактор',
      text: `${leadingFactor.label} встретился ${leadingFactor.count} ${plural(leadingFactor.count, 'раз', 'раза', 'раз')}. На следующий период лучше менять один такой фактор, а не всю жизнь сразу.`,
      tone: 'warning',
    });
  }

  if (summary.externalSteps > 0 || summary.careerDays > 0) {
    cues.push({
      id: 'career',
      title: summary.externalSteps > 0 ? 'Были внешние карьерные шаги' : 'Карьера была в контакте',
      text: `${summary.careerDays} карьерных ${plural(summary.careerDays, 'день', 'дня', 'дней')}, ${summary.externalSteps} внешних ${plural(summary.externalSteps, 'шаг', 'шага', 'шагов')}. Это лучше оценивать фактами, а не ощущением "я ничего не делал".`,
      tone: summary.externalSteps > 0 ? 'good' : 'neutral',
    });
  }

  if (summary.specialDays || lifeEvents.length) {
    cues.push({
      id: 'context',
      title: 'Есть поправка на контекст',
      text: `${summary.specialDays} особых ${plural(summary.specialDays, 'день', 'дня', 'дней')} и ${lifeEvents.length} ${plural(lifeEvents.length, 'событие архива', 'события архива', 'событий архива')}. Не сравнивай этот период с обычным ритмом напрямую.`,
      tone: 'neutral',
    });
  }

  if (results.length) {
    cues.push({
      id: 'results',
      title: 'Есть завершённые вещи',
      text: `${results.length} ${plural(results.length, 'результат', 'результата', 'результатов')} за период. Это отдельный слой прогресса, даже если состояние было неровным.`,
      tone: 'good',
    });
  }

  return cues.slice(0, 6);
}

export function buildReviewQuestions(period: 'week' | 'month'): string[] {
  const label = period === 'week' ? 'неделе' : 'месяце';
  return [
    `Что в этой ${label} повторялось чаще всего и реально влияло на состояние?`,
    'Какой один фактор стоит уменьшить в следующем периоде?',
    'Какое одно действие или условие стоит сохранить, потому что оно помогало?',
  ];
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

export function specialDayLabel(value: string | null): string {
  return specialDayOptions.find((option) => option.id === value)?.label ?? 'Особый день';
}

export function eveningFactorLabel(value: string): string {
  return eveningFactorOptions.find((option) => option.id === value)?.label ?? value;
}

function formatNumber(value: number): string {
  return value.toFixed(1).replace('.0', '');
}

function plural(value: number, one: string, few: string, many: string): string {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
