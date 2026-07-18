import type { ActionDirectionId, DailyEntry, EveningFactorId, LifeAreaId, LifeEventRecord, Option, ResultRecord } from '../types';
import { actionDirectionOptions, activityOptions, careerOptions, eveningFactorOptions, externalCareerStates, lifeAreaOptions, specialDayOptions } from '../types';
import { addDays, dateRange, endOfMonth, endOfWeek, formatMinutes, startOfMonth, startOfWeek, todayKey } from './dates';

export type PeriodSummary = {
  entriesCount: number;
  ordinaryEntriesCount: number;
  coveredEntriesCount: number;
  ordinaryCoveredEntriesCount: number;
  ordinaryCoreEntriesCount: number;
  sleepSamples: number;
  timeInBedSamples: number;
  energySamples: number;
  sleepQualitySamples: number;
  weightSamples: number;
  nutritionSamples: number;
  actionDirectionSamples: number;
  experimentMarkedDays: number;
  experimentCompletedDays: number;
  sleepTimingSamples: number;
  averageSleep: number | null;
  averageTimeInBed: number | null;
  averageSleepEfficiency: number | null;
  averageEnergy: number | null;
  averageSleepQuality: number | null;
  careerDays: number;
  externalSteps: number;
  movementDays: number;
  movementSamples: number;
  nutritionSupportDays: number;
  nutritionBlockDays: number;
  averageWeightKg: number | null;
  actionDirectionCounts: Record<ActionDirectionId, number>;
  externalActionDays: number;
  preparationDays: number;
  driftDays: number;
  specialDays: number;
  bedtimeVariationMinutes: number | null;
  wakeTimeVariationMinutes: number | null;
  areaCounts: Record<string, number>;
  lifeAreaSamples: number;
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
  averageSleepWithout: number | null;
  sleepSamples: number;
  sleepSamplesWithout: number;
  averageEnergy: number | null;
  averageEnergyWithout: number | null;
  energySamples: number;
  energySamplesWithout: number;
};

export type ReviewCue = {
  id: string;
  title: string;
  text: string;
  tone: 'good' | 'warning' | 'neutral';
};

export type DataCoverageLevel = 0 | 1 | 2;

export type EventComparisonMetric = {
  id: 'sleep' | 'energy' | 'weight' | 'external' | 'nutrition' | 'results';
  label: string;
  format: 'minutes' | 'number' | 'weight' | 'percent' | 'count';
  before: number | null;
  after: number | null;
  beforeSamples: number | null;
  afterSamples: number | null;
};

export type EventComparison = {
  windowDays: number;
  beforeStart: string;
  beforeEnd: string;
  afterStart: string;
  afterEnd: string;
  beforeEntries: number;
  afterEntries: number;
  metrics: EventComparisonMetric[];
};

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function sampleCount(values: Array<number | null>): number {
  return values.filter((value) => value !== null).length;
}

