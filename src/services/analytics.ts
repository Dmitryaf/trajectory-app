import type { DailyEntry, EveningFactorId, LifeAreaId, LifeEventRecord, Option, ResultRecord } from '../types';
import { actionDirectionOptions, activityOptions, careerOptions, eveningFactorOptions, externalCareerStates, lifeAreaOptions, specialDayOptions } from '../types';
import { buildCoverageSeries, dataCoverageLevel, type DataCoverageLevel } from '../features/analytics/coverage';
import { careerStatesForEntry, entriesForPeriod, hasMovement, resultsForPeriod, summarize, type PeriodSummary } from '../features/analytics/periodSummary';
import { addDays, dateRange, endOfMonth, endOfWeek, formatMinutes, startOfMonth, startOfWeek, todayKey } from './dates';

export { buildCoverageSeries, dataCoverageLevel, type DataCoverageLevel } from '../features/analytics/coverage';
export { careerStatesForEntry, entriesForMonth, entriesForPeriod, entriesForWeek, hasMovement, resultsForPeriod, summarize, type PeriodSummary } from '../features/analytics/periodSummary';

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
      comparisonMetric('external', 'Реальные шаги', 'percent', ratioPercent(beforeSummary.externalActionDays, beforeSummary.actionDirectionSamples), ratioPercent(afterSummary.externalActionDays, afterSummary.actionDirectionSamples), beforeSummary.actionDirectionSamples, afterSummary.actionDirectionSamples),
      comparisonMetric('nutrition', 'Питание поддержало цель', 'percent', ratioPercent(beforeSummary.nutritionSupportDays, beforeSummary.nutritionSamples), ratioPercent(afterSummary.nutritionSupportDays, afterSummary.nutritionSamples), beforeSummary.nutritionSamples, afterSummary.nutritionSamples),
      comparisonMetric('results', 'Итоги', 'count', beforeResults, afterResults, null, null),
    ],
  };
}