export function summarize(entries: DailyEntry[], externalCareerIds: string[] = externalCareerStates): PeriodSummary {
  const ordinaryEntries = entries.filter((entry) => entry.specialDay === null);
  const coveredEntries = entries.filter((entry) => dataCoverageLevel(entry) > 0);
  const ordinaryCoveredEntries = ordinaryEntries.filter((entry) => dataCoverageLevel(entry) > 0);
  const areaCounts = Object.fromEntries(lifeAreaOptions.map(({ id }) => [id, 0])) as Record<string, number>;
  const actionDirectionCounts = Object.fromEntries(actionDirectionOptions.map(({ id }) => [id, 0])) as Record<ActionDirectionId, number>;
  for (const entry of entries) {
    for (const area of entry.lifeAreas) areaCounts[area] = (areaCounts[area] ?? 0) + 1;
    if (entry.actionDirection) actionDirectionCounts[entry.actionDirection] += 1;
  }

  return {
    entriesCount: entries.length,
    ordinaryEntriesCount: ordinaryEntries.length,
    coveredEntriesCount: coveredEntries.length,
    ordinaryCoveredEntriesCount: ordinaryCoveredEntries.length,
    ordinaryCoreEntriesCount: ordinaryEntries.filter((entry) => dataCoverageLevel(entry) === 2).length,
    sleepSamples: sampleCount(ordinaryEntries.map((entry) => entry.sleepMinutes)),
    timeInBedSamples: sampleCount(ordinaryEntries.map((entry) => entry.timeInBedMinutes)),
    energySamples: sampleCount(ordinaryEntries.map((entry) => entry.energy)),
    sleepQualitySamples: sampleCount(ordinaryEntries.map((entry) => entry.sleepQuality)),
    weightSamples: sampleCount(ordinaryEntries.map((entry) => entry.weightKg)),
    nutritionSamples: entries.filter((entry) => entry.nutritionState !== null).length,
    actionDirectionSamples: entries.filter((entry) => entry.actionDirection !== null).length,
    experimentMarkedDays: entries.filter((entry) => entry.experimentCompleted !== null).length,
    experimentCompletedDays: entries.filter((entry) => entry.experimentCompleted === true).length,
    sleepTimingSamples: ordinaryEntries.filter((entry) => clockMinutes(entry.bedtime, true) !== null && clockMinutes(entry.wakeTime, false) !== null).length,
    averageSleep: average(ordinaryEntries.map((entry) => entry.sleepMinutes)),
    averageTimeInBed: average(ordinaryEntries.map((entry) => entry.timeInBedMinutes)),
    averageSleepEfficiency: average(ordinaryEntries.map((entry) => sleepEfficiency(entry))),
    averageEnergy: average(ordinaryEntries.map((entry) => entry.energy)),
    averageSleepQuality: average(ordinaryEntries.map((entry) => entry.sleepQuality)),
    careerDays: entries.filter((entry) => careerStatesForEntry(entry).length > 0).length,
    externalSteps: entries.filter((entry) => careerStatesForEntry(entry).some((state) => externalCareerIds.includes(state))).length,
    movementDays: entries.filter(hasMovement).length,
    movementSamples: entries.filter((entry) => entry.activitiesRecorded).length,
    nutritionSupportDays: entries.filter((entry) => entry.nutritionState === 'supports_goal').length,
    nutritionBlockDays: entries.filter((entry) => entry.nutritionState === 'blocks_goal').length,
    averageWeightKg: average(ordinaryEntries.map((entry) => entry.weightKg)),
    actionDirectionCounts,
    externalActionDays: actionDirectionCounts.external,
    preparationDays: actionDirectionCounts.preparation,
    driftDays: actionDirectionCounts.drift,
    specialDays: entries.filter((entry) => entry.specialDay !== null).length,
    bedtimeVariationMinutes: clockVariation(ordinaryEntries.map((entry) => clockMinutes(entry.bedtime, true))),
    wakeTimeVariationMinutes: clockVariation(ordinaryEntries.map((entry) => clockMinutes(entry.wakeTime, false))),
    areaCounts,
    lifeAreaSamples: entries.filter((entry) => entry.lifeAreasRecorded).length,
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

export function dataCoverageLevel(entry: DailyEntry): DataCoverageLevel {
  const hasState = entry.sleepMinutes !== null
    || entry.timeInBedMinutes !== null
    || entry.energy !== null
    || entry.sleepQuality !== null
    || entry.bedtime.length > 0
    || entry.wakeTime.length > 0;
  const hasAction = entry.actionDirection !== null
    || careerStatesForEntry(entry).length > 0
    || entry.activitiesRecorded
    || entry.lifeAreasRecorded
    || entry.importantFact.trim().length > 0;
  const hasNutrition = entry.nutritionState !== null || entry.weightKg !== null;
  const coreDomains = [hasState, hasAction, hasNutrition].filter(Boolean).length;
  if (coreDomains >= 2) return 2;

  const hasContext = entry.specialDay !== null
    || entry.eveningFactors.length > 0
    || entry.stateContext.trim().length > 0
    || entry.eveningFactorNote.trim().length > 0;
  return coreDomains === 1 || hasContext ? 1 : 0;
}

export function buildCoverageSeries(entries: DailyEntry[], start: string, end: string): Array<[string, DataCoverageLevel]> {
  const entriesByDate = new Map(entries.map((entry) => [entry.date, entry]));
  return dateRange(start, end).map((date) => {
    const entry = entriesByDate.get(date);
    return [date, entry ? dataCoverageLevel(entry) : 0];
  });
}

export function buildEventComparison(
  eventDate: string,
  entries: DailyEntry[],
  results: ResultRecord[] = [],
  externalCareerIds: string[] = externalCareerStates,
  requestedWindowDays = 14,
  observationEnd = todayKey(),
): EventComparison | null {
  if (observationEnd <= eventDate) return null;
  const availableAfterDays = dateRange(addDays(eventDate, 1), observationEnd).length;
  const windowDays = Math.min(Math.max(1, requestedWindowDays), availableAfterDays);
  const beforeStart = addDays(eventDate, -windowDays);
  const beforeEnd = addDays(eventDate, -1);
  const afterStart = addDays(eventDate, 1);
  const afterEnd = addDays(eventDate, windowDays);
  const before = entriesForPeriod(entries, beforeStart, beforeEnd);
  const after = entriesForPeriod(entries, afterStart, afterEnd);
  const beforeSummary = summarize(before, externalCareerIds);
  const afterSummary = summarize(after, externalCareerIds);
  const beforeResults = resultsForPeriod(results, beforeStart, beforeEnd).length;
  const afterResults = resultsForPeriod(results, afterStart, afterEnd).length;

  return {
    windowDays,
    beforeStart,
    beforeEnd,
    afterStart,
    afterEnd,
    beforeEntries: beforeSummary.coveredEntriesCount,
    afterEntries: afterSummary.coveredEntriesCount,
    metrics: [
      comparisonMetric('sleep', 'Сон', 'minutes', beforeSummary.averageSleep, afterSummary.averageSleep, beforeSummary.sleepSamples, afterSummary.sleepSamples),
      comparisonMetric('energy', 'Энергия', 'number', beforeSummary.averageEnergy, afterSummary.averageEnergy, beforeSummary.energySamples, afterSummary.energySamples),
      comparisonMetric('weight', 'Вес', 'weight', beforeSummary.averageWeightKg, afterSummary.averageWeightKg, beforeSummary.weightSamples, afterSummary.weightSamples),
      comparisonMetric('external', 'Внешние действия', 'percent', ratioPercent(beforeSummary.externalActionDays, beforeSummary.actionDirectionSamples), ratioPercent(afterSummary.externalActionDays, afterSummary.actionDirectionSamples), beforeSummary.actionDirectionSamples, afterSummary.actionDirectionSamples),
      comparisonMetric('nutrition', 'Питание поддержало цель', 'percent', ratioPercent(beforeSummary.nutritionSupportDays, beforeSummary.nutritionSamples), ratioPercent(afterSummary.nutritionSupportDays, afterSummary.nutritionSamples), beforeSummary.nutritionSamples, afterSummary.nutritionSamples),
      comparisonMetric('results', 'Результаты', 'count', beforeResults, afterResults, null, null),
    ],
  };
}

export function weekSummaryText(summary: PeriodSummary, activeAreas: LifeAreaId[], areaOptions: Option[] = lifeAreaOptions): string {
  if (!summary.coveredEntriesCount) return 'Пока нет содержательных записей за эту неделю. Здесь появится краткая сводка фактов.';

  const labels = new Map(areaOptions.map((item) => [item.id, item.label]));
  const present = activeAreas.filter((area) => summary.areaCounts[area] > 0).map((area) => (labels.get(area) ?? area).toLowerCase());
  const absent = summary.lifeAreaSamples > 0
    ? activeAreas.filter((area) => (summary.areaCounts[area] ?? 0) === 0).map((area) => (labels.get(area) ?? area).toLowerCase())
    : [];
  const parts = [
    `${summary.careerDays} карьерных ${plural(summary.careerDays, 'день', 'дня', 'дней')}`,
    `${summary.externalSteps} ${plural(summary.externalSteps, 'день', 'дня', 'дней')} с внешним карьерным контактом`,
    `${summary.movementDays} ${plural(summary.movementDays, 'день с движением', 'дня с движением', 'дней с движением')}`
  ];
  if (summary.nutritionSupportDays || summary.nutritionBlockDays) {
    parts.push(`питание поддержало ${summary.nutritionSupportDays}, мешало ${summary.nutritionBlockDays}`);
  }
  if (summary.externalActionDays || summary.preparationDays || summary.driftDays) {
    parts.push(`направление: внешние ${summary.externalActionDays}, подготовка ${summary.preparationDays}, в сторону ${summary.driftDays}`);
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

export function careerStatesForEntry(entry: DailyEntry): string[] {
  return entry.careerStates.length ? entry.careerStates : entry.careerState ? [entry.careerState] : [];
}

export function hasMovement(entry: DailyEntry): boolean {
  return entry.activities.some((activity) => activity !== 'recovery');
}

export function buildObservations(entries: DailyEntry[]): Observation[] {
  const observations: Observation[] = [];
  const ordinaryEntries = entries.filter((entry) => entry.specialDay === null);
  const energyEntries = ordinaryEntries.filter((entry) => entry.energy !== null);
  const movementMarkedEntries = energyEntries.filter((entry) => entry.activitiesRecorded);
  const movementEntries = movementMarkedEntries.filter(hasMovement);
  const stillEntries = movementMarkedEntries.filter((entry) => !hasMovement(entry));
  const restedEntries = energyEntries.filter((entry) => (entry.sleepMinutes ?? 0) >= 420);
  const shortSleepEntries = energyEntries.filter((entry) => entry.sleepMinutes !== null && entry.sleepMinutes < 420);
  const specialEntries = entries.filter((entry) => entry.specialDay !== null);

  const movementEnergy = average(movementEntries.map((entry) => entry.energy));
  const stillEnergy = average(stillEntries.map((entry) => entry.energy));
  if (movementEntries.length >= 4 && stillEntries.length >= 4 && movementEnergy !== null && stillEnergy !== null && Math.abs(movementEnergy - stillEnergy) >= 0.5) {
    const direction = movementEnergy > stillEnergy ? 'выше' : 'ниже';
    observations.push({
      id: 'movement-energy',
      title: 'Движение и энергия',
      text: `В дни с движением энергия в среднем ${direction}: ${formatNumber(movementEnergy)} против ${formatNumber(stillEnergy)}.`,
    });
  }

  const restedEnergy = average(restedEntries.map((entry) => entry.energy));
  const shortSleepEnergy = average(shortSleepEntries.map((entry) => entry.energy));
  if (restedEntries.length >= 4 && shortSleepEntries.length >= 4 && restedEnergy !== null && shortSleepEnergy !== null && Math.abs(restedEnergy - shortSleepEnergy) >= 0.5) {
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
    const details = factorComparisonText(leadingFactor);
    observations.push({
      id: 'evening-factor',
      title: 'Повторяющийся фактор',
      text: `${leadingFactor.label} отмечался ${leadingFactor.count} ${plural(leadingFactor.count, 'раз', 'раза', 'раз')}.${details ? ` ${details}` : ' Для сравнения пока мало обычных дней.'}`,
    });
  }

  return observations;
}

export function factorSummaries(entries: DailyEntry[]): FactorSummary[] {
  const ordinaryEntries = entries.filter((entry) => entry.specialDay === null);
  return eveningFactorOptions
    .map((option) => {
      const matching = ordinaryEntries.filter((entry) => entry.eveningFactors.includes(option.id));
      const other = ordinaryEntries.filter((entry) => entry.eveningFactorsRecorded && !entry.eveningFactors.includes(option.id));
      return {
        id: option.id,
        label: option.label,
        icon: option.icon,
        count: matching.length,
        averageSleep: average(matching.map((entry) => entry.sleepMinutes)),
        averageSleepWithout: average(other.map((entry) => entry.sleepMinutes)),
        sleepSamples: sampleCount(matching.map((entry) => entry.sleepMinutes)),
        sleepSamplesWithout: sampleCount(other.map((entry) => entry.sleepMinutes)),
        averageEnergy: average(matching.map((entry) => entry.energy)),
        averageEnergyWithout: average(other.map((entry) => entry.energy)),
        energySamples: sampleCount(matching.map((entry) => entry.energy)),
        energySamplesWithout: sampleCount(other.map((entry) => entry.energy)),
      };
    })
    .filter((summary) => summary.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function buildReviewCues(period: 'week' | 'month', entries: DailyEntry[], results: ResultRecord[], lifeEvents: LifeEventRecord[], externalCareerIds: string[] = externalCareerStates): ReviewCue[] {
  const summary = summarize(entries, externalCareerIds);
  const factors = factorSummaries(entries);
  const cues: ReviewCue[] = [];
  const enoughEntries = period === 'week'
    ? summary.ordinaryCoveredEntriesCount >= 4 && summary.ordinaryCoreEntriesCount >= 2
    : summary.ordinaryCoveredEntriesCount >= 12 && summary.ordinaryCoreEntriesCount >= 6;
  const minTarget = period === 'week' ? '4 содержательных дня, из них 2 с основными данными' : '12 содержательных дней, из них 6 с основными данными';

  cues.push({
    id: 'coverage',
    title: enoughEntries ? 'Данных достаточно для обзора' : 'Данных пока мало',
    text: enoughEntries
      ? `${summary.ordinaryCoveredEntriesCount} содержательных дней, из них ${summary.ordinaryCoreEntriesCount} с основными данными, уже дают рабочую картину периода.`
      : `Для рабочего обзора лучше иметь хотя бы ${minTarget} без отметки «особый день». Сейчас: ${summary.ordinaryCoveredEntriesCount} и ${summary.ordinaryCoreEntriesCount}.`,
    tone: enoughEntries ? 'good' : 'warning',
  });

  const shortSleepDays = entries.filter((entry) => entry.specialDay === null && entry.sleepMinutes !== null && entry.sleepMinutes < 420).length;
  if (shortSleepDays >= 2) {
    cues.push({
      id: 'short-sleep',
      title: 'Сон проседал несколько раз',
      text: `${shortSleepDays} ${plural(shortSleepDays, 'день был', 'дня были', 'дней были')} со сном меньше 7 часов. Это стоит проверить перед выводами про действия и состояние.`,
      tone: 'warning',
    });
  } else if (summary.averageSleep !== null) {
    cues.push({
      id: 'sleep-baseline',
      title: 'База сна',
      text: sleepContextText(summary),
      tone: 'neutral',
    });
  }

  const timingVariation = Math.max(summary.bedtimeVariationMinutes ?? 0, summary.wakeTimeVariationMinutes ?? 0);
  if (summary.sleepTimingSamples >= 4 && timingVariation >= 90) {
    cues.push({
      id: 'sleep-regularity',
      title: 'Время сна заметно менялось',
      text: `Разброс времени отхода ко сну или подъёма около ${Math.round(timingVariation)} мин. Это отдельный контекст помимо длительности сна.`,
      tone: 'neutral',
    });
  }

  const leadingFactor = factors[0];
  if (leadingFactor && leadingFactor.count >= 2) {
    const comparison = factorComparisonText(leadingFactor);
    cues.push({
      id: 'factor',
      title: 'Повторяющийся фактор',
      text: `${leadingFactor.label} отмечался ${leadingFactor.count} ${plural(leadingFactor.count, 'раз', 'раза', 'раз')}.${comparison ? ` ${comparison}` : ' Сравнительных данных пока мало.'}`,
      tone: 'warning',
    });
  }

  if (summary.externalSteps > 0 || summary.careerDays > 0) {
    cues.push({
      id: 'career',
      title: summary.externalSteps > 0 ? 'Были дни с внешним карьерным контактом' : 'Карьера появлялась',
      text: `${summary.careerDays} карьерных ${plural(summary.careerDays, 'день', 'дня', 'дней')}, из них ${summary.externalSteps} с внешним контактом. Так проще сверить ощущение с фактами.`,
      tone: summary.externalSteps > 0 ? 'good' : 'neutral',
    });
  }

  if (summary.preparationDays >= 3 && summary.externalActionDays <= 1) {
    cues.push({
      id: 'direction-preparation',
      title: 'Много подготовки, мало внешнего контакта',
      text: `${summary.preparationDays} ${plural(summary.preparationDays, 'день', 'дня', 'дней')} отмечены как подготовка, внешних шагов — ${summary.externalActionDays}. Стоит проверить, не заменяет ли подготовка обратную связь от реальности.`,
      tone: 'warning',
    });
  } else if (summary.externalActionDays >= 2) {
    cues.push({
      id: 'direction-external',
      title: 'Были внешние шаги',
      text: `${summary.externalActionDays} ${plural(summary.externalActionDays, 'день', 'дня', 'дней')} с действиями, которые выходили наружу. Это хороший слой для проверки целей фактами.`,
      tone: 'good',
    });
  }

  if (summary.driftDays >= 2) {
    cues.push({
      id: 'direction-drift',
      title: 'Дни уходили в сторону',
      text: `${summary.driftDays} ${plural(summary.driftDays, 'день', 'дня', 'дней')} отмечены как уход в сторону. В разборе лучше искать повторяющийся сценарий, а не обвинять себя.`,
      tone: 'warning',
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

  if (summary.nutritionBlockDays >= 2 || summary.nutritionSupportDays >= 3) {
    cues.push({
      id: 'nutrition',
      title: summary.nutritionBlockDays >= 2 ? 'Питание мешало цели' : 'Питание поддерживало цель',
      text: summary.nutritionBlockDays >= 2
        ? `${summary.nutritionBlockDays} ${plural(summary.nutritionBlockDays, 'день', 'дня', 'дней')} питание отмечено как мешающее цели. Лучше искать один повторяющийся сценарий, а не менять всё сразу.`
        : `${summary.nutritionSupportDays} ${plural(summary.nutritionSupportDays, 'день', 'дня', 'дней')} питание поддерживало цель. Это стоит сохранить как рабочее условие.`,
      tone: summary.nutritionBlockDays >= 2 ? 'warning' : 'good',
    });
  }

  if (summary.experimentMarkedDays >= 2) {
    cues.push({
      id: 'experiment',
      title: 'Есть данные эксперимента',
      text: `Условие выполнено в ${summary.experimentCompletedDays} из ${summary.experimentMarkedDays} отмеченных дней. Сначала оцени соблюдение, затем сравни выбранный показатель до и во время эксперимента.`,
      tone: 'neutral',
    });
  }

  if (summary.specialDays || lifeEvents.length) {
    cues.push({
      id: 'context',
      title: 'Есть поправка на контекст',
      text: `${summary.specialDays} особых ${plural(summary.specialDays, 'день', 'дня', 'дней')} и ${lifeEvents.length} ${plural(lifeEvents.length, 'событие архива', 'события архива', 'событий архива')}. Такой период лучше не сравнивать с обычным ритмом напрямую.`,
      tone: 'neutral',
    });
  }

  return limitCues(cues, ['coverage', 'results', 'context']);
}

export function buildRangeReviewCues(rangeMonths: number, entries: DailyEntry[], results: ResultRecord[], lifeEvents: LifeEventRecord[], externalCareerIds: string[] = externalCareerStates): ReviewCue[] {
  const summary = summarize(entries, externalCareerIds);
  const cues: ReviewCue[] = [];
  const coveredEntries = entries.filter((entry) => dataCoverageLevel(entry) > 0);
  const monthsWithData = new Set(coveredEntries.map((entry) => entry.date.slice(0, 7))).size;
  const enoughEntries = summary.ordinaryCoveredEntriesCount >= rangeMonths * 8
    && summary.ordinaryCoreEntriesCount >= rangeMonths * 4
    && monthsWithData >= Math.max(2, rangeMonths - 1);

  cues.push({
    id: 'coverage',
    title: enoughEntries ? 'Период покрыт достаточно ровно' : 'Покрытие периода неровное',
    text: `${summary.coveredEntriesCount} содержательных дней, из них ${summary.ordinaryCoreEntriesCount} с основными данными, в ${monthsWithData} из ${rangeMonths} мес.`,
    tone: enoughEntries ? 'good' : 'warning',
  });

  const factor = factorSummaries(entries).find((item) => item.count >= Math.max(3, rangeMonths));
  if (factor) {
    const comparison = factorComparisonText(factor);
    cues.push({
      id: 'factor',
      title: 'Устойчивый вечерний фактор',
      text: `${factor.label} отмечался ${factor.count} ${plural(factor.count, 'раз', 'раза', 'раз')}.${comparison ? ` ${comparison}` : ' Сравнительных данных пока мало.'}`,
      tone: 'neutral',
    });
  }

  if (summary.actionDirectionSamples >= Math.max(6, rangeMonths * 2)) {
    const externalRate = ratioPercent(summary.externalActionDays, summary.actionDirectionSamples) ?? 0;
    const preparationRate = ratioPercent(summary.preparationDays, summary.actionDirectionSamples) ?? 0;
    const driftRate = ratioPercent(summary.driftDays, summary.actionDirectionSamples) ?? 0;
    if (preparationRate >= 60 && externalRate <= 20) {
      cues.push({ id: 'direction-preparation', title: 'Подготовка редко переходила наружу', text: `Подготовка — ${preparationRate}% отмеченных дней направления, внешние шаги — ${externalRate}%. Стоит проверить критерий реального контакта с целью.`, tone: 'warning' });
    } else if (externalRate >= 35) {
      cues.push({ id: 'direction-external', title: 'Внешний контакт сохранялся', text: `Внешние шаги появлялись в ${externalRate}% дней с отмеченным направлением. Сверь это с реальными результатами периода.`, tone: 'good' });
    }
    if (driftRate >= 30) {
      cues.push({ id: 'direction-drift', title: 'Уход в сторону повторялся', text: `${driftRate}% дней с отмеченным направлением ушли в сторону. Ищи повторяющееся условие, а не одну причину всего периода.`, tone: 'warning' });
    }
  }

  if (results.length) {
    cues.push({ id: 'results', title: 'Есть завершённые результаты', text: `${results.length} ${plural(results.length, 'результат', 'результата', 'результатов')} за период. Сопоставь их с внешними действиями, а не только с занятостью.`, tone: 'good' });
  }

  if (summary.specialDays || lifeEvents.length) {
    cues.push({ id: 'context', title: 'Траектория менялась вместе с контекстом', text: `${summary.specialDays} особых ${plural(summary.specialDays, 'день', 'дня', 'дней')} и ${lifeEvents.length} ${plural(lifeEvents.length, 'событие архива', 'события архива', 'событий архива')}. Они исключены из базовых средних состояния.`, tone: 'neutral' });
  }

  return limitCues(cues, ['coverage', 'results', 'context']);
}

function sleepEfficiency(entry: DailyEntry): number | null {
  if (entry.sleepMinutes === null || entry.timeInBedMinutes === null || entry.timeInBedMinutes <= 0) return null;
  return Math.min(100, (entry.sleepMinutes / entry.timeInBedMinutes) * 100);
}

export function ratioPercent(value: number, total: number): number | null {
  return total > 0 ? Math.round((value / total) * 100) : null;
}

function comparisonMetric(
  id: EventComparisonMetric['id'],
  label: string,
  format: EventComparisonMetric['format'],
  before: number | null,
  after: number | null,
  beforeSamples: number | null,
  afterSamples: number | null,
): EventComparisonMetric {
  return { id, label, format, before, after, beforeSamples, afterSamples };
}

function clockMinutes(value: string, shiftMorning: boolean): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hours, minutes] = value.split(':').map(Number);
  if (hours > 23 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return shiftMorning && total < 12 * 60 ? total + 24 * 60 : total;
}

function clockVariation(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value !== null);
  if (valid.length < 2) return null;
  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  const variance = valid.reduce((sum, value) => sum + (value - mean) ** 2, 0) / valid.length;
  return Math.round(Math.sqrt(variance));
}

function signedMinutes(value: number): string {
  if (value === 0) return 'без разницы';
  return `${value > 0 ? '+' : '−'}${formatMinutes(Math.abs(value))}`;
}

function signedNumber(value: number): string {
  if (Math.abs(value) < 0.05) return 'без разницы';
  return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value))}`;
}

function factorComparisonText(factor: FactorSummary): string {
  const parts: string[] = [];
  if (factor.sleepSamples >= 4 && factor.sleepSamplesWithout >= 4 && factor.averageSleep !== null && factor.averageSleepWithout !== null) {
    const difference = Math.round(factor.averageSleep - factor.averageSleepWithout);
    parts.push(`Сон: ${formatMinutes(Math.round(factor.averageSleep))} против ${formatMinutes(Math.round(factor.averageSleepWithout))} без фактора (${signedMinutes(difference)})`);
  }
  if (factor.energySamples >= 4 && factor.energySamplesWithout >= 4 && factor.averageEnergy !== null && factor.averageEnergyWithout !== null) {
    const difference = factor.averageEnergy - factor.averageEnergyWithout;
    parts.push(`энергия: ${formatNumber(factor.averageEnergy)} против ${formatNumber(factor.averageEnergyWithout)} (${signedNumber(difference)})`);
  }
  return parts.length ? `${parts.join('; ')}. Это связь, а не доказанная причина.` : '';
}

function limitCues(cues: ReviewCue[], requiredIds: string[]): ReviewCue[] {
  const selected = cues.slice(0, 6);
  for (const id of requiredIds) {
    const required = cues.find((cue) => cue.id === id);
    if (!required || selected.some((cue) => cue.id === id)) continue;
    let replaceIndex = -1;
    for (let index = selected.length - 1; index >= 0; index -= 1) {
      if (!requiredIds.includes(selected[index].id)) {
        replaceIndex = index;
        break;
      }
    }
    if (replaceIndex >= 0) selected[replaceIndex] = required;
  }
  return selected.sort((a, b) => cues.indexOf(a) - cues.indexOf(b));
}

function sleepContextText(summary: PeriodSummary): string {
  const sleep = summary.averageSleep === null ? '—' : formatMinutes(Math.round(summary.averageSleep));
  const inBed = summary.averageTimeInBed === null ? '' : `, в кровати ${formatMinutes(Math.round(summary.averageTimeInBed))}`;
  const efficiency = summary.averageSleepEfficiency === null ? '' : `, доля сна около ${Math.round(summary.averageSleepEfficiency)}%`;
  return `Средний сон за период: ${sleep}${inBed}${efficiency}. Это первый контекст для оценки энергии и действий.`;
}

export function buildReviewQuestions(period: 'week' | 'month'): string[] {
  const label = period === 'week' ? 'неделе' : 'месяце';
  return [
    `Что в этой ${label} повторялось чаще всего и могло влиять на состояние?`,
    'Что из сделанного создало обратную связь от реальности?',
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

export function actionDirectionLabel(value: string | null): string {
  return actionDirectionOptions.find((option) => option.id === value)?.label ?? 'Не отмечено';
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