export function weekSummaryText(summary: PeriodSummary, activeAreas: LifeAreaId[], areaOptions: Option[] = lifeAreaOptions): string {
  if (!summary.coveredEntriesCount) return 'Пока нет заполненных записей за эту неделю. Здесь появится краткая сводка фактов.';

  const labels = new Map(areaOptions.map((item) => [item.id, item.label]));
  const present = activeAreas.filter((area) => summary.areaCounts[area] > 0).map((area) => (labels.get(area) ?? area).toLowerCase());
  const absent = summary.lifeAreaSamples > 0
    ? activeAreas.filter((area) => (summary.areaCounts[area] ?? 0) === 0).map((area) => (labels.get(area) ?? area).toLowerCase())
    : [];
  const parts = [
    `${summary.careerDays} карьерных ${plural(summary.careerDays, 'день', 'дня', 'дней')}`,
    `${summary.externalSteps} ${plural(summary.externalSteps, 'день', 'дня', 'дней')} с откликом, разговором или итогом`,
    `${summary.movementDays} ${plural(summary.movementDays, 'день с активностью', 'дня с активностью', 'дней с активностью')}`
  ];
  if (summary.nutritionSupportDays || summary.nutritionBlockDays) {
    parts.push(`питание поддержало ${summary.nutritionSupportDays}, мешало ${summary.nutritionBlockDays}`);
  }
  if (summary.externalActionDays || summary.preparationDays || summary.driftDays) {
    parts.push(`действия по цели: конкретные действия ${summary.externalActionDays}, подготовка ${summary.preparationDays}, занимался другим ${summary.driftDays}`);
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

export function buildObservations(entries: DailyEntry[], factorOptions: Option<EveningFactorId>[] = eveningFactorOptions): Observation[] {
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
      title: 'Физическая активность и энергия',
      text: `В дни с физической активностью энергия в среднем ${direction}: ${formatNumber(movementEnergy)} против ${formatNumber(stillEnergy)}.`,
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

  const leadingFactor = factorSummaries(entries, factorOptions)[0];
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

export function factorSummaries(entries: DailyEntry[], factorOptions: Option<EveningFactorId>[] = eveningFactorOptions): FactorSummary[] {
  const ordinaryEntries = entries.filter((entry) => entry.specialDay === null);
  return factorOptions
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

export function buildReviewCues(period: 'week' | 'month', entries: DailyEntry[], results: ResultRecord[], lifeEvents: LifeEventRecord[], externalCareerIds: string[] = externalCareerStates, factorOptions: Option<EveningFactorId>[] = eveningFactorOptions): ReviewCue[] {
  const summary = summarize(entries, externalCareerIds);
  const factors = factorSummaries(entries, factorOptions);
  const cues: ReviewCue[] = [];
  const enoughEntries = period === 'week'
    ? summary.ordinaryCoveredEntriesCount >= 4 && summary.ordinaryCoreEntriesCount >= 2
    : summary.ordinaryCoveredEntriesCount >= 12 && summary.ordinaryCoreEntriesCount >= 6;
  const minTarget = period === 'week' ? '4 заполненных дня, из них 2 с основными полями' : '12 заполненных дней, из них 6 с основными полями';

  cues.push({
    id: 'coverage',
    title: enoughEntries ? 'Данных достаточно для обзора' : 'Данных пока мало',
    text: enoughEntries
      ? `${summary.ordinaryCoveredEntriesCount} заполненных дней, из них ${summary.ordinaryCoreEntriesCount} с основными полями, уже дают рабочую картину периода.`
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
      title: summary.externalSteps > 0 ? 'Были отклики, разговоры или итоги по карьере' : 'Карьера появлялась',
      text: `${summary.careerDays} карьерных ${plural(summary.careerDays, 'день', 'дня', 'дней')}, из них ${summary.externalSteps} с откликом, разговором или итогом. Так проще сверить ощущение с фактами.`,
      tone: summary.externalSteps > 0 ? 'good' : 'neutral',
    });
  }

  if (summary.preparationDays >= 3 && summary.externalActionDays <= 1) {
    cues.push({
      id: 'direction-preparation',
      title: 'Много подготовки, мало конкретных действий',
      text: `${summary.preparationDays} ${plural(summary.preparationDays, 'день', 'дня', 'дней')} отмечены как подготовка, конкретных действий — ${summary.externalActionDays}. Проверь, приводит ли подготовка к заметному результату.`,
      tone: 'warning',
    });
  } else if (summary.externalActionDays >= 2) {
    cues.push({
      id: 'direction-external',
      title: 'Были конкретные действия по цели',
      text: `${summary.externalActionDays} ${plural(summary.externalActionDays, 'день', 'дня', 'дней')} с действиями, после которых мог появиться заметный результат или обратная связь.`,
      tone: 'good',
    });
  }

  if (summary.driftDays >= 2) {
    cues.push({
      id: 'direction-drift',
      title: 'Другие дела занимали день',
      text: `${summary.driftDays} ${plural(summary.driftDays, 'день', 'дня', 'дней')} были заняты другими делами. В разборе лучше искать повторяющееся условие, а не обвинять себя.`,
      tone: 'warning',
    });
  }

  if (results.length) {
    cues.push({
      id: 'results',
      title: 'Есть завершённые вещи',
      text: `${results.length} ${plural(results.length, 'итог', 'итога', 'итогов')} за период. Это отдельный слой прогресса, даже если состояние было неровным.`,
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
      text: `${summary.specialDays} особых ${plural(summary.specialDays, 'день', 'дня', 'дней')} и ${lifeEvents.length} ${plural(lifeEvents.length, 'важное событие', 'важных события', 'важных событий')}. Такой период лучше не сравнивать с обычным ритмом напрямую.`,
      tone: 'neutral',
    });
  }

  return limitCues(cues, ['coverage', 'results', 'context']);
}

export function buildRangeReviewCues(rangeMonths: number, entries: DailyEntry[], results: ResultRecord[], lifeEvents: LifeEventRecord[], externalCareerIds: string[] = externalCareerStates, factorOptions: Option<EveningFactorId>[] = eveningFactorOptions): ReviewCue[] {
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
    text: `${summary.coveredEntriesCount} заполненных дней, из них ${summary.ordinaryCoreEntriesCount} с основными полями, в ${monthsWithData} из ${rangeMonths} мес.`,
    tone: enoughEntries ? 'good' : 'warning',
  });

  const factor = factorSummaries(entries, factorOptions).find((item) => item.count >= Math.max(3, rangeMonths));
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
      cues.push({ id: 'direction-preparation', title: 'Подготовка редко переходила в конкретные действия', text: `Подготовка — ${preparationRate}% отмеченных дней, конкретные действия — ${externalRate}%. Проверь, что может привести к заметному результату.`, tone: 'warning' });
    } else if (externalRate >= 35) {
      cues.push({ id: 'direction-external', title: 'Конкретные действия сохранялись', text: `Конкретные действия появлялись в ${externalRate}% дней с отметкой по текущей цели. Сверь это с итогами периода.`, tone: 'good' });
    }
    if (driftRate >= 30) {
      cues.push({ id: 'direction-drift', title: 'Другие занятия часто вытесняли цель', text: `${driftRate}% дней с отметкой по текущей цели были заняты другим. Ищи повторяющееся условие, а не одну причину всего периода.`, tone: 'warning' });
    }
  }

  if (results.length) {
    cues.push({ id: 'results', title: 'Есть завершённые итоги', text: `${results.length} ${plural(results.length, 'итог', 'итога', 'итогов')} за период. Сопоставь их с реальными шагами, а не только с занятостью.`, tone: 'good' });
  }

  if (summary.specialDays || lifeEvents.length) {
    cues.push({ id: 'context', title: 'Динамика менялась вместе с контекстом', text: `${summary.specialDays} особых ${plural(summary.specialDays, 'день', 'дня', 'дней')} и ${lifeEvents.length} ${plural(lifeEvents.length, 'важное событие', 'важных события', 'важных событий')}. Они исключены из базовых средних состояния.`, tone: 'neutral' });
  }

  return limitCues(cues, ['coverage', 'results', 'context']);
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
    'Какие действия привели к заметному результату или обратной связи?',
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

export function eveningFactorLabel(value: string, factorOptions: Option<EveningFactorId>[] = eveningFactorOptions): string {
  if (value === 'porn') return 'Другое';
  return factorOptions.find((option) => option.id === value)?.label ?? value;
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
